import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { ok, unauthorized } from "@/lib/studybuddy/http";
import { expireStaleRingingCalls, getIncomingCall, getProfile } from "@/lib/studybuddy/store";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();

  await expireStaleRingingCalls();

  const call = await getIncomingCall(user.id);
  if (!call) {
    return ok({ call: null, callerProfile: null });
  }

  const callerProfile = await getProfile(call.callerId);
  return ok({
    call,
    callerProfile: callerProfile
      ? { name: callerProfile.name, school: callerProfile.school, major: callerProfile.major }
      : null,
  });
}
