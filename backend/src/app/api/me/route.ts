import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { ensureInitialized } from "@/lib/studybuddy/db";
import { ok, unauthorized } from "@/lib/studybuddy/http";
import { getUserMatchStatus } from "@/lib/studybuddy/matching";
import {
  getProfile,
  getProfileSubjects,
  getStudyStyles,
  isProfileComplete,
  listFriendshipsForUser,
} from "@/lib/studybuddy/store";

export async function GET(request: NextRequest) {
  await ensureInitialized();

  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }

  const friendshipList = await listFriendshipsForUser(user.id);
  const friendships = await Promise.all(
    friendshipList.map(async (f) => {
      const partnerId =
        f.requesterId === user.id ? f.recipientId : f.requesterId;
      return {
        ...f,
        partnerProfile: await getProfile(partnerId),
      };
    }),
  );

  return ok({
    user,
    profile: await getProfile(user.id),
    subjects: await getProfileSubjects(user.id),
    studyStyles: await getStudyStyles(user.id),
    profileCompleted: await isProfileComplete(user.id),
    matchStatus: await getUserMatchStatus(user.id),
    friendships,
  });
}
