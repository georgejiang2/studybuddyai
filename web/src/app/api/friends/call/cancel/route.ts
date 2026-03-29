import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, notFound, ok, unauthorized } from "@/lib/studybuddy/http";
import { getCall, updateCallStatus, endSession } from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const callId = body && typeof body.callId === "string" ? body.callId.trim() : "";
  if (!callId) return badRequest("callId is required.");

  const call = await getCall(callId);
  if (!call || call.callerId !== user.id || call.status !== "ringing") {
    return notFound("No ringing call found.");
  }

  await updateCallStatus(callId, "cancelled");
  await endSession(call.sessionId);

  return ok({ call: await getCall(callId) });
}
