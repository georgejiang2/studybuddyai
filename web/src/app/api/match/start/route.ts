import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, conflict, ok, unauthorized } from "@/lib/studybuddy/http";
import { findOrCreateMatch } from "@/lib/studybuddy/matching";
import {
  getActiveSessionForUser,
  hasSavedSubject,
  isProfileComplete,
  upsertQueueEntry,
} from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  const body = await request.json().catch(() => null);
  const currentSubject =
    body && typeof body.currentSubject === "string"
      ? body.currentSubject.trim()
      : "";

  if (!isProfileComplete(user.id)) {
    return badRequest("Complete your profile before entering the queue.");
  }

  if (!currentSubject) {
    return badRequest("currentSubject is required.");
  }

  if (!hasSavedSubject(user.id, currentSubject)) {
    return badRequest("currentSubject must be one of the subjects on your profile.");
  }

  if (getActiveSessionForUser(user.id)) {
    return conflict("You already have an active session.");
  }

  upsertQueueEntry(user.id, currentSubject);

  return ok(findOrCreateMatch(user.id));
}
