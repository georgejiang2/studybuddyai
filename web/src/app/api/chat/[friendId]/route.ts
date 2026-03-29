import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { badRequest, notFound, ok, unauthorized } from "@/lib/studybuddy/http";
import {
  createMessage,
  getFriendshipBetween,
  listMessagesForFriendship,
} from "@/lib/studybuddy/store";

type RouteContext = {
  params: Promise<{
    friendId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  const { friendId } = await context.params;
  const friendship = await getFriendshipBetween(user.id, friendId);

  if (!friendship || friendship.status !== "accepted") {
    return notFound("Accepted friendship required to access chat.");
  }

  return ok({
    friendship,
    messages: await listMessagesForFriendship(friendship.id),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  const { friendId } = await context.params;
  const friendship = await getFriendshipBetween(user.id, friendId);

  if (!friendship || friendship.status !== "accepted") {
    return notFound("Accepted friendship required to send messages.");
  }

  const body = await request.json().catch(() => null);
  const text = body && typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return badRequest("Message text is required.");
  }

  return ok({
    message: await createMessage(friendship.id, user.id, friendId, text),
  });
}
