import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, conflict, ok, unauthorized } from "@/lib/studybuddy/http";
import {
  getFriendshipBetween,
  getActiveSessionForUser,
  getOutgoingCall,
  getIncomingCall,
  getProfile,
  createMatch,
  createSession,
  createCall,
} from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const recipientId = body && typeof body.recipientId === "string" ? body.recipientId.trim() : "";
  if (!recipientId) return badRequest("recipientId is required.");

  const friendship = await getFriendshipBetween(user.id, recipientId);
  if (!friendship || friendship.status !== "accepted") {
    return badRequest("You can only call accepted friends.");
  }

  if (await getActiveSessionForUser(user.id)) {
    return conflict("You already have an active session.");
  }

  if (await getOutgoingCall(user.id)) {
    return conflict("You already have an outgoing call.");
  }

  if (await getIncomingCall(recipientId)) {
    return conflict("This friend is already receiving a call.");
  }

  const callerProfile = await getProfile(user.id);
  const callerName = callerProfile?.name ?? "Someone";

  const match = await createMatch(user.id, recipientId, "friend_call", `Call from ${callerName}`);
  const session = await createSession(match.id);
  const call = await createCall(user.id, recipientId, match.id, session.id);

  return ok({ call });
}
