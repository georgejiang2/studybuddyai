import { createHmac } from "node:crypto";

import { getMatch, getSession, getSessionByMatchId } from "@/lib/studybuddy/store";

function base64Url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createSignedLiveKitToken(identity: string, roomName: string) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return `dev-livekit-token:${identity}:${roomName}`;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: apiKey,
      sub: identity,
      nbf: now,
      exp: now + 60 * 60,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      },
    }),
  );
  const signature = createHmac("sha256", apiSecret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${header}.${payload}.${signature}`;
}

export function getSessionJoinPayload(sessionId: string, userId: string) {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const match = getMatch(session.matchId);
  if (!match) {
    return null;
  }

  if (match.userA !== userId && match.userB !== userId) {
    return null;
  }

  return {
    sessionId: session.id,
    roomName: session.roomName,
    token: createSignedLiveKitToken(userId, session.roomName),
    partnerId: match.userA === userId ? match.userB : match.userA,
  };
}

export function getSessionJoinPayloadForMatch(matchId: string, userId: string) {
  const session = getSessionByMatchId(matchId);
  if (!session) {
    return null;
  }

  return getSessionJoinPayload(session.id, userId);
}
