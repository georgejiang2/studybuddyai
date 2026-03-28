import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { BookOpen, LogOut, Video, Users, Home, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError, type MatchStatus, type SessionJoinPayload, type PartnerProfile } from '../api/client';
import ThemeToggle from '../components/ThemeToggle';
import MatchingScreen from '../components/MatchingScreen';
import StudySession from '../components/StudySession';
import FriendsPanel from '../components/FriendsPanel';
import styles from './DashboardPage.module.css';

type View = 'home' | 'searching' | 'session' | 'friends';

export default function DashboardPage() {
  const { user, meData, logout, refresh } = useAuth();
  const [view, setView] = useState<View>('home');
  const [error, setError] = useState('');
  const [sessionPayload, setSessionPayload] = useState<SessionJoinPayload | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);

  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const friendPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const profile = meData?.profile;
  const subjects = meData?.subjects ?? [];
  const profileDone = meData?.profileCompleted ?? false;
  const displayName = profile?.name || user?.email?.split('@')[0] || 'Student';

  // Poll for pending friend requests
  const fetchPendingFriends = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getFriends();
      const pending = res.friendships.filter(
        (f) => f.status === 'pending' && f.recipientId === user.id,
      );
      setPendingFriendCount(pending.length);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    if (!profileDone) return;
    fetchPendingFriends();
    friendPollRef.current = setInterval(fetchPendingFriends, 10000);
    return () => {
      if (friendPollRef.current) clearInterval(friendPollRef.current);
    };
  }, [profileDone, fetchPendingFriends]);

  // Check if user already has an active session on load
  useEffect(() => {
    if (meData?.matchStatus?.status === 'in_session' && meData.matchStatus.sessionId) {
      joinSession(meData.matchStatus.sessionId, meData.matchStatus.partnerProfile ?? null);
    }
  }, [meData?.matchStatus?.status]);

  const joinSession = async (sessionId: string, partner: PartnerProfile | null) => {
    try {
      const payload = await api.joinSession({ sessionId });
      setSessionPayload(payload);
      setPartnerProfile(partner);
      setView('session');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to join session.');
      setView('home');
    }
  };

  const handleMatched = async (matchStatus: MatchStatus) => {
    if (matchStatus.sessionId) {
      await joinSession(matchStatus.sessionId, matchStatus.partnerProfile ?? null);
    } else if (matchStatus.matchId) {
      try {
        const payload = await api.joinSession({ matchId: matchStatus.matchId });
        setSessionPayload(payload);
        setPartnerProfile(matchStatus.partnerProfile ?? null);
        setView('session');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to join session.');
        setView('home');
      }
    }
  };

  const handleSessionEnd = () => {
    setSessionPayload(null);
    setPartnerProfile(null);
    setView('home');
    refresh();
  };

  const handleLogout = async () => {
    await logout();
  };

  // Full-screen session view (no nav)
  if (view === 'session' && sessionPayload) {
    return (
      <StudySession
        sessionPayload={sessionPayload}
        partnerProfile={partnerProfile}
        onEnd={handleSessionEnd}
        onAddFriend={() => {}}
      />
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.logo}>
            <BookOpen size={22} strokeWidth={2.2} />
            <span>StudyBuddy</span>
          </span>
          <div className={styles.navRight}>
            <ThemeToggle />
            <button onClick={handleLogout} className={styles.logoutBtn}>
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </div>
      </nav>

      {/* Tab bar */}
      {profileDone && view !== 'searching' && (
        <div className={styles.tabBar}>
          <div className={styles.tabBarInner}>
            <button
              className={`${styles.tab} ${view === 'home' ? styles.tabActive : ''}`}
              onClick={() => setView('home')}
            >
              <Home size={16} />
              Home
            </button>
            <button
              className={`${styles.tab} ${view === 'friends' ? styles.tabActive : ''}`}
              onClick={() => { setView('friends'); fetchPendingFriends(); }}
            >
              <Users size={16} />
              Friends
              {pendingFriendCount > 0 && (
                <span className={styles.tabBadge}>{pendingFriendCount}</span>
              )}
            </button>
          </div>
        </div>
      )}

      {view === 'searching' ? (
        <MatchingScreen
          subjects={subjects}
          onMatched={handleMatched}
          onCancel={() => { setView('home'); setError(''); }}
          onError={(msg) => { setError(msg); setView('home'); }}
        />
      ) : view === 'friends' ? (
        <main className={styles.friendsMain}>
          <FriendsPanel />
        </main>
      ) : (
        <main className={styles.main}>
          <div className={styles.content}>
            {!profileDone ? (
              <ProfileSetup onDone={refresh} />
            ) : (
              <>
                <h1 className={styles.greeting}>Hey, {displayName}</h1>
                <p className={styles.sub}>Ready to find a study partner?</p>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.card}>
                  <div className={styles.cardIcon}>
                    <Video size={24} />
                  </div>
                  <div>
                    <h2>Start Studying</h2>
                    <p>
                      Pick a subject and we'll match you with a student studying the
                      same thing right now.
                    </p>
                  </div>
                  <button
                    className={styles.startBtn}
                    onClick={() => { setError(''); setView('searching'); }}
                  >
                    Start Studying
                  </button>
                </div>

                <div className={styles.info}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Email</span>
                    <span className={styles.infoValue}>{user?.email}</span>
                  </div>
                  {profile?.school && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>School</span>
                      <span className={styles.infoValue}>{profile.school}</span>
                    </div>
                  )}
                  {profile?.major && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Major</span>
                      <span className={styles.infoValue}>{profile.major}</span>
                    </div>
                  )}
                  {profile?.year && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Year</span>
                      <span className={styles.infoValue}>{profile.year}</span>
                    </div>
                  )}
                  {subjects.length > 0 && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Subjects</span>
                      <span className={styles.infoValue}>{subjects.join(', ')}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

function ProfileSetup({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [bio, setBio] = useState('');
  const [subjectsRaw, setSubjectsRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const subjects = subjectsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (subjects.length === 0) {
      setError('Add at least one subject (comma separated).');
      return;
    }

    setLoading(true);
    try {
      await api.setupProfile({ name, school, major, year, bio, subjects });
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className={styles.greeting}>Complete your profile</h1>
      <p className={styles.sub}>
        Fill in your details so we can match you with the right study partners.
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="p-name">Full name</label>
            <input id="p-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Doe" />
          </div>
          <div className={styles.field}>
            <label htmlFor="p-school">School</label>
            <input id="p-school" type="text" value={school} onChange={(e) => setSchool(e.target.value)} required placeholder="Georgia Tech" />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="p-major">Major</label>
            <input id="p-major" type="text" value={major} onChange={(e) => setMajor(e.target.value)} required placeholder="Computer Science" />
          </div>
          <div className={styles.field}>
            <label htmlFor="p-year">Year</label>
            <select id="p-year" value={year} onChange={(e) => setYear(e.target.value)} required>
              <option value="" disabled>Select year</option>
              <option value="freshman">Freshman</option>
              <option value="sophomore">Sophomore</option>
              <option value="junior">Junior</option>
              <option value="senior">Senior</option>
              <option value="grad">Grad</option>
            </select>
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="p-bio">Bio</label>
          <textarea id="p-bio" value={bio} onChange={(e) => setBio(e.target.value)} required placeholder="I'm looking for study partners who..." rows={3} />
        </div>
        <div className={styles.field}>
          <label htmlFor="p-subjects">Subjects <span className={styles.hint}>(comma separated)</span></label>
          <input id="p-subjects" type="text" value={subjectsRaw} onChange={(e) => setSubjectsRaw(e.target.value)} required placeholder="Data Structures, Calculus II, Linear Algebra" />
        </div>
        <button type="submit" className={styles.startBtn} disabled={loading}>
          {loading ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
