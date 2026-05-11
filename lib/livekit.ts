import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const httpUrl = process.env.LIVEKIT_HTTP_URL;
const wsUrl = process.env.LIVEKIT_WS_URL;

/** Names of env vars required for issuing join tokens (no secret values). */
export function getMissingLiveKitTokenEnv(): string[] {
  const missing: string[] = [];
  if (!wsUrl?.trim()) missing.push("LIVEKIT_WS_URL");
  if (!apiKey?.trim()) missing.push("LIVEKIT_API_KEY");
  if (!apiSecret?.trim()) missing.push("LIVEKIT_API_SECRET");
  return missing;
}

export function getLiveKitWsUrl(): string {
  if (!wsUrl?.trim()) throw new Error("LIVEKIT_WS_URL is not configured");
  return wsUrl.trim();
}

export function getLiveKitRoomService(): RoomServiceClient {
  if (!httpUrl || !apiKey || !apiSecret) {
    throw new Error("LIVEKIT_HTTP_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET missing");
  }
  return new RoomServiceClient(httpUrl, apiKey, apiSecret);
}

export async function buildLiveKitToken(params: {
  roomName: string;
  identity: string;
  name?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
}): Promise<string> {
  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY/LIVEKIT_API_SECRET missing");
  }
  const token = new AccessToken(apiKey, apiSecret, {
    identity: params.identity,
    name: params.name,
    ttl: "2h",
  });

  token.addGrant({
    room: params.roomName,
    roomJoin: true,
    canPublish: params.canPublish ?? true,
    canSubscribe: params.canSubscribe ?? true,
    canPublishData: params.canPublishData ?? true,
  });

  return await token.toJwt();
}
