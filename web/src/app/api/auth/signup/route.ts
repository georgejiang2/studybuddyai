import { NextRequest, NextResponse } from "next/server";

import { applySessionCookie } from "@/lib/studybuddy/auth";
import { ensureInitialized } from "@/lib/studybuddy/db";
import { badRequest, conflict } from "@/lib/studybuddy/http";
import { createUserAccount } from "@/lib/studybuddy/store";

export async function POST(request: NextRequest) {
  await ensureInitialized();
  const body = await request.json().catch(() => null);
  const email = body && typeof body.email === "string" ? body.email.trim() : "";
  const password =
    body && typeof body.password === "string" ? body.password.trim() : "";

  if (!email || !password || password.length < 8) {
    return badRequest("Signup requires an email and a password with at least 8 characters.");
  }

  const user = await createUserAccount(email, password);
  if (!user) {
    return conflict("An account with that email already exists.");
  }

  return applySessionCookie(
    NextResponse.json(
      {
        user,
        profileCompleted: false,
      },
      { status: 201 },
    ),
    user.id,
  );
}
