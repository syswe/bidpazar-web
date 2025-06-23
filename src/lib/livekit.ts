// src/lib/livekit.ts
import { RoomServiceClient, AccessToken } from "livekit-server-sdk";

const livekitHost = process.env.LIVEKIT_URL || "http://localhost:7880";
const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
const apiSecret =
  process.env.LIVEKIT_API_SECRET ||
  "dev-secret-key-at-least-32-characters-long-for-security";

console.log("[LiveKit Config] Initialized with:", {
  host: livekitHost,
  apiKey: apiKey ? `${apiKey.substring(0, 6)}...` : "missing",
  apiSecret: apiSecret ? `${apiSecret.substring(0, 6)}...` : "missing",
  apiSecretLength: apiSecret?.length || 0,
});

if (!apiKey || !apiSecret || !livekitHost) {
  throw new Error(
    "LiveKit API anahtarları veya URL ortam değişkenlerinde tanımlanmamış."
  );
}

export const roomServiceClient = new RoomServiceClient(
  livekitHost,
  apiKey,
  apiSecret
);

/**
 * Bir kullanıcı için LiveKit erişim jetonu oluşturur.
 * @param roomName - Katılınacak odanın adı (streamId).
 * @param participantName - Katılımcının adı (kullanıcı adı).
 * @param isStreamer - Katılımcının yayıncı olup olmadığını belirtir.
 * @returns {Promise<string>} - Oluşturulan erişim jetonu.
 */
export async function createLiveKitToken(
  roomName: string,
  participantName: string,
  isStreamer: boolean = false
): Promise<string> {
  console.log(`[LiveKit Token] Creating token for:`, {
    roomName,
    participantName,
    isStreamer,
    apiKey: apiKey ? `${apiKey.substring(0, 6)}...` : "missing",
    secretLength: apiSecret?.length || 0,
  });

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName, // Kullanıcının kimliği, benzersiz olmalı
      name: participantName,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: isStreamer,
      canPublishData: isStreamer,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    console.log(
      `[LiveKit Token] Token created successfully for ${participantName} (length: ${token.length})`
    );

    return token;
  } catch (error) {
    console.error("[LiveKit Token] Error creating token:", error);
    throw error;
  }
}
