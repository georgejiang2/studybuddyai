import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, notFound, ok, unauthorized } from "@/lib/studybuddy/http";
import { getCall, updateCallStatus, endSession } from "@/lib/studybuddy/store";
import { getSessionJoinPayload } from "@/lib/studybuddy/session";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const callId = body && typeof body.callId === "string" ? body.callId.trim() : "";
  const action = body && typeof body.action === "string" ? body.action.trim() : "";

  if (!callId || !["accept", "decline"].includes(action)) {
    return badRequest("Provide callId and action (accept or decline).");
  }

  const call = await getCall(callId);
  if (!call || call.recipientId !== user.id || call.status !== "ringing") {
    return notFound("No ringing call found.");
  }

  if (action === "decline") {
    await updateCallStatus(callId, "declined");
    await endSession(call.sessionId);
    return ok({ call: await getCall(callId) });
  }

  // Accept
  await updateCallStatus(callId, "accepted");
  const sessionJoinPayload = await getSessionJoinPayload(call.sessionId, user.id);

  return ok({
    call: await getCall(callId),
    sessionJoinPayload,
  });
}
