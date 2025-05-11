"use client";

import React, { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { Device } from "mediasoup-client";

interface TestResult {
  name: string;
  status: "pending" | "success" | "failure" | "running";
  details?: string;
}

export default function WebRTCDiagnosticTool({
  streamId = "diagnostic-test",
  className,
}: {
  streamId?: string;
  className?: string;
}) {
  const [results, setResults] = useState<TestResult[]>([
    { name: "Socket.IO Connection", status: "pending" },
    { name: "MediaSoup Device Loading", status: "pending" },
    { name: "STUN/TURN Connectivity", status: "pending" },
    { name: "Loopback Detection", status: "pending" },
    { name: "Producer Transport Creation", status: "pending" },
    { name: "Consumer Transport Creation", status: "pending" },
  ]);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const [isLoopback, setIsLoopback] = useState<boolean>(false);

  const isLoopbackAddress = (address?: string): boolean => {
    if (!address) return false;

    if (address.startsWith("[") && address.endsWith("]")) {
      address = address.substring(1, address.length - 1);
    }

    return (
      address === "localhost" ||
      address === "127.0.0.1" ||
      address === "::1" ||
      address === "0.0.0.0" ||
      address === "::" ||
      address === "0:0:0:0:0:0:0:1"
    );
  };

  const updateResult = (index: number, update: Partial<TestResult>) => {
    setResults((prev) => {
      const newResults = [...prev];
      newResults[index] = { ...newResults[index], ...update };
      return newResults;
    });
  };

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const runTest = async () => {
    setRunning(true);
    setComplete(false);
    setLogs([]);
    setIsLoopback(false);

    const currentHostname = window.location.hostname;
    const currentLoopback = isLoopbackAddress(currentHostname);

    if (currentLoopback) {
      addLog(`Detected loopback connection: ${currentHostname}`);
      setIsLoopback(true);
    }

    setResults((prev) =>
      prev.map((result) => ({
        ...result,
        status: "pending",
        details: undefined,
      }))
    );

    try {
      updateResult(0, { status: "running" });
      addLog("Starting Socket.IO connection test");

      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
      addLog(`Connecting to Socket.IO at ${socketUrl}`);

      try {
        const socketUrlObj = new URL(socketUrl);
        if (isLoopbackAddress(socketUrlObj.hostname)) {
          addLog(
            `Socket.IO server is on loopback address: ${socketUrlObj.hostname}`
          );
          setIsLoopback(true);
        }
      } catch (e) {
        addLog(`Could not parse socket URL: ${socketUrl}`);
      }

      socketRef.current = io(socketUrl, {
        path: process.env.NEXT_PUBLIC_WS_URL || "/socket.io",
        transports: isLoopback
          ? ["polling", "websocket"]
          : ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: isLoopback ? 1000 : 2000,
        timeout: isLoopback ? 10000 : 20000,
        query: {
          streamId,
          userId: "diagnostic-tool",
          username: "Diagnostic Tool",
          isLoopback: isLoopback ? "true" : "false",
        },
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Socket.IO connection timeout"));
        }, 5000);

        socketRef.current?.on("connect", () => {
          clearTimeout(timeout);
          addLog(`Socket.IO connected with ID: ${socketRef.current?.id}`);
          resolve();
        });

        socketRef.current?.on("connect_error", (err) => {
          clearTimeout(timeout);
          reject(new Error(`Socket.IO connection error: ${err.message}`));
        });
      });

      updateResult(0, {
        status: "success",
        details: `Connected with socket ID: ${socketRef.current?.id}${
          isLoopback ? " (loopback)" : ""
        }`,
      });

      updateResult(1, { status: "running" });
      addLog("Starting MediaSoup device loading test");

      deviceRef.current = new Device();

      const rtpCapabilities = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Get router capabilities timeout"));
        }, 5000);

        socketRef.current?.emit(
          "getRouterRtpCapabilities",
          { streamId },
          (response: any) => {
            clearTimeout(timeout);
            if (response.error) {
              reject(
                new Error(
                  `Failed to get router capabilities: ${response.error}`
                )
              );
            } else {
              resolve(response.rtpCapabilities);
            }
          }
        );
      });

      await deviceRef.current.load({ routerRtpCapabilities: rtpCapabilities });
      updateResult(1, {
        status: "success",
        details: "MediaSoup device loaded successfully",
      });
      addLog("MediaSoup device loaded successfully");

      updateResult(2, { status: "running" });
      addLog("Testing STUN/TURN connectivity");

      const iceServers: RTCIceServer[] = [
        {
          urls:
            process.env.NEXT_PUBLIC_STUN_SERVER_URL ||
            "stun:stun.l.google.com:19302",
        },
      ];

      if (process.env.NEXT_PUBLIC_TURN_SERVER_URL) {
        iceServers.push({
          urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME || "",
          credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || "",
        });
      }

      addLog(`Using ICE servers: ${JSON.stringify(iceServers)}`);

      const pc1 = new RTCPeerConnection({ iceServers });
      const pc2 = new RTCPeerConnection({ iceServers });

      let iceCandidatesReceived = 0;
      let iceCandidatesSuccess = false;

      pc1.onicecandidate = (e) => {
        if (e.candidate) {
          pc2.addIceCandidate(e.candidate);
          iceCandidatesReceived++;
          addLog(
            `ICE candidate received: ${e.candidate.candidate.split(" ")[7]}`
          );
        }
      };

      pc2.onicecandidate = (e) => {
        if (e.candidate) {
          pc1.addIceCandidate(e.candidate);
          iceCandidatesReceived++;
          addLog(
            `ICE candidate received: ${e.candidate.candidate.split(" ")[7]}`
          );
        }
      };

      pc1.oniceconnectionstatechange = () => {
        addLog(`PC1 ICE state: ${pc1.iceConnectionState}`);
        if (
          pc1.iceConnectionState === "connected" ||
          pc1.iceConnectionState === "completed"
        ) {
          iceCandidatesSuccess = true;
        }
      };

      pc1.createDataChannel("test");
      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);
      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (iceCandidatesReceived > 0) {
            resolve();
          } else {
            reject(new Error("ICE gathering timeout with no candidates"));
          }
        }, 5000);

        const checkInterval = setInterval(() => {
          if (iceCandidatesSuccess) {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve();
          }
        }, 500);
      });

      updateResult(2, {
        status: iceCandidatesSuccess ? "success" : "failure",
        details: iceCandidatesSuccess
          ? "ICE connectivity established"
          : `Received ${iceCandidatesReceived} candidates but couldn't establish connection`,
      });

      pc1.close();
      pc2.close();

      updateResult(3, { status: "running" });
      addLog("Testing loopback connectivity patterns");

      await new Promise<void>((resolve) => {
        socketRef.current?.emit(
          "connection_established",
          { testRequest: true },
          (response: any) => {
            if (response && response.isLoopback) {
              addLog("Server confirmed this is a loopback connection");
              setIsLoopback(true);
            }
            resolve();
          }
        );

        setTimeout(resolve, 1000);
      });

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      let loopbackCandidateDetected = false;
      const iceCandidatesPromise = new Promise<void>((resolve) => {
        const candidates: string[] = [];
        let timeout: NodeJS.Timeout;

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            const candidateStr = e.candidate.candidate;
            candidates.push(candidateStr);
            addLog(`ICE candidate: ${candidateStr}`);

            if (
              candidateStr.includes("127.0.0.1") ||
              candidateStr.includes("::1") ||
              candidateStr.includes("host")
            ) {
              loopbackCandidateDetected = true;
              addLog("Detected loopback ICE candidate pattern");
              clearTimeout(timeout);
              resolve();
            }
          } else {
            resolve();
          }
        };

        pc.createDataChannel("loopback-test");

        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .catch((err) => {
            addLog(`Error creating offer: ${err.message}`);
            resolve();
          });

        timeout = setTimeout(() => {
          resolve();
        }, 3000);
      });

      await iceCandidatesPromise;
      pc.close();

      const isLoopbackConnection = isLoopback || loopbackCandidateDetected;

      updateResult(3, {
        status: "success",
        details: isLoopbackConnection
          ? "Connection is using localhost/loopback addressing"
          : "Connection is using standard networking",
      });

      updateResult(4, { status: "running" });
      addLog("Testing producer transport creation");

      const producerTransportOptions = await new Promise<any>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Create producer transport timeout"));
          }, 5000);

          socketRef.current?.emit(
            "createProducerTransport",
            { streamId },
            (response: any) => {
              clearTimeout(timeout);
              if (response.error) {
                reject(
                  new Error(
                    `Failed to create producer transport: ${response.error}`
                  )
                );
              } else {
                resolve(response);
              }
            }
          );
        }
      );

      const producerTransport = deviceRef.current.createSendTransport(
        producerTransportOptions
      );

      producerTransport.on(
        "connect",
        ({ dtlsParameters }, callback, errback) => {
          addLog("Producer transport connect event triggered");
          socketRef.current?.emit(
            "connectProducerTransport",
            { transportId: producerTransport.id, dtlsParameters, streamId },
            (response: any) => {
              if (response.error) {
                errback(new Error(response.error));
              } else {
                callback();
              }
            }
          );
        }
      );

      producerTransport.on(
        "produce",
        ({ kind, rtpParameters }, callback, errback) => {
          addLog(`Producer transport produce event triggered for ${kind}`);
          callback({ id: "test-producer-id" });
        }
      );

      updateResult(4, {
        status: "success",
        details: "Producer transport created successfully",
      });

      updateResult(5, { status: "running" });
      addLog("Testing consumer transport creation");

      const consumerTransportOptions = await new Promise<any>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Create consumer transport timeout"));
          }, 5000);

          socketRef.current?.emit(
            "createConsumerTransport",
            { streamId },
            (response: any) => {
              clearTimeout(timeout);
              if (response.error) {
                reject(
                  new Error(
                    `Failed to create consumer transport: ${response.error}`
                  )
                );
              } else {
                resolve(response);
              }
            }
          );
        }
      );

      const consumerTransport = deviceRef.current.createRecvTransport(
        consumerTransportOptions
      );

      consumerTransport.on(
        "connect",
        ({ dtlsParameters }, callback, errback) => {
          addLog("Consumer transport connect event triggered");
          socketRef.current?.emit(
            "connectConsumerTransport",
            { transportId: consumerTransport.id, dtlsParameters, streamId },
            (response: any) => {
              if (response.error) {
                errback(new Error(response.error));
              } else {
                callback();
              }
            }
          );
        }
      );

      updateResult(6, {
        status: "success",
        details: "Consumer transport created successfully",
      });
      addLog("All tests completed successfully");

      producerTransport.close();
      consumerTransport.close();
    } catch (error: any) {
      const failedTestIndex = results.findIndex(
        (result) => result.status === "running"
      );

      if (failedTestIndex >= 0) {
        updateResult(failedTestIndex, {
          status: "failure",
          details: error.message || "Unknown error",
        });
        addLog(`Test failed: ${error.message || "Unknown error"}`);
      }

      for (let i = failedTestIndex + 1; i < results.length; i++) {
        updateResult(i, {
          status: "pending",
          details: "Skipped due to previous failure",
        });
      }
    } finally {
      setRunning(false);
      setComplete(true);

      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className={`p-4 border rounded-lg bg-gray-50 ${className}`}>
      <h2 className="text-xl font-bold mb-4">
        WebRTC Connection Diagnostic Tool
      </h2>

      <button
        onClick={runTest}
        disabled={running}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 mb-6"
      >
        {running ? "Running Tests..." : "Run Diagnostic Tests"}
      </button>

      <div className="space-y-4 mb-6">
        {results.map((result, index) => (
          <div key={index} className="flex items-center">
            <div className="w-8 h-8 mr-3 flex-shrink-0">
              {result.status === "pending" && (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
              )}
              {result.status === "running" && (
                <div className="w-6 h-6 rounded-full border-2 border-t-blue-500 border-gray-300 animate-spin"></div>
              )}
              {result.status === "success" && (
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white">
                  ✓
                </div>
              )}
              {result.status === "failure" && (
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white">
                  ✕
                </div>
              )}
            </div>
            <div className="flex-grow">
              <div className="font-medium">{result.name}</div>
              {result.details && (
                <div className="text-sm text-gray-600">{result.details}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {complete && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Diagnostic Logs</h3>
          <div className="bg-black text-green-400 p-4 rounded h-60 overflow-y-auto font-mono text-sm">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
