import { NextRequest, NextResponse } from "next/server";

import { applySessionCookie } from "@/lib/studybuddy/auth";
import { ensureInitialized } from "@/lib/studybuddy/db";
import { badRequest, unauthorized } from "@/lib/studybuddy/http";
import { validateUserCredentials, isProfileComplete } from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  await ensureInitialized();
  const body = await request.json().catch(() => null);
  const email = body && typeof body.email === "string" ? body.email.trim() : "";
  const password =
    body && typeof body.password === "string" ? body.password.trim() : "";

  if (!email || !password) {
    return badRequest("Login requires email and password.");
  }

  const user = await validateUserCredentials(email, password);
  if (!user) {
    return unauthorized("Invalid email or password.");
  }

  return applySessionCookie(
    NextResponse.json({
      user,
      profileCompleted: await isProfileComplete(user.id),
    }),
    user.id,
  );
}
