import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, notFound, ok, unauthorized } from "@/lib/studybuddy/http";
import { getCall, getProfile } from "@/lib/studybuddy/store";
import { getSessionJoinPayload } from "@/lib/studybuddy/session";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();

  const callId = request.nextUrl.searchParams.get("callId")?.trim() ?? "";
  if (!callId) return badRequest("callId query param is required.");

  const call = await getCall(callId);
  if (!call || call.callerId !== user.id) {
    return notFound("Call not found.");
  }

  if (call.status === "accepted") {
    const sessionJoinPayload = await getSessionJoinPayload(call.sessionId, user.id);
    const partnerProfile = await getProfile(call.recipientId);
    return ok({ call, sessionJoinPayload, partnerProfile });
  }

  return ok({ call, sessionJoinPayload: null, partnerProfile: null });
}
