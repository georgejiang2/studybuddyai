import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, ok, unauthorized, notFound } from "@/lib/studybuddy/http";
import { getSession, getMatch } from "@/lib/studybuddy/store";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
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

  return ok({
    status: session.status,
    endReason: session.endReason,
    endedBy: session.endedBy,
    skippedByPartner: session.endReason === "skipped" && session.endedBy !== user.id,
  });
}
