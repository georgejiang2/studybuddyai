import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { ok, unauthorized } from "@/lib/studybuddy/http";
import { getUserMatchStatus } from "@/lib/studybuddy/matching";

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  return ok(getUserMatchStatus(user.id));
}
