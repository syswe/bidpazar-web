import { useCallback, useEffect, useRef, useState } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import { Socket } from 'socket.io-client';
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import { getIceServers } from '../utils/ice-config';
import { logInfo, logError, logWarn } from '../utils/logging';
import { socketPromise } from '../utils/network';
import { MediasoupDevice, LogData } from '../types';

// Type for transport responses from the server
interface TransportOptions {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
  error?: string;
}

// Types for transports managed by this hook
type ProducerType = mediasoupClient.types.Producer | null;
type ConsumerType = mediasoupClient.types.Consumer | null;
type TransportType = mediasoupClient.types.Transport | null;

interface UseMediaTransportsProps {
  socket: Socket | null;
  deviceRef: React.MutableRefObject<MediasoupDevice | null>;
  isStreamer: boolean;
  streamId: string;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onTransportConnected?: () => void;
  onProducerCreated?: (kind: 'audio' | 'video', producer: ProducerType) => void;
  onConsumerCreated?: (kind: 'audio' | 'video', consumer: ConsumerType) => void;
  onStreamReady?: () => void;
  onConnectionError?: (error: { type: string; message: string; details?: any }) => void;
  onAutoplayBlocked?: (blocked: boolean) => void;
}

export function useMediaTransports({
  socket,
  deviceRef,
  isStreamer,
  streamId,
  localStreamRef,
  videoRef,
  onTransportConnected,
  onProducerCreated,
  onConsumerCreated,
  onStreamReady,
  onConnectionError,
  onAutoplayBlocked
}: UseMediaTransportsProps) {
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();
  
  // State
  const [transportReady, setTransportReady] = useState<boolean>(false);
  
  // Refs for transports and producers/consumers
  const transportRef = useRef<{
    producer: TransportType;
    consumer: TransportType;
  }>({ producer: null, consumer: null });
  
  const producersRef = useRef<{
    video: ProducerType;
    audio: ProducerType;
    setupInProgress: boolean;
  }>({ 
    video: null, 
    audio: null,
    setupInProgress: false
  });
  
  const consumersRef = useRef<{
    video: ConsumerType;
    audio: ConsumerType;
  }>({ video: null, audio: null });
  
  // Cleanup function refs
  const cleanupRef = useRef<(() => void)[]>([]);
  
  // Safely access the video element from the ref
  const getVideoElement = useCallback((): HTMLVideoElement | null => {
    return videoRef.current || null;
  }, [videoRef]);

  /**
   * Create and set up a producer transport for the streamer
   */
  const setupProducerTransport = useCallback(async () => {
    if (!socket || !deviceRef.current || !socket.connected) {
      logError("Cannot set up producer transport: prerequisite not met", {
        hasSocket: !!socket,
        socketConnected: socket?.connected,
        hasDevice: !!deviceRef.current
      });
      return null;
    }

    if (isConfigLoading || !runtimeConfig) {
      logError("Cannot set up producer transport: Runtime config not ready", {
        isConfigLoading,
        hasConfig: !!runtimeConfig,
      });
      return null;
    }

    try {
      // Request transport options from server
      const transportOptions = await socketPromise<TransportOptions>(
        socket,
        "createProducerTransport",
        { streamId }
      );

      if (!transportOptions || transportOptions.error) {
        throw new Error(transportOptions?.error || "Failed to create producer transport");
      }

      logInfo("Creating producer transport with options", {
        transportId: transportOptions.id,
      });

      // Get ICE servers using runtime config
      const iceServers = getIceServers(runtimeConfig);

      // Create the transport with enhanced ICE configuration
      const transport = deviceRef.current.createSendTransport({
        id: transportOptions.id,
        iceParameters: transportOptions.iceParameters,
        iceCandidates: transportOptions.iceCandidates,
        dtlsParameters: transportOptions.dtlsParameters,
        iceServers: iceServers,
      });

      // Set up transport connection events
      transport.on(
        "connect",
        async ({ dtlsParameters }, callback, errback) => {
          logInfo("Producer transport connect event triggered", {
            transportId: transport.id,
          });

          try {
            if (!socket.connected) {
              const error = new Error("Socket not connected");
              throw error;
            }

            await socketPromise(socket, "connectProducerTransport", {
              transportId: transport.id,
              dtlsParameters,
            });

            logInfo("Producer transport connect request successful");
            callback();
          } catch (err) {
            const typedError = err as Error;
            logError("Producer transport connect failed", {
              error: typedError.message
            });
            errback(typedError);
          }
        }
      );

      // Monitor ICE connection state
      transport.on("connectionstatechange", (state) => {
        logInfo("Producer transport connection state change", {
          transportId: transport.id,
          state,
        });
        
        if (state === "connected") {
          setTransportReady(true);
          if (onTransportConnected) {
            onTransportConnected();
          }
        } else if (state === "failed") {
          logError("Producer transport ICE connection failed", {
            transportId: transport.id,
          });

          // Attempt ICE restart if connection fails
          if (socket.connected) {
            logInfo("Attempting ICE restart for failed transport");

            // Emit restart request to server
            socket.emit(
              "restartIce",
              { transportId: transport.id },
              (response: any) => {
                if (response.error) {
                  logError("ICE restart request failed", {
                    error: response.error,
                  });
                  return;
                }

                // Apply new ICE parameters
                if (response.iceParameters) {
                  try {
                    transport.restartIce({
                      iceParameters: response.iceParameters,
                    });
                    logInfo("ICE restart initiated", {
                      transportId: transport.id,
                    });
                  } catch (restartErr) {
                    const typedError = restartErr as Error;
                    logError("Failed to restart ICE", {
                      error: typedError.message
                    });
                  }
                }
              }
            );
          }
        }
      });

      // Handle produce events
      transport.on(
        "produce",
        async ({ kind, rtpParameters, appData }, callback, errback) => {
          logInfo("Producer transport produce event triggered", {
            transportId: transport.id,
            kind,
          });

          try {
            if (!socket.connected) {
              const error = new Error("Socket not connected");
              throw error;
            }

            // Tell the server to create a Producer with the given RTP parameters
            const response = await socketPromise<{ id: string; error?: string }>(
              socket,
              "produce",
              {
                transportId: transport.id,
                kind,
                rtpParameters,
                appData: {
                  ...appData,
                  streamId,
                },
              }
            );

            if (response.error) {
              throw new Error(response.error);
            }

            logInfo("Producer created on server", {
              producerId: response.id,
              kind,
            });
            
            callback({ id: response.id });
          } catch (err) {
            const typedError = err as Error;
            logError("Producer transport produce failed", {
              error: typedError.message
            });
            errback(typedError);
          }
        }
      );

      transportRef.current.producer = transport;
      return transport;
    } catch (err) {
      const typedError = err as Error;
      logError("Failed to set up producer transport", {
        error: typedError.message
      });
      
      // Report error to parent component
      if (onConnectionError) {
        onConnectionError({
          type: "TRANSPORT_SETUP_FAILED",
          message: `Failed to set up media connection: ${typedError.message}`,
          details: typedError
        });
      }
      
      return null;
    }
  }, [
    socket, 
    deviceRef, 
    isConfigLoading, 
    runtimeConfig, 
    streamId, 
    onTransportConnected,
    onConnectionError
  ]);

  /**
   * Create and set up a consumer transport for viewers
   */
  const setupConsumerTransport = useCallback(async () => {
    if (!socket || !deviceRef.current || !socket.connected) {
      logError("Cannot set up consumer transport: prerequisite not met", {
        hasSocket: !!socket,
        socketConnected: socket?.connected,
        hasDevice: !!deviceRef.current
      });
      return null;
    }

    if (isConfigLoading || !runtimeConfig) {
      logError("Cannot set up consumer transport: Runtime config not ready", {
        isConfigLoading,
        hasConfig: !!runtimeConfig,
      });
      return null;
    }

    try {
      // Request transport options from server
      const transportOptions = await socketPromise<TransportOptions>(
        socket,
        "createConsumerTransport",
        { streamId }
      );

      if (!transportOptions || transportOptions.error) {
        throw new Error(transportOptions?.error || "Failed to create consumer transport");
      }

      logInfo("Creating consumer transport with options", {
        transportId: transportOptions.id,
      });

      // Get ICE servers using runtime config
      const iceServers = getIceServers(runtimeConfig);

      // Create the transport with enhanced ICE configuration
      const transport = deviceRef.current.createRecvTransport({
        id: transportOptions.id,
        iceParameters: transportOptions.iceParameters,
        iceCandidates: transportOptions.iceCandidates,
        dtlsParameters: transportOptions.dtlsParameters,
        iceServers: iceServers,
      });

      // Set up transport connection events
      transport.on(
        "connect",
        async ({ dtlsParameters }, callback, errback) => {
          logInfo("Consumer transport connect event triggered", {
            transportId: transport.id,
          });

          try {
            if (!socket.connected) {
              const error = new Error("Socket not connected");
              throw error;
            }

            await socketPromise(socket, "connectConsumerTransport", {
              transportId: transport.id,
              dtlsParameters,
            });

            logInfo("Consumer transport connect request successful");
            callback();
          } catch (err) {
            const typedError = err as Error;
            logError("Consumer transport connect failed", {
              error: typedError.message
            });
            errback(typedError);
          }
        }
      );

      // Handle connection state changes
      transport.on("connectionstatechange", (state) => {
        logInfo("Consumer transport connection state changed", {
          transportId: transport.id,
          state,
        });

        if (state === "connected") {
          setTransportReady(true);
          if (onTransportConnected) {
            onTransportConnected();
          }
          
          // Request to consume available producers
          requestAvailableProducers();
        } else if (state === "failed") {
          logError("Consumer transport ICE connection failed", {
            transportId: transport.id,
          });

          // Attempt ICE restart for consumer connection
          if (socket.connected) {
            logInfo("Attempting ICE restart for failed consumer transport");

            socket.emit(
              "restartIce",
              { transportId: transport.id },
              (response: any) => {
                if (response.error) {
                  logError("ICE restart request failed", {
                    error: response.error,
                  });
                  return;
                }

                // Apply new ICE parameters
                if (response.iceParameters) {
                  try {
                    transport.restartIce({
                      iceParameters: response.iceParameters,
                    });
                    logInfo("ICE restart initiated for consumer", {
                      transportId: transport.id,
                    });
                  } catch (restartErr) {
                    const typedError = restartErr as Error;
                    logError("Failed to restart ICE for consumer", {
                      error: typedError.message
                    });
                  }
                }
              }
            );
          }
        }
      });

      transportRef.current.consumer = transport;
      return transport;
    } catch (err) {
      const typedError = err as Error;
      logError("Failed to create consumer transport", {
        error: typedError.message
      });
      
      // Report error to parent component
      if (onConnectionError) {
        onConnectionError({
          type: "TRANSPORT_SETUP_FAILED",
          message: `Failed to set up media connection: ${typedError.message}`,
          details: typedError
        });
      }
      
      return null;
    }
  }, [
    socket, 
    deviceRef, 
    isConfigLoading, 
    runtimeConfig, 
    streamId, 
    onTransportConnected,
    onConnectionError
  ]);

  /**
   * Publish local media tracks to server using the producer transport
   */
  const produceLocalMedia = useCallback(async (mediaStream?: MediaStream) => {
    const transport = transportRef.current.producer;
    const stream = mediaStream || localStreamRef.current;
    
    if (!transport || !stream || transport.closed) {
      logError("Cannot produce media: Transport is closed or invalid or no local stream available", {
        hasTransport: !!transport,
        transportClosed: transport?.closed,
        hasStream: !!stream
      });
      return false;
    }

    try {
      // Mark production setup as in progress to prevent duplicate attempts
      if (producersRef.current.setupInProgress) {
        logWarn("Media production setup already in progress");
        return false;
      }
      
      producersRef.current.setupInProgress = true;

      // Close existing producers
      if (producersRef.current.video) {
        producersRef.current.video.close();
        producersRef.current.video = null;
      }

      if (producersRef.current.audio) {
        producersRef.current.audio.close();
        producersRef.current.audio = null;
      }

      // Create video producer if we have video tracks
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        logInfo("Creating video producer", {
          track: videoTracks[0].label,
          enabled: videoTracks[0].enabled,
          settings: videoTracks[0].getSettings()
        });

        try {
          // Use simpler encoding settings to ensure compatibility
          const videoProducer = await transport.produce({
            track: videoTracks[0],
            encodings: [
              // Use a single encoding with reasonable bitrate that will work on most connections
              { maxBitrate: 800000, scaleResolutionDownBy: 1 },
            ],
            codecOptions: {
              videoGoogleStartBitrate: 800,
            },
          });

          logInfo("Video producer created", {
            producerId: videoProducer.id,
          });
          
          producersRef.current.video = videoProducer;

          // Add diagnostic events
          videoProducer.on("transportclose", () => {
            logInfo("Video producer transport closed");
            producersRef.current.video = null;
          });

          videoProducer.on("trackended", () => {
            logInfo("Video track ended");
            if (producersRef.current.video) {
              producersRef.current.video.close();
              producersRef.current.video = null;
            }
          });
          
          // Notify parent component
          if (onProducerCreated) {
            onProducerCreated('video', videoProducer);
          }
        } catch (err) {
          const typedError = err as Error;
          logError("Failed to create video producer", {
            error: typedError.message
          });
          // Continue with audio producer even if video fails
        }
      }

      // Create audio producer if we have audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        logInfo("Creating audio producer", {
          track: audioTracks[0].label,
          enabled: audioTracks[0].enabled,
          settings: audioTracks[0].getSettings()
        });

        try {
          // Enhanced audio options for better quality and reliability
          const audioProducer = await transport.produce({
            track: audioTracks[0],
            codecOptions: {
              opusStereo: false, // Use mono for better reliability
              opusDtx: true,
              opusFec: true,
              opusMaxPlaybackRate: 48000,
              opusPtime: 20,
            },
          });

          logInfo("Audio producer created", {
            producerId: audioProducer.id,
          });
          
          producersRef.current.audio = audioProducer;

          // Handle producer events
          audioProducer.on("transportclose", () => {
            logInfo("Audio producer transport closed");
            producersRef.current.audio = null;
          });

          audioProducer.on("trackended", () => {
            logInfo("Audio track ended");
            if (producersRef.current.audio) {
              producersRef.current.audio.close();
              producersRef.current.audio = null;
            }
          });
          
          // Notify parent component
          if (onProducerCreated) {
            onProducerCreated('audio', audioProducer);
          }
        } catch (err) {
          const typedError = err as Error;
          logError("Failed to create audio producer", {
            error: typedError.message
          });
        }
      }

      // Signal streaming has started
      if (onStreamReady) {
        onStreamReady();
      }
      
      producersRef.current.setupInProgress = false;
      return true;
    } catch (err) {
      const typedError = err as Error;
      logError("Failed to produce media", {
        error: typedError.message
      });
      
      producersRef.current.setupInProgress = false;
      
      // Report error to parent component
      if (onConnectionError) {
        onConnectionError({
          type: "MEDIA_PRODUCE_FAILED",
          message: `Failed to publish media stream: ${typedError.message}`,
          details: typedError
        });
      }
      
      return false;
    }
  }, [localStreamRef, onProducerCreated, onStreamReady, onConnectionError]);

  /**
   * Request available producers to consume from the server
   */
  const requestAvailableProducers = useCallback(async () => {
    if (!socket || !deviceRef.current || !transportRef.current.consumer) {
      logWarn("Cannot request producers: prerequisites not met", {
        hasSocket: !!socket,
        socketConnected: socket?.connected,
        hasDevice: !!deviceRef.current,
        hasConsumerTransport: !!transportRef.current.consumer
      });
      return;
    }
    
    try {
      logInfo("Requesting available producers to consume");
      
      const producers = await socketPromise<{
        producers?: Array<{ producerId: string; kind: string; peerId: string }>;
        error?: string;
      }>(socket, "getProducers", { streamId });
      
      if (producers.error) {
        logWarn(`Failed to get producers: ${producers.error}`);
        return;
      }
      
      if (!producers.producers || producers.producers.length === 0) {
        logInfo("No producers available to consume");
        return;
      }
      
      // Consume each producer
      logInfo(`Found ${producers.producers.length} producers to consume`);
      for (const producer of producers.producers) {
        await consumeProducer(producer.producerId, producer.kind as 'audio' | 'video');
      }
    } catch (err) {
      const typedError = err as Error;
      logError("Error requesting available producers", {
        error: typedError.message
      });
    }
  }, [socket, deviceRef, streamId, transportRef]);

  /**
   * Consume a remote producer
   */
  const consumeProducer = useCallback(async (producerId: string, kind?: 'audio' | 'video') => {
    if (!socket || !deviceRef.current || !transportRef.current.consumer) {
      logWarn("Cannot consume producer: prerequisites not met");
      return null;
    }

    try {
      logInfo("Attempting to consume remote producer", {
        producerId,
        kind
      });

      // Request consumer from server
      const consumerOptions = await socketPromise<{
        consumerId?: string;
        producerId?: string;
        kind?: string;
        rtpParameters?: any;
        producerUserId?: string;
        error?: string;
      }>(socket, "consume", {
        transportId: transportRef.current.consumer.id,
        producerId,
        rtpCapabilities: deviceRef.current.rtpCapabilities,
        streamId,
      });

      if (consumerOptions?.error) {
        throw new Error(consumerOptions.error);
      }

      if (
        !consumerOptions?.consumerId ||
        !consumerOptions?.producerId ||
        !consumerOptions?.kind ||
        !consumerOptions?.rtpParameters
      ) {
        throw new Error("Invalid consumer options returned from server");
      }

      // Create the consumer
      const consumer = await transportRef.current.consumer.consume({
        id: consumerOptions.consumerId,
        producerId: consumerOptions.producerId,
        kind: consumerOptions.kind as "audio" | "video",
        rtpParameters: consumerOptions.rtpParameters,
      });

      // Store the consumer in our ref
      const consumerKind = consumerOptions.kind as 'audio' | 'video';
      if (consumerKind === "video") {
        // Close previous video consumer if exists
        if (consumersRef.current.video) {
          consumersRef.current.video.close();
        }
        consumersRef.current.video = consumer;
      } else if (consumerKind === "audio") {
        // Close previous audio consumer if exists
        if (consumersRef.current.audio) {
          consumersRef.current.audio.close();
        }
        consumersRef.current.audio = consumer;
      }

      // Resume the consumer (it starts in paused state)
      try {
        await socketPromise(socket, "resumeConsumer", {
          consumerId: consumer.id,
          streamId,
        });
      } catch (err) {
        const typedError = err as Error;
        logWarn(`Error resuming consumer: ${typedError.message}`);
      }

      // Create a MediaStream from the consumer track
      const stream = new MediaStream([consumer.track]);

      logInfo("Consumed media track details", {
        kind: consumer.track.kind,
        label: consumer.track.label,
        enabled: consumer.track.enabled,
        readyState: consumer.track.readyState,
        muted: consumer.track.muted,
        id: consumer.track.id,
      });

      // Display the stream in the video element
      const videoElement = getVideoElement();
      if (videoElement) {
        // If we already have a stream with another track type, add this track to it
        if (videoElement.srcObject instanceof MediaStream) {
          const existingStream = videoElement.srcObject as MediaStream;

          // Remove any existing tracks of the same kind before adding new one
          const existingTracks = consumerKind === 'video' 
            ? existingStream.getVideoTracks() 
            : existingStream.getAudioTracks();
            
          existingTracks.forEach((track) => existingStream.removeTrack(track));

          // Add the new track
          existingStream.addTrack(consumer.track);
          
          logInfo(`Added ${consumerKind} track to existing stream`, {
            totalTracks: existingStream.getTracks().length
          });
        } else {
          // Otherwise set this as the source stream
          videoElement.srcObject = stream;
          logInfo(`Set video element srcObject with new ${consumerKind} stream`);
        }

        // Attempt to play the video and capture any autoplay issues
        try {
          await videoElement.play();
          if (onAutoplayBlocked) {
            onAutoplayBlocked(false);
          }
          
          if (onStreamReady) {
            onStreamReady();
          }
        } catch (playErr) {
          logWarn("Autoplay blocked, user interaction needed", {
            error: (playErr as Error).message
          });
          
          if (onAutoplayBlocked) {
            onAutoplayBlocked(true);
          }
        }
      }

      // Notify parent component
      if (onConsumerCreated) {
        onConsumerCreated(consumerKind, consumer);
      }

      return consumer;
    } catch (err) {
      const typedError = err as Error;
      logError(`Error consuming producer ${producerId}`, {
        error: typedError.message
      });
      
      // Report error to parent component
      if (onConnectionError) {
        onConnectionError({
          type: "CONSUME_FAILED",
          message: `Failed to receive media stream: ${typedError.message}`,
          details: typedError
        });
      }
      
      return null;
    }
  }, [
    socket, 
    deviceRef, 
    streamId, 
    getVideoElement, 
    onConsumerCreated, 
    onStreamReady, 
    onAutoplayBlocked,
    onConnectionError
  ]);

  /**
   * Set up appropriate transport based on role
   */
  useEffect(() => {
    if (!socket || !deviceRef.current?.loaded || !socket.connected) {
      return;
    }

    const setupTransport = async () => {
      if (isStreamer) {
        // For streamers, create producer transport
        const transport = await setupProducerTransport();
        if (transport && localStreamRef.current) {
          // If we have a local stream, produce it
          await produceLocalMedia();
        }
      } else {
        // For viewers, create consumer transport
        await setupConsumerTransport();
      }
    };

    setupTransport();
  }, [
    socket, 
    deviceRef, 
    isStreamer, 
    setupProducerTransport, 
    setupConsumerTransport, 
    localStreamRef, 
    produceLocalMedia
  ]);

  // Setup event listeners for producer/consumer events
  useEffect(() => {
    if (!socket) return;

    // For viewers, listen for new producers
    const onNewProducer = ({ producerId, kind }: { producerId: string; kind: string }) => {
      logInfo("New producer available", { producerId, kind });
      if (transportRef.current.consumer) {
        consumeProducer(producerId, kind as 'audio' | 'video');
      }
    };

    // For viewers, listen for producer closed
    const onProducerClosed = ({ producerId }: { producerId: string }) => {
      logInfo("Producer closed", { producerId });
      
      // Check if this producer is one of our consumers
      const videoConsumer = consumersRef.current.video;
      const audioConsumer = consumersRef.current.audio;
      
      if (videoConsumer && videoConsumer.producerId === producerId) {
        videoConsumer.close();
        consumersRef.current.video = null;
      }
      
      if (audioConsumer && audioConsumer.producerId === producerId) {
        audioConsumer.close();
        consumersRef.current.audio = null;
      }
    };

    // Register event listeners
    if (!isStreamer) {
      socket.on("newProducer", onNewProducer);
      socket.on("producerClosed", onProducerClosed);
    }

    // Clean up
    return () => {
      socket.off("newProducer", onNewProducer);
      socket.off("producerClosed", onProducerClosed);
    };
  }, [socket, isStreamer, consumeProducer]);

  // Cleanup function for when component unmounts
  useEffect(() => {
    return () => {
      // Close all producers
      if (producersRef.current.video) {
        producersRef.current.video.close();
      }
      
      if (producersRef.current.audio) {
        producersRef.current.audio.close();
      }
      
      // Close all consumers
      if (consumersRef.current.video) {
        consumersRef.current.video.close();
      }
      
      if (consumersRef.current.audio) {
        consumersRef.current.audio.close();
      }
      
      // Close all transports
      if (transportRef.current.producer) {
        transportRef.current.producer.close();
      }
      
      if (transportRef.current.consumer) {
        transportRef.current.consumer.close();
      }
      
      // Reset refs
      producersRef.current = { video: null, audio: null, setupInProgress: false };
      consumersRef.current = { video: null, audio: null };
      transportRef.current = { producer: null, consumer: null };
      
      // Run any cleanup functions
      cleanupRef.current.forEach(cleanup => cleanup());
      cleanupRef.current = [];
    };
  }, []);

  // Expose the necessary functions and state
  return {
    transportRef,
    producersRef,
    consumersRef,
    transportReady,
    produceLocalMedia,
    requestAvailableProducers,
    consumeProducer
  };
} 