import { NextRequest } from "next/server";

import { getRequestUser } from "@/lib/studybuddy/auth";
import { classifyStudyStyles } from "@/lib/studybuddy/ai";
import { badRequest, ok, unauthorized } from "@/lib/studybuddy/http";
import {
  getProfile,
  getProfileSubjects,
  getStudyStyles,
  isProfileComplete,
  upsertProfile,
  upsertStudyStyles,
} from "@/lib/studybuddy/store";
import { type AcademicYear } from "@/lib/studybuddy/types";

function isAcademicYear(value: string): value is AcademicYear {
  return ["freshman", "sophomore", "junior", "senior", "grad"].includes(value);
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return unauthorized();
  }
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return badRequest("Invalid JSON body.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const school = typeof body.school === "string" ? body.school.trim() : "";
  const major = typeof body.major === "string" ? body.major.trim() : "";
  const year = typeof body.year === "string" ? body.year.trim().toLowerCase() : "";
  const bio = typeof body.bio === "string" ? body.bio.trim() : "";
  const subjects: unknown[] = Array.isArray(body.subjects) ? body.subjects : [];

  if (!name) {
    return badRequest("Name is required.");
  }

  const normalizedYear = isAcademicYear(year) ? year : "freshman";
  const subjectList = subjects.filter((subject): subject is string => typeof subject === "string");

  await upsertProfile(user.id, {
    name,
    school,
    major,
    year: normalizedYear,
    bio,
    subjects: subjectList,
  });

  // AI-powered study style classification from bio
  try {
    const styles = await classifyStudyStyles(bio, major, normalizedYear);
    await upsertStudyStyles(user.id, styles);
  } catch {
    // If AI fails, matching still works without study styles
    console.error("[AI] Study style classification failed for user", user.id);
  }

  return ok({
    user,
    profile: await getProfile(user.id),
    subjects: await getProfileSubjects(user.id),
    studyStyles: await getStudyStyles(user.id),
    profileCompleted: await isProfileComplete(user.id),
  });
}
