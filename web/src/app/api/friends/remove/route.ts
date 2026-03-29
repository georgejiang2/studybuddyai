import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, notFound, ok, unauthorized } from "@/lib/studybuddy/http";
import {
  listFriendshipsForUser,
  deleteFriendship,
} from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  const body = await request.json().catch(() => null);
  const friendshipId =
    body && typeof body.friendshipId === "string" ? body.friendshipId.trim() : "";

  if (!friendshipId) {
    return badRequest("Provide friendshipId.");
  }

  const friendships = await listFriendshipsForUser(user.id);
  const friendship = friendships.find(
    (candidate) => candidate.id === friendshipId,
  );
  if (!friendship) {
    return notFound("Friendship not found.");
  }

  // Either party can unfriend
  if (friendship.requesterId !== user.id && friendship.recipientId !== user.id) {
    return unauthorized("You are not part of this friendship.");
  }

  await deleteFriendship(friendshipId);

  return ok({ success: true });
}
