"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AuthMode = "login" | "signup";
type AcademicYear = "freshman" | "sophomore" | "junior" | "senior" | "grad";
type MatchType = "same_subject" | "expanded";
type MatchState = "idle" | "waiting" | "matched" | "in_session";

interface User {
  id: string;
  email: string;
}

interface Profile {
  userId: string;
  name: string;
  school: string;
  major: string;
  year: AcademicYear;
  bio: string;
  updatedAt: string;
}

interface PartnerProfile {
  userId: string;
  name: string;
  school: string;
  major: string;
  year: AcademicYear;
  bio: string;
  subjects: string[];
}

interface MatchStatus {
  status: MatchState;
  matchId: string | null;
  matchType: MatchType | null;
  reason: string | null;
  partnerProfile: PartnerProfile | null;
  queuedAt: string | null;
  currentSubject: string | null;
  sessionId: string | null;
}

interface Friendship {
  id: string;
  requesterId: string;
  recipientId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
  partnerProfile: Profile | null;
}

interface ChatMessage {
  id: string;
  friendshipId: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
}

interface SessionPayload {
  sessionId: string;
  roomName: string;
  token: string;
  partnerId: string;
}

interface MeResponse {
  user: User;
  profile: Profile | null;
  subjects: string[];
  profileCompleted: boolean;
  matchStatus: MatchStatus;
}

const demoAccounts = [
  { email: "ava@studybuddy.dev", password: "demo12345", label: "Demo user 1" },
  { email: "miles@studybuddy.dev", password: "demo12345", label: "Demo user 2" },
  { email: "sofia@studybuddy.dev", password: "demo12345", label: "Demo user 3" },
];

const yearOptions: AcademicYear[] = [
  "freshman",
  "sophomore",
  "junior",
  "senior",
  "grad",
];

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data && typeof data.error === "string" ? data.error : "Request failed.";
    throw new Error(message);
  }
  return data as T;
}

function formatRelativeTime(iso: string | null) {
  if (!iso) {
    return null;
  }
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export default function StudyBuddyApp() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState(demoAccounts[0].email);
  const [authPassword, setAuthPassword] = useState(demoAccounts[0].password);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [selectedChatFriendId, setSelectedChatFriendId] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [currentSubject, setCurrentSubject] = useState("");
  const [sessionPayload, setSessionPayload] = useState<SessionPayload | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    school: "",
    major: "",
    year: "junior" as AcademicYear,
    bio: "",
    subjects: "",
  });

  const acceptedFriends = friendships.filter((friend) => friend.status === "accepted");
  const pendingIncoming = friendships.filter(
    (friend) =>
      friend.status === "pending" && me && friend.recipientId === me.user.id,
  );
  const pendingOutgoing = friendships.filter(
    (friend) =>
      friend.status === "pending" && me && friend.requesterId === me.user.id,
  );

  const activePartner = me?.matchStatus.partnerProfile ?? null;
  const selectedFriend = useMemo(
    () =>
      acceptedFriends.find(
        (friend) => friend.partnerProfile?.userId === selectedChatFriendId,
      ) ?? null,
    [acceptedFriends, selectedChatFriendId],
  );

  const refreshDashboard = useCallback(async () => {
    try {
      const meData = await readJson<MeResponse>("/api/me");
      setMe(meData);
      setCurrentSubject((existing) => existing || meData.subjects[0] || "");
      setProfileForm((existing) => ({
        name: meData.profile?.name || existing.name,
        school: meData.profile?.school || existing.school,
        major: meData.profile?.major || existing.major,
        year: meData.profile?.year || existing.year,
        bio: meData.profile?.bio || existing.bio,
        subjects: meData.subjects.join(", "),
      }));

      const friendData = await readJson<{ friendships: Friendship[] }>("/api/friends");
      setFriendships(friendData.friendships);

      if (!selectedChatFriendId) {
        const firstAccepted = friendData.friendships.find(
          (friend) => friend.status === "accepted" && friend.partnerProfile,
        );
        setSelectedChatFriendId(firstAccepted?.partnerProfile?.userId ?? null);
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Unable to refresh.";
      if (message === "Unauthorized") {
        setMe(null);
        setFriendships([]);
        setMessages([]);
        setSessionPayload(null);
        return;
      }
      setError(message);
    }
  }, [selectedChatFriendId]);

  const refreshChat = useCallback(async (friendId: string) => {
    try {
      const chatData = await readJson<{ messages: ChatMessage[] }>(
        `/api/chat/${friendId}`,
      );
      setMessages(chatData.messages);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Unable to load chat.";
      setError(message);
    }
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    if (!me) {
      return;
    }

    const interval = window.setInterval(() => {
      refreshDashboard();
      if (selectedChatFriendId) {
        refreshChat(selectedChatFriendId);
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [me, refreshChat, refreshDashboard, selectedChatFriendId]);

  useEffect(() => {
    if (selectedChatFriendId) {
      refreshChat(selectedChatFriendId);
    } else {
      setMessages([]);
    }
  }, [refreshChat, selectedChatFriendId]);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("auth");
    setError(null);
    setNotice(null);

    try {
      await readJson(
        authMode === "login" ? "/api/auth/login" : "/api/auth/signup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authEmail,
            password: authPassword,
          }),
        },
      );
      await refreshDashboard();
      setNotice(
        authMode === "login"
          ? "Signed in successfully."
          : "Account created. Finish your profile to start matching.",
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Auth failed.");
    } finally {
      setPending(null);
    }
  }

  async function handleLogout() {
    setPending("logout");
    setError(null);
    setNotice(null);
    try {
      await readJson("/api/auth/logout", { method: "POST" });
      setMe(null);
      setFriendships([]);
      setMessages([]);
      setSelectedChatFriendId(null);
      setSessionPayload(null);
      setNotice("Signed out.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Logout failed.");
    } finally {
      setPending(null);
    }
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("profile");
    setError(null);
    setNotice(null);

    try {
      await readJson("/api/auth/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileForm.name,
          school: profileForm.school,
          major: profileForm.major,
          year: profileForm.year,
          bio: profileForm.bio,
          subjects: profileForm.subjects
            .split(",")
            .map((subject) => subject.trim())
            .filter(Boolean),
        }),
      });
      await refreshDashboard();
      setNotice("Profile saved.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Profile save failed.",
      );
    } finally {
      setPending(null);
    }
  }

  async function handleStartQueue() {
    setPending("queue");
    setError(null);
    setNotice(null);
    setSessionPayload(null);

    try {
      const matchStatus = await readJson<MatchStatus>("/api/match/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSubject }),
      });
      await refreshDashboard();
      setNotice(
        matchStatus.status === "waiting"
          ? "You are in the queue. Open another browser or account to test matching."
          : "Match found.",
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to start queue.",
      );
    } finally {
      setPending(null);
    }
  }

  async function handleCancelQueue() {
    setPending("cancel-queue");
    setError(null);
    setNotice(null);
    try {
      await readJson("/api/match/cancel", { method: "POST" });
      await refreshDashboard();
      setNotice("Queue canceled.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to cancel queue.",
      );
    } finally {
      setPending(null);
    }
  }

  async function handleJoinSession() {
    if (!me?.matchStatus.matchId) {
      return;
    }
    setPending("session");
    setError(null);
    setNotice(null);
    try {
      const payload = await readJson<SessionPayload>("/api/session/create-or-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: me.matchStatus.matchId,
        }),
      });
      setSessionPayload(payload);
      setNotice("Session join payload ready.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to join session.",
      );
    } finally {
      setPending(null);
    }
  }

  async function handleFriendRequest(recipientId: string) {
    setPending("friend");
    setError(null);
    setNotice(null);
    try {
      await readJson("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      await refreshDashboard();
      setNotice("Friend request sent.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to send friend request.",
      );
    } finally {
      setPending(null);
    }
  }

  async function handleFriendResponse(friendshipId: string, action: "accept" | "reject") {
    setPending(`friend-${action}`);
    setError(null);
    setNotice(null);
    try {
      await readJson("/api/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, action }),
      });
      await refreshDashboard();
      setNotice(action === "accept" ? "Friend request accepted." : "Friend request rejected.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to respond to request.",
      );
    } finally {
      setPending(null);
    }
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChatFriendId || !messageDraft.trim()) {
      return;
    }

    setPending("message");
    setError(null);
    setNotice(null);
    try {
      await readJson(`/api/chat/${selectedChatFriendId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageDraft }),
      });
      setMessageDraft("");
      await refreshChat(selectedChatFriendId);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to send message.",
      );
    } finally {
      setPending(null);
    }
  }

  if (!me) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#17325b_0%,#0f172a_45%,#020617_100%)] px-6 py-16 text-white sm:px-10">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-8">
            <div className="space-y-4">
              <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-300/10 px-3 py-1 text-sm font-medium text-cyan-200">
                StudyBuddy end-to-end demo
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight">
                Sign in, build a profile, queue by subject, match, add a friend,
                and chat.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                Use two browsers or one normal window plus one incognito window to
                test the full flow. Matching is exact-subject for 2 minutes, then
                expands automatically.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthEmail(account.email);
                    setAuthPassword(account.password);
                  }}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
                >
                  <p className="text-sm font-semibold text-cyan-200">{account.label}</p>
                  <p className="mt-3 text-sm text-slate-300">{account.email}</p>
                  <p className="mt-1 font-mono text-sm text-slate-400">
                    {account.password}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-7 shadow-2xl backdrop-blur">
            <div className="flex gap-2 rounded-full bg-white/5 p-1 text-sm">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`flex-1 rounded-full px-4 py-2 ${
                  authMode === "login" ? "bg-white text-slate-950" : "text-slate-300"
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`flex-1 rounded-full px-4 py-2 ${
                  authMode === "signup" ? "bg-white text-slate-950" : "text-slate-300"
                }`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Email</span>
                <input
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none ring-0 placeholder:text-slate-500"
                  placeholder="you@school.edu"
                  type="email"
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-slate-300">Password</span>
                <input
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none ring-0 placeholder:text-slate-500"
                  placeholder="At least 8 characters"
                  type="password"
                  minLength={8}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={pending === "auth"}
                className="w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
              >
                {pending === "auth"
                  ? "Working..."
                  : authMode === "login"
                    ? "Enter StudyBuddy"
                    : "Create account"}
              </button>
            </form>

            {error ? (
              <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                {notice}
              </p>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_25%,#e2e8f0_100%)] px-5 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-[2rem] bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-cyan-700">
              StudyBuddy
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              {me.profile?.name || me.user.email}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {me.user.email}
              {me.profileCompleted ? ` · ${me.profile?.school}` : " · finish your profile"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
              Match state: <span className="font-semibold">{me.matchStatus.status}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </header>

        {error ? (
          <p className="rounded-3xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-3xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
            {notice}
          </p>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Profile</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Subjects saved here become the only valid choices when you
                    enter the study queue.
                  </p>
                </div>
                {me.profileCompleted ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Complete
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Setup required
                  </span>
                )}
              </div>

              <form onSubmit={handleProfileSave} className="mt-6 grid gap-4 md:grid-cols-2">
                <input
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Full name"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  required
                />
                <input
                  value={profileForm.school}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, school: event.target.value }))
                  }
                  placeholder="School"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  required
                />
                <input
                  value={profileForm.major}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, major: event.target.value }))
                  }
                  placeholder="Major"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  required
                />
                <select
                  value={profileForm.year}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      year: event.target.value as AcademicYear,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <textarea
                  value={profileForm.bio}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, bio: event.target.value }))
                  }
                  placeholder="Short bio"
                  className="min-h-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2"
                  required
                />
                <textarea
                  value={profileForm.subjects}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, subjects: event.target.value }))
                  }
                  placeholder="Subjects, comma separated"
                  className="min-h-24 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2"
                  required
                />
                <button
                  type="submit"
                  disabled={pending === "profile"}
                  className="rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 md:col-span-2"
                >
                  {pending === "profile" ? "Saving..." : "Save profile"}
                </button>
              </form>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-2xl font-semibold">Queue and matching</h2>
              <p className="mt-1 text-sm text-slate-600">
                Choose the exact subject you are studying right now. StudyBuddy
                keeps matching strict for 2 minutes before broadening the search.
              </p>

              <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
                <select
                  value={currentSubject}
                  onChange={(event) => setCurrentSubject(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:max-w-sm"
                  disabled={!me.profileCompleted}
                >
                  {me.subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleStartQueue}
                    disabled={pending === "queue" || !me.profileCompleted}
                    className="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-60"
                  >
                    {pending === "queue" ? "Queueing..." : "Start studying"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelQueue}
                    disabled={pending === "cancel-queue"}
                    className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel queue
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-slate-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Current status
                </p>
                <p className="mt-2 text-2xl font-semibold capitalize">
                  {me.matchStatus.status.replace("_", " ")}
                </p>
                {me.matchStatus.currentSubject ? (
                  <p className="mt-2 text-sm text-slate-600">
                    Subject: {me.matchStatus.currentSubject}
                  </p>
                ) : null}
                {me.matchStatus.queuedAt ? (
                  <p className="mt-2 text-sm text-slate-600">
                    Waiting time: {formatRelativeTime(me.matchStatus.queuedAt)}
                  </p>
                ) : null}
                {me.matchStatus.reason ? (
                  <p className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                    {me.matchStatus.reason}
                  </p>
                ) : null}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Active match</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    When another user joins with the same subject, this updates
                    automatically every few seconds.
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-200">
                  {me.matchStatus.matchType || "none"}
                </span>
              </div>

              {activePartner ? (
                <div className="mt-6 space-y-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <div>
                    <h3 className="text-xl font-semibold">{activePartner.name}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {activePartner.school} · {activePartner.major} · {activePartner.year}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {activePartner.bio}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activePartner.subjects.map((subject) => (
                      <span
                        key={subject}
                        className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleJoinSession}
                      disabled={pending === "session" || !me.matchStatus.matchId}
                      className="rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
                    >
                      {pending === "session" ? "Preparing..." : "Join session"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFriendRequest(activePartner.userId)}
                      disabled={pending === "friend"}
                      className="rounded-2xl border border-white/20 px-4 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                    >
                      Add friend
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-6 text-sm leading-7 text-slate-300">
                  Queue up from this account, then open a second browser with another
                  user and queue with the same subject to see the full match flow.
                </div>
              )}

              {sessionPayload ? (
                <div className="mt-5 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-5 text-sm text-emerald-100">
                  <p className="font-semibold">Session ready</p>
                  <p className="mt-2">Room: {sessionPayload.roomName}</p>
                  <p className="mt-1 break-all">
                    Token: <span className="font-mono">{sessionPayload.token}</span>
                  </p>
                  <p className="mt-1">Partner id: {sessionPayload.partnerId}</p>
                </div>
              ) : null}
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-2xl font-semibold">Friends</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Accept requests and open chat threads here.
                </p>

                <div className="mt-5 space-y-3">
                  {pendingIncoming.map((friend) => (
                    <div
                      key={friend.id}
                      className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                    >
                      <p className="font-semibold text-slate-900">
                        {friend.partnerProfile?.name || "Study partner"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Wants to connect with you.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleFriendResponse(friend.id, "accept")}
                          className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFriendResponse(friend.id, "reject")}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}

                  {pendingOutgoing.map((friend) => (
                    <div
                      key={friend.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="font-semibold text-slate-900">
                        {friend.partnerProfile?.name || "Study partner"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">Pending response</p>
                    </div>
                  ))}

                  {acceptedFriends.length === 0 && pendingIncoming.length === 0 && pendingOutgoing.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                      No friendships yet. Match with someone and click Add friend.
                    </div>
                  ) : null}

                  {acceptedFriends.map((friend) => (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() =>
                        setSelectedChatFriendId(friend.partnerProfile?.userId || null)
                      }
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedChatFriendId === friend.partnerProfile?.userId
                          ? "border-cyan-300 bg-cyan-50"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <p className="font-semibold text-slate-900">
                        {friend.partnerProfile?.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {friend.partnerProfile?.school}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-2xl font-semibold">Friend chat</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Persistent direct chat is unlocked after friendship is accepted.
                </p>

                {selectedFriend?.partnerProfile ? (
                  <>
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <p className="font-semibold text-slate-900">
                        {selectedFriend.partnerProfile.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedFriend.partnerProfile.major} · {selectedFriend.partnerProfile.school}
                      </p>
                    </div>
                    <div className="mt-4 h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="space-y-3">
                        {messages.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No messages yet. Send the first one.
                          </p>
                        ) : (
                          messages.map((message) => (
                            <div
                              key={message.id}
                              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                                message.senderId === me.user.id
                                  ? "ml-auto bg-slate-950 text-white"
                                  : "bg-white ring-1 ring-slate-200"
                              }`}
                            >
                              <p>{message.text}</p>
                              <p
                                className={`mt-2 text-[11px] ${
                                  message.senderId === me.user.id
                                    ? "text-slate-300"
                                    : "text-slate-500"
                                }`}
                              >
                                {new Date(message.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <form onSubmit={handleSendMessage} className="mt-4 flex gap-3">
                      <input
                        value={messageDraft}
                        onChange={(event) => setMessageDraft(event.target.value)}
                        placeholder="Send a message"
                        className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      />
                      <button
                        type="submit"
                        disabled={pending === "message"}
                        className="rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white"
                      >
                        Send
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-sm leading-7 text-slate-500">
                    Accept a friend request or add your match as a friend to unlock
                    chat.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
