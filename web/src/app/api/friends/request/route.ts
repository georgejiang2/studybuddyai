import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, ok, unauthorized } from "@/lib/studybuddy/http";
import {
  createFriendRequest,
  getFriendshipBetween,
  getUser,
  updateFriendshipStatus,
} from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  const body = await request.json().catch(() => null);
  const recipientId =
    body && typeof body.recipientId === "string" ? body.recipientId.trim() : "";

  if (!recipientId) {
    return badRequest("recipientId is required.");
  }

  if (recipientId === user.id) {
    return badRequest("You cannot friend yourself.");
  }

  if (!getUser(recipientId)) {
    return badRequest("Recipient does not exist.");
  }

  const existing = getFriendshipBetween(user.id, recipientId);
  if (existing) {
    if (existing.status === "pending" && existing.recipientId === user.id) {
      const accepted = updateFriendshipStatus(existing.id, "accepted");
      return ok({ friendship: accepted, autoAccepted: true });
    }
    return ok({ friendship: existing, reused: true });
  }

  return ok({
    friendship: createFriendRequest(user.id, recipientId),
  });
}
