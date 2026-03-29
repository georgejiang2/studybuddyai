import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, ok, unauthorized, notFound } from "@/lib/studybuddy/http";
import {
  endSession,
  getSession,
  getMatch,
  getPartnerUserId,
  endCallBySessionId,
  recordSkip,
} from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const sessionId =
    body && typeof body.sessionId === "string" ? body.sessionId.trim() : "";

  if (!sessionId) {
    return badRequest("sessionId is required.");
  }

  const session = await getSession(sessionId);
  if (!session) {
    return notFound("Session not found.");
  }

  const match = await getMatch(session.matchId);
  if (!match || (match.userA !== user.id && match.userB !== user.id)) {
    return unauthorized("You are not part of this session.");
  }

  // Record the skip so matching avoids this pair temporarily
  const partnerId = getPartnerUserId(match, user.id);
  await recordSkip(user.id, partnerId);

  // End the session
  const ended = await endSession(sessionId);
  await endCallBySessionId(sessionId);

  return ok({ session: ended });
}
