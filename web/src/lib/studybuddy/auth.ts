import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getUser } from "@/lib/studybuddy/store";
import { type AuthSessionUser } from "@/lib/studybuddy/types";

export const SESSION_COOKIE_NAME = "studybuddy_session";

export async function getRequestUser(request: NextRequest): Promise<AuthSessionUser | null> {
  const headerUserId = request.headers.get("x-studybuddy-user-id")?.trim();
  if (headerUserId) {
    const user = await getUser(headerUserId);
    return user ? { ...user, authSource: "header" } : null;
  }

  const sessionUserId = request.cookies.get(SESSION_COOKIE_NAME)?.value?.trim();
  if (!sessionUserId) {
    return null;
  }

  const user = await getUser(sessionUserId);
  return user ? { ...user, authSource: "cookie" } : null;
}

export function applySessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
