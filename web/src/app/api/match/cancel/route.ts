import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { ok, unauthorized } from "@/lib/studybuddy/http";
import { removeQueueEntry } from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  removeQueueEntry(user.id);

  return ok({
    status: "idle",
    message: "Queue entry removed.",
  });
}
