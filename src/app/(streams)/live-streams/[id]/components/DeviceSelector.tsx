"use client";

import React, { useEffect, useState, useRef } from "react";
import { Check, RefreshCw, VideoIcon, Mic, Volume2 } from "lucide-react";

interface DeviceSelectorProps {
  onDeviceChange: (type: "audio" | "video", deviceId: string) => void;
  initialVideoDeviceId?: string;
  initialAudioDeviceId?: string;
}

export default function DeviceSelector({
  onDeviceChange,
  initialVideoDeviceId,
  initialAudioDeviceId,
}: DeviceSelectorProps) {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | undefined>(
    initialVideoDeviceId
  );
  const [selectedAudio, setSelectedAudio] = useState<string | undefined>(
    initialAudioDeviceId
  );
  const [isLoading, setIsLoading] = useState(true);
  const [testVideoStream, setTestVideoStream] = useState<MediaStream | null>(
    null
  );
  const [testAudioStream, setTestAudioStream] = useState<MediaStream | null>(
    null
  );
  const [showTestVideo, setShowTestVideo] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add a useRef for the video element
  const videoRef = useRef<HTMLVideoElement>(null);

  // Get available devices
  const getDevices = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First request permissions
      await navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .catch((err) => {
          console.warn("Permission request had an error, but continuing", err);
          // Continue anyway to see what devices we can access
        });

      const devices = await navigator.mediaDevices.enumerateDevices();

      const videos = devices.filter((device) => device.kind === "videoinput");
      const audios = devices.filter((device) => device.kind === "audioinput");

      setVideoDevices(videos);
      setAudioDevices(audios);

      // If no device is selected yet and we have devices available, select the first one
      if (!selectedVideo && videos.length > 0) {
        setSelectedVideo(videos[0].deviceId);
        onDeviceChange("video", videos[0].deviceId);
      }

      if (!selectedAudio && audios.length > 0) {
        setSelectedAudio(audios[0].deviceId);
        onDeviceChange("audio", audios[0].deviceId);
      }
    } catch (err) {
      console.error("Error getting devices:", err);
      setError("Failed to access media devices. Please check permissions.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Test video device
  const testVideoDevice = async () => {
    try {
      // Stop any existing test stream
      if (testVideoStream) {
        testVideoStream.getTracks().forEach((track) => track.stop());
      }

      // Start a new test stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true,
        audio: false,
      });

      setTestVideoStream(stream);
      setShowTestVideo(true);
      setError(null);
    } catch (err) {
      console.error("Error testing video device:", err);
      setError(`Video device error: ${(err as Error).message}`);
      setShowTestVideo(false);
      setTestVideoStream(null);
    }
  };

  // Test audio device with level meter
  const testAudioDevice = async () => {
    try {
      // Stop any existing test stream
      if (testAudioStream) {
        testAudioStream.getTracks().forEach((track) => track.stop());
      }

      // Start a new test stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true,
      });

      setTestAudioStream(stream);

      // Create audio context for level meter
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Update audio level at regular intervals
      const updateLevel = () => {
        if (!testAudioStream) return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioLevel(average);

        requestAnimationFrame(updateLevel);
      };

      updateLevel();
      setError(null);
    } catch (err) {
      console.error("Error testing audio device:", err);
      setError(`Audio device error: ${(err as Error).message}`);
      setTestAudioStream(null);
      setAudioLevel(0);
    }
  };

  // Stop test streams
  const stopTests = () => {
    if (testVideoStream) {
      testVideoStream.getTracks().forEach((track) => track.stop());
      setTestVideoStream(null);
      setShowTestVideo(false);
    }

    if (testAudioStream) {
      testAudioStream.getTracks().forEach((track) => track.stop());
      setTestAudioStream(null);
      setAudioLevel(0);
    }
  };

  // Refresh device list
  const refreshDevices = () => {
    setRefreshing(true);
    stopTests();
    getDevices();
  };

  // Handle device selection
  const handleVideoChange = (deviceId: string) => {
    setSelectedVideo(deviceId);
    onDeviceChange("video", deviceId);
    // Stop any ongoing tests
    stopTests();
  };

  const handleAudioChange = (deviceId: string) => {
    setSelectedAudio(deviceId);
    onDeviceChange("audio", deviceId);
    // Stop any ongoing tests
    stopTests();
  };

  // Add a useEffect to set the srcObject when the stream changes
  useEffect(() => {
    if (videoRef.current && testVideoStream) {
      videoRef.current.srcObject = testVideoStream;
    }
  }, [testVideoStream]);

  // Load devices on mount
  useEffect(() => {
    getDevices();

    // Navigator.mediaDevices.ondevicechange event
    const handleDeviceChange = () => {
      console.log("Media devices changed, refreshing list");
      refreshDevices();
    };

    // Add event listener for device changes
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    // Cleanup
    return () => {
      stopTests();
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-sm">Media Settings</h3>
        <button
          onClick={refreshDevices}
          className={`text-xs p-1 rounded-md bg-muted/50 hover:bg-muted ${
            refreshing ? "animate-spin" : ""
          }`}
          disabled={refreshing}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {error && (
        <div className="text-destructive text-xs p-2 bg-destructive/10 rounded-md mb-2">
          {error}
        </div>
      )}

      {/* Video device selector */}
      <div className="space-y-2">
        <label className="flex items-center justify-between text-xs font-medium">
          <span className="flex items-center">
            <VideoIcon size={14} className="mr-1" /> Camera
          </span>
          {showTestVideo ? (
            <button
              onClick={() => {
                stopTests();
                setShowTestVideo(false);
              }}
              className="text-xs px-2 py-1 bg-destructive/20 rounded hover:bg-destructive/30"
            >
              Stop Test
            </button>
          ) : (
            <button
              onClick={testVideoDevice}
              className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded"
              disabled={!selectedVideo || isLoading}
            >
              Test
            </button>
          )}
        </label>

        {showTestVideo && testVideoStream && (
          <div className="relative h-24 bg-black rounded-md overflow-hidden mb-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <select
          value={selectedVideo || ""}
          onChange={(e) => handleVideoChange(e.target.value)}
          className="w-full p-1.5 text-xs rounded-md bg-muted/50 border border-muted"
          disabled={isLoading}
        >
          {videoDevices.length === 0 && (
            <option value="">No cameras detected</option>
          )}
          {videoDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId.substring(0, 5)}...`}
            </option>
          ))}
        </select>
      </div>

      {/* Audio device selector */}
      <div className="space-y-2">
        <label className="flex items-center justify-between text-xs font-medium">
          <span className="flex items-center">
            <Mic size={14} className="mr-1" /> Microphone
          </span>
          {testAudioStream ? (
            <button
              onClick={() => {
                stopTests();
              }}
              className="text-xs px-2 py-1 bg-destructive/20 rounded hover:bg-destructive/30"
            >
              Stop Test
            </button>
          ) : (
            <button
              onClick={testAudioDevice}
              className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded"
              disabled={!selectedAudio || isLoading}
            >
              Test
            </button>
          )}
        </label>

        {testAudioStream && (
          <div className="h-4 bg-muted/50 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(audioLevel, 100)}%` }}
            ></div>
          </div>
        )}

        <select
          value={selectedAudio || ""}
          onChange={(e) => handleAudioChange(e.target.value)}
          className="w-full p-1.5 text-xs rounded-md bg-muted/50 border border-muted"
          disabled={isLoading}
        >
          {audioDevices.length === 0 && (
            <option value="">No microphones detected</option>
          )}
          {audioDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label ||
                `Microphone ${device.deviceId.substring(0, 5)}...`}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-2 text-xs text-muted-foreground">
        <p>
          If you're having issues, try closing other applications that might be
          using your camera or microphone.
        </p>
      </div>
    </div>
  );
}
