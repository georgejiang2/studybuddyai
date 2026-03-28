import { NextRequest, NextResponse } from "next/server";

import { applySessionCookie } from "@/lib/studybuddy/auth";
import { badRequest, unauthorized } from "@/lib/studybuddy/http";
import { validateUserCredentials, isProfileComplete } from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body && typeof body.email === "string" ? body.email.trim() : "";
  const password =
    body && typeof body.password === "string" ? body.password.trim() : "";

  if (!email || !password) {
    return badRequest("Login requires email and password.");
  }

  const user = validateUserCredentials(email, password);
  if (!user) {
    return unauthorized("Invalid email or password.");
  }

  return applySessionCookie(
    NextResponse.json({
      user,
      profileCompleted: isProfileComplete(user.id),
    }),
    user.id,
  );
}
