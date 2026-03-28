import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { ok, unauthorized } from "@/lib/studybuddy/http";
import { getUserMatchStatus } from "@/lib/studybuddy/matching";
import {
  getProfile,
  getProfileSubjects,
  isProfileComplete,
  listFriendshipsForUser,
} from "@/lib/studybuddy/store";

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) {
    return unauthorized();
  }

  const friendships = listFriendshipsForUser(user.id).map((f) => {
    const partnerId =
      f.requesterId === user.id ? f.recipientId : f.requesterId;
    return {
      ...f,
      partnerProfile: getProfile(partnerId),
    };
  });

  return ok({
    user,
    profile: getProfile(user.id),
    subjects: getProfileSubjects(user.id),
    profileCompleted: isProfileComplete(user.id),
    matchStatus: getUserMatchStatus(user.id),
    friendships,
  });
}
