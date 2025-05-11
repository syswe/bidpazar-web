import { useCallback, useEffect, useRef, useState } from "react";
import * as mediasoupClient from "mediasoup-client";
import { logInfo, logError, logWarn } from "../utils/logging";
import { LogData } from "../types";

interface UseMediasoupDeviceProps {
  onDeviceLoaded?: (device: mediasoupClient.Device) => void;
  onDeviceLoadFailed?: (error: any) => void;
}

export function useMediasoupDevice({
  onDeviceLoaded,
  onDeviceLoadFailed
}: UseMediasoupDeviceProps = {}) {
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const rtpCapabilitiesRef = useRef<mediasoupClient.types.RtpCapabilities | null>(null);
  const deviceErrorRef = useRef<boolean>(false);
  const [isDeviceLoaded, setIsDeviceLoaded] = useState<boolean>(false);

  // Initialize MediaSoup device with router capabilities
  const initializeMediasoupDevice = useCallback(
    async (routerRtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
      try {
        // Add more detailed logging
        logInfo("Initializing MediaSoup device with router capabilities", {
          hasDeviceRef: !!deviceRef.current,
          deviceLoaded: deviceRef.current?.loaded,
          hasDeviceError: deviceErrorRef.current,
        });

        // If device was previously initialized and failed, create a new one
        if (deviceErrorRef.current) {
          logWarn("Previous device had errors, creating a fresh one");
          deviceRef.current = new mediasoupClient.Device();
          // Reset error flag
          deviceErrorRef.current = false;
        }

        // Create device if needed
        if (!deviceRef.current) {
          logInfo("Creating new MediaSoup device");
          deviceRef.current = new mediasoupClient.Device();
        }

        // Only load the device if it's not loaded yet
        if (!deviceRef.current.loaded) {
          try {
            logInfo("Loading device with RTP capabilities", {
              routerRtpCapabilities: {
                codecs: routerRtpCapabilities.codecs?.map((c) => c.mimeType),
                headerExtensions:
                  routerRtpCapabilities.headerExtensions?.length,
              },
            });

            await deviceRef.current.load({ routerRtpCapabilities });

            // Store RTP capabilities for future reference
            rtpCapabilitiesRef.current = routerRtpCapabilities;

            logInfo("MediaSoup device initialized successfully", {
              canProduceVideo: deviceRef.current.canProduce("video"),
              canProduceAudio: deviceRef.current.canProduce("audio"),
              loaded: deviceRef.current.loaded,
            });

            setIsDeviceLoaded(true);
            
            // Call the callback if provided
            if (onDeviceLoaded && deviceRef.current) {
              onDeviceLoaded(deviceRef.current);
            }
          } catch (deviceErr: any) {
            logError(
              `Failed to load MediaSoup device: ${
                deviceErr.message || "Unknown error"
              }`,
              deviceErr
            );
            
            // Mark device error state
            deviceErrorRef.current = true;
            setIsDeviceLoaded(false);
            
            // Call the failure callback if provided
            if (onDeviceLoadFailed) {
              onDeviceLoadFailed(deviceErr);
            }
            
            throw deviceErr;
          }
        } else {
          logInfo("MediaSoup device already loaded", {
            canProduceVideo: deviceRef.current.canProduce("video"),
            canProduceAudio: deviceRef.current.canProduce("audio"),
          });
          
          // Even if already loaded, ensure the callback is called
          if (onDeviceLoaded && deviceRef.current) {
            onDeviceLoaded(deviceRef.current);
          }
        }

        return deviceRef.current;
      } catch (err) {
        logError("Error initializing MediaSoup device", {
          error: err instanceof Error ? err.message : String(err)
        } as LogData);
        deviceErrorRef.current = true;
        setIsDeviceLoaded(false);
        throw err;
      }
    },
    [onDeviceLoaded, onDeviceLoadFailed]
  );

  // Reset the device when component unmounts
  useEffect(() => {
    return () => {
      // Clean up device reference
      logInfo("Cleaning up MediaSoup device reference");
      deviceRef.current = null;
      rtpCapabilitiesRef.current = null;
      deviceErrorRef.current = false;
    };
  }, []);

  return {
    deviceRef,
    rtpCapabilitiesRef,
    isDeviceLoaded,
    initializeMediasoupDevice,
  };
} 