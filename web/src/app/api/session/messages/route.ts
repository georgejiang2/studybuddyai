import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, ok, unauthorized, notFound } from "@/lib/studybuddy/http";
import {
  getSession,
  getMatch,
  getProfile,
  createSessionMessage,
  listSessionMessages,
} from "@/lib/studybuddy/store";

async function validateSessionAccess(userId: string, sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return null;

  const match = await getMatch(session.matchId);
  if (!match || (match.userA !== userId && match.userB !== userId)) return null;

  return { session, match };
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
  if (!sessionId) {
    return badRequest("sessionId query param is required.");
  }

  const access = await validateSessionAccess(user.id, sessionId);
  if (!access) {
    return notFound("Session not found or access denied.");
  }

  return ok({ messages: await listSessionMessages(sessionId) });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const sessionId =
    body && typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const text = body && typeof body.text === "string" ? body.text.trim() : "";

  if (!sessionId || !text) {
    return badRequest("sessionId and text are required.");
  }

  const access = await validateSessionAccess(user.id, sessionId);
  if (!access) {
    return notFound("Session not found or access denied.");
  }

  const profile = await getProfile(user.id);
  const senderName = profile?.name ?? user.email;

  return ok({
    message: await createSessionMessage(sessionId, user.id, senderName, text),
  });
}
