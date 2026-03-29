import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, notFound, ok, unauthorized } from "@/lib/studybuddy/http";
import {
  listFriendshipsForUser,
  updateFriendshipStatus,
} from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  const body = await request.json().catch(() => null);
  const friendshipId =
    body && typeof body.friendshipId === "string" ? body.friendshipId.trim() : "";
  const action = body && typeof body.action === "string" ? body.action.trim() : "";

  if (!friendshipId || !["accept", "reject"].includes(action)) {
    return badRequest("Provide friendshipId and an action of accept or reject.");
  }

  const friendships = await listFriendshipsForUser(user.id);
  const friendship = friendships.find(
    (candidate) => candidate.id === friendshipId,
  );
  if (!friendship) {
    return notFound("Friend request not found.");
  }

  if (friendship.recipientId !== user.id) {
    return unauthorized("Only the recipient can respond to a friend request.");
  }

  return ok({
    friendship: await updateFriendshipStatus(
      friendship.id,
      action === "accept" ? "accepted" : "rejected",
    ),
  });
}
