import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, notFound, ok, unauthorized } from "@/lib/studybuddy/http";
import {
  getSessionJoinPayload,
  getSessionJoinPayloadForMatch,
} from "@/lib/studybuddy/session";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  const body = await request.json().catch(() => null);
  const sessionId =
    body && typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const matchId = body && typeof body.matchId === "string" ? body.matchId.trim() : "";

  if (!sessionId && !matchId) {
    return badRequest("Provide sessionId or matchId.");
  }

  const payload = sessionId
    ? await getSessionJoinPayload(sessionId, user.id)
    : await getSessionJoinPayloadForMatch(matchId, user.id);

  if (!payload) {
    return notFound("No joinable session was found for this user.");
  }

  return ok(payload);
}
