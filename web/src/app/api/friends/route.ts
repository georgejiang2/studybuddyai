import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { ok, unauthorized } from "@/lib/studybuddy/http";
import { getProfile, listFriendshipsForUser } from "@/lib/studybuddy/store";

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  const friendships = listFriendshipsForUser(user.id).map((friendship) => {
    const partnerId =
      friendship.requesterId === user.id
        ? friendship.recipientId
        : friendship.requesterId;

    return {
      ...friendship,
      partnerProfile: getProfile(partnerId),
    };
  });

  return ok({ friendships });
}
