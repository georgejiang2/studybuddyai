import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { ok, unauthorized } from "@/lib/studybuddy/http";
import { getProfile, listFriendshipsForUser } from "@/lib/studybuddy/store";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  const friendshipList = await listFriendshipsForUser(user.id);
  const friendships = await Promise.all(
    friendshipList.map(async (friendship) => {
      const partnerId =
        friendship.requesterId === user.id
          ? friendship.recipientId
          : friendship.requesterId;

      return {
        ...friendship,
        partnerProfile: await getProfile(partnerId),
      };
    }),
  );

  return ok({ friendships });
}
