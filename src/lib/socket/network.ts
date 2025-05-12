import { Socket } from "socket.io";
import { types as MediasoupTypes } from "mediasoup";
import { logger } from "@/lib/logger";
import { mediasoupAppConfig } from './types';

/**
 * Checks if an IP address is a loopback address
 */
export const isLoopbackAddress = (address?: string): boolean => {
  if (!address) return false;

  // Remove IPv6 brackets if present
  if (address.startsWith("[") && address.endsWith("]")) {
    address = address.substring(1, address.length - 1);
  }

  return (
    address === "localhost" ||
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "0.0.0.0" ||
    address === "::" ||
    // Also check for full IPv6 localhost
    address === "0:0:0:0:0:0:0:1"
  );
};

/**
 * Determines appropriate ICE configuration based on connection type
 */
export const getAppropriateIceConfiguration = (
  socket: Socket
): MediasoupTypes.WebRtcTransportOptions => {
  const baseConfig = { ...mediasoupAppConfig.webRtcTransport };

  // Check if this is a loopback connection
  const clientIp =
    socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
  const host = socket.handshake.headers.host;
  const isLoopback =
    socket.data?.isLoopback ||
    isLoopbackAddress(clientIp as string) ||
    isLoopbackAddress(host?.split(":")[0]);

  // For loopback connections, adjust the configuration to be more reliable
  if (isLoopback) {
    logger.info(
      `Using optimized WebRTC transport config for loopback connection: ${socket.id}`
    );

    // When connecting from the same machine, we need to use the ANNOUNCED_IP
    // more carefully to avoid ICE connectivity issues
    const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1";

    return {
      ...baseConfig,
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
          announcedIp: announcedIp,
        },
      ],
      // For localhost testing, these settings help with connection reliability
      enableUdp: true,
      enableTcp: true,
      preferUdp: false, // On loopback, TCP can be more reliable
      initialAvailableOutgoingBitrate: 1000000, // 1 Mbps
    };
  }

  // Regular configuration for non-loopback connections
  return {
    ...baseConfig,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: baseConfig.initialAvailableOutgoingBitrate,
  };
}; 