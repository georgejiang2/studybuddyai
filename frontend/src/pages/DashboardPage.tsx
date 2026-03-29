import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { BookOpen, LogOut, Video, Users, Home, User, Plus, Trash2, Phone, PhoneOff } from 'lucide-react';
import Autocomplete from '../components/Autocomplete';
import schools from '../data/schools.json';
import majors from '../data/majors.json';
import { useAuth } from '../context/AuthContext';
import { api, ApiError, type MatchStatus, type SessionJoinPayload, type PartnerProfile, type CallRecord, type CallerProfile } from '../api/client';
import ThemeToggle from '../components/ThemeToggle';
import MatchingScreen from '../components/MatchingScreen';
import StudySession from '../components/StudySession';
import FriendsPanel from '../components/FriendsPanel';
import styles from './DashboardPage.module.css';

type View = 'home' | 'searching' | 'session' | 'friends' | 'profile';

const ALL_STUDY_STYLES = [
  'focused', 'collaborative', 'social', 'competitive',
  'casual', 'teaching', 'visual', 'cramming',
] as const;

export default function DashboardPage() {
  const { user, meData, logout, refresh } = useAuth();
  const [view, setView] = useState<View>('home');
  const [error, setError] = useState('');
  const [sessionPayload, setSessionPayload] = useState<SessionJoinPayload | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);

  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const [incomingCall, setIncomingCall] = useState<{ call: CallRecord; callerProfile: CallerProfile } | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [skippedByPartner, setSkippedByPartner] = useState(false);
  const friendPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const profile = meData?.profile;
  const subjects = meData?.subjects ?? [];
  const studyStyles = meData?.studyStyles ?? [];
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

  // Poll for incoming friend calls
  useEffect(() => {
    if (!profileDone || view === 'session') return;
    const pollCall = async () => {
      try {
        const res = await api.getIncomingCall();
        if (res.call && res.callerProfile) {
          setIncomingCall({ call: res.call, callerProfile: res.callerProfile });
        } else {
          setIncomingCall(null);
        }
      } catch { /* ignore */ }
    };
    pollCall();
    callPollRef.current = setInterval(pollCall, 3000);
    return () => { if (callPollRef.current) clearInterval(callPollRef.current); };
  }, [profileDone, view]);

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
    setSessionEnded(true);
    setView('home');
    refresh();
  };

  const handleSkip = () => {
    setSessionPayload(null);
    setPartnerProfile(null);
    setView('searching');
    refresh();
  };

  const handleSkippedByPartner = useCallback(() => {
    setSessionPayload(null);
    setPartnerProfile(null);
    setSkippedByPartner(true);
    setView('home');
    refresh();
    // Auto-requeue after showing the message briefly
    setTimeout(() => {
      setSkippedByPartner(false);
      setView('searching');
    }, 2000);
  }, [refresh]);

  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    try {
      const res = await api.respondToCall(incomingCall.call.id, 'accept');
      setIncomingCall(null);
      if (res.sessionJoinPayload) {
        setSessionPayload(res.sessionJoinPayload);
        setPartnerProfile(null);
        setView('session');
      }
    } catch { /* ignore */ }
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    try {
      await api.respondToCall(incomingCall.call.id, 'decline');
    } catch { /* ignore */ }
    setIncomingCall(null);
  };

  const handleCallAccepted = (payload: SessionJoinPayload, partner: PartnerProfile | null) => {
    setSessionPayload(payload);
    setPartnerProfile(partner);
    setView('session');
  };

  const handleLogout = async () => {
    await logout();
  };

  // Skipped by partner screen
  if (skippedByPartner) {
    return (
      <div className={styles.page}>
        <div className={styles.sessionEndedOverlay}>
          <h2>You were skipped</h2>
          <p>Finding you a new study partner...</p>
        </div>
      </div>
    );
  }

  // Session ended screen
  if (sessionEnded) {
    return (
      <div className={styles.page}>
        <div className={styles.sessionEndedOverlay}>
          <h2>Session ended</h2>
          <p>What would you like to do next?</p>
          <div className={styles.sessionEndedActions}>
            <button
              className={styles.startBtn}
              onClick={() => { setSessionEnded(false); setView('searching'); }}
            >
              Find another partner
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={() => { setSessionEnded(false); setView('home'); }}
            >
              Return home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full-screen session view (no nav)
  if (view === 'session' && sessionPayload) {
    return (
      <StudySession
        sessionPayload={sessionPayload}
        partnerProfile={partnerProfile}
        onEnd={handleSessionEnd}
        onSkip={handleSkip}
        onSkippedByPartner={handleSkippedByPartner}
        onAddFriend={() => {}}
      />
    );
  }

  return (
    <div className={styles.page}>
      {/* Incoming call overlay */}
      {incomingCall && (
        <div className={styles.incomingCallOverlay}>
          <div className={styles.incomingCallCard}>
            <div className={styles.incomingCallAvatar}>
              {incomingCall.callerProfile.name.charAt(0).toUpperCase()}
            </div>
            <h2>{incomingCall.callerProfile.name}</h2>
            <p>{incomingCall.callerProfile.school} &middot; {incomingCall.callerProfile.major}</p>
            <span className={styles.incomingCallLabel}>Incoming call...</span>
            <div className={styles.incomingCallActions}>
              <button className={styles.acceptCallBtn} onClick={handleAcceptCall}>
                <Phone size={20} />
              </button>
              <button className={styles.declineCallBtn} onClick={handleDeclineCall}>
                <PhoneOff size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.logo}>
            <BookOpen size={22} strokeWidth={2.2} />
            <span>StudyBuddy</span>
          </span>

          {profileDone && view !== 'searching' && (
            <div className={styles.navTabs}>
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
              <button
                className={`${styles.tab} ${view === 'profile' ? styles.tabActive : ''}`}
                onClick={() => setView('profile')}
              >
                <User size={16} />
                Profile
              </button>
            </div>
          )}

          <div className={styles.navRight}>
            <ThemeToggle />
            <button onClick={handleLogout} className={styles.logoutBtn}>
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </div>
      </nav>

      {view === 'searching' ? (
        <MatchingScreen
          subjects={subjects}
          onMatched={handleMatched}
          onCancel={() => { setView('home'); setError(''); }}
          onError={(msg) => { setError(msg); setView('home'); }}
        />
      ) : view === 'friends' ? (
        <main className={styles.friendsMain}>
          <FriendsPanel onCallAccepted={handleCallAccepted} />
        </main>
      ) : view === 'profile' ? (
        <main className={styles.main}>
          <div className={styles.content}>
            <ProfilePage
              profile={profile}
              email={user?.email ?? ''}
              subjects={subjects}
              studyStyles={studyStyles}
              onSaved={refresh}
            />
          </div>
        </main>
      ) : (
        <main className={styles.mainCentered}>
          <div className={styles.content}>
            {!profileDone ? (
              <ProfileSetup key={profile?.name ?? ''} onDone={refresh} existingProfile={profile} existingSubjects={subjects} />
            ) : (
              <>
                <h1 className={styles.greeting}>Hey, {displayName}</h1>
                <p className={styles.sub}>Ready to find a study partner?</p>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.homeGrid}>
                  <div className={styles.homeLeft}>
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
                  </div>

                  <div className={styles.homeRight}>
                    <ProfileSummary
                      profile={profile}
                      subjects={subjects}
                      studyStyles={studyStyles}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

function ProfileSetup({ onDone, existingProfile, existingSubjects }: {
  onDone: () => void;
  existingProfile?: import('../api/client').Profile | null;
  existingSubjects?: string[];
}) {
  const [name, setName] = useState(existingProfile?.name ?? '');
  const [school, setSchool] = useState(existingProfile?.school ?? '');
  const [major, setMajor] = useState(existingProfile?.major ?? '');
  const [year, setYear] = useState(existingProfile?.year ?? '');
  const [bio, setBio] = useState(existingProfile?.bio ?? '');
  const [subjectsRaw, setSubjectsRaw] = useState(existingSubjects?.join(', ') ?? '');
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
            <Autocomplete id="p-school" options={schools} value={school} onChange={setSchool} placeholder="Search your school..." required />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="p-major">Major</label>
            <Autocomplete id="p-major" options={majors} value={major} onChange={setMajor} placeholder="Search your major..." required />
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

/** Read-only profile summary for the home page (no email, no edit) */
function ProfileSummary({
  profile,
  subjects,
  studyStyles,
}: {
  profile: import('../api/client').Profile | null | undefined;
  subjects: string[];
  studyStyles: string[];
}) {
  return (
    <div className={styles.info}>
      <div className={styles.infoHeader}>
        <span className={styles.infoHeaderText}>Your Profile</span>
      </div>
      {profile?.name && (
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Name</span>
          <span className={styles.infoValue}>{profile.name}</span>
        </div>
      )}
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
          <span className={styles.infoValue}>{profile.year.charAt(0).toUpperCase() + profile.year.slice(1)}</span>
        </div>
      )}
      {subjects.length > 0 && (
        <div className={styles.infoItemCol}>
          <span className={styles.infoLabel}>Subjects</span>
          <div className={styles.subjectChips}>
            {subjects.slice(0, 3).map((s) => (
              <span key={s} className={styles.subjectChip}>{s}</span>
            ))}
            {subjects.length > 3 && (
              <span className={styles.subjectMore}>+{subjects.length - 3}</span>
            )}
          </div>
        </div>
      )}
      {studyStyles.length > 0 && (
        <div className={styles.infoItemCol}>
          <span className={styles.infoLabel}>Study Style</span>
          <div className={styles.subjectChips}>
            {studyStyles.map((s) => (
              <span key={s} className={styles.styleChip}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Full profile editing page */
function ProfilePage({
  profile,
  email,
  subjects,
  studyStyles,
  onSaved,
}: {
  profile: import('../api/client').Profile | null | undefined;
  email: string;
  subjects: string[];
  studyStyles: string[];
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(profile?.name ?? '');
  const [school, setSchool] = useState(profile?.school ?? '');
  const [major, setMajor] = useState(profile?.major ?? '');
  const [year, setYear] = useState(profile?.year ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [editSubjects, setEditSubjects] = useState<string[]>(subjects);
  const [newSubject, setNewSubject] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>(studyStyles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const addSubject = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    if (editSubjects.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
    setEditSubjects([...editSubjects, trimmed]);
    setNewSubject('');
  };

  const removeSubject = (index: number) => {
    setEditSubjects(editSubjects.filter((_, i) => i !== index));
  };

  const toggleStyle = (style: string) => {
    if (selectedStyles.includes(style)) {
      setSelectedStyles(selectedStyles.filter((s) => s !== style));
    } else if (selectedStyles.length < 3) {
      setSelectedStyles([...selectedStyles, style]);
    }
  };

  const handleSave = async () => {
    if (editSubjects.length === 0) {
      setError('You need at least one subject.');
      return;
    }
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await api.setupProfile({
        name: name.trim(),
        school,
        major,
        year,
        bio,
        subjects: editSubjects,
        studyStyles: selectedStyles,
      });
      await onSaved();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.profilePage}>
      <h1 className={styles.profileTitle}>Profile</h1>
      <p className={styles.profileSub}>Manage your profile information and study preferences.</p>

      {error && <div className={styles.editError}>{error}</div>}
      {success && <div className={styles.successMsg}>Profile saved!</div>}

      <div className={styles.profileSections}>
        <div className={styles.profileSection}>
          <h3 className={styles.sectionLabel}>Personal Info</h3>
          <div className={styles.editFields}>
            <div className={styles.editField}>
              <label>Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className={styles.editField}>
              <label>Email</label>
              <input type="text" value={email} disabled className={styles.disabledInput} />
            </div>
            <div className={styles.editField}>
              <label>School</label>
              <Autocomplete options={schools} value={school} onChange={setSchool} placeholder="Search your school..." />
            </div>
            <div className={styles.editField}>
              <label>Major</label>
              <Autocomplete options={majors} value={major} onChange={setMajor} placeholder="Search your major..." />
            </div>
            <div className={styles.editField}>
              <label>Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="freshman">Freshman</option>
                <option value="sophomore">Sophomore</option>
                <option value="junior">Junior</option>
                <option value="senior">Senior</option>
                <option value="grad">Grad</option>
              </select>
            </div>
            <div className={styles.editField}>
              <label>Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell others about your study habits..." />
            </div>
          </div>
        </div>

        <div className={styles.profileSection}>
          <h3 className={styles.sectionLabel}>Subjects</h3>
          <div className={styles.subjectList}>
            {editSubjects.map((s, i) => (
              <span key={i} className={styles.subjectTag}>
                {s}
                <button type="button" onClick={() => removeSubject(i)} className={styles.removeSubject}>
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className={styles.addSubjectRow}>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Add a subject..."
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubject(); } }}
            />
            <button type="button" onClick={addSubject} className={styles.addSubjectBtn} disabled={!newSubject.trim()}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className={styles.profileSection}>
          <h3 className={styles.sectionLabel}>Study Style</h3>
          <p className={styles.sectionHint}>
            Pick up to 3 styles that describe how you like to study. This helps us match you with compatible partners.
            {selectedStyles.length > 0 ? '' : ' Your style is also auto-detected from your bio.'}
          </p>
          <div className={styles.styleGrid}>
            {ALL_STUDY_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                className={`${styles.styleOption} ${selectedStyles.includes(style) ? styles.styleSelected : ''}`}
                onClick={() => toggleStyle(style)}
              >
                <span className={styles.styleEmoji}>{styleEmoji(style)}</span>
                <span className={styles.styleName}>{style.charAt(0).toUpperCase() + style.slice(1)}</span>
                <span className={styles.styleDesc}>{styleDescription(style)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.profileActions}>
        <button className={styles.startBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function styleEmoji(style: string): string {
  const map: Record<string, string> = {
    focused: '\u{1F3AF}',
    collaborative: '\u{1F91D}',
    social: '\u{1F4AC}',
    competitive: '\u{1F3C6}',
    casual: '\u{2615}',
    teaching: '\u{1F4DA}',
    visual: '\u{1F3A8}',
    cramming: '\u{26A1}',
  };
  return map[style] ?? '';
}

function styleDescription(style: string): string {
  const map: Record<string, string> = {
    focused: 'Deep work, minimal distractions',
    collaborative: 'Shared notes, teamwork',
    social: 'Discussion-based learning',
    competitive: 'Exam prep, accountability',
    casual: 'Relaxed pace, low pressure',
    teaching: 'Explaining concepts, mentoring',
    visual: 'Diagrams, whiteboards',
    cramming: 'Last-minute, high intensity',
  };
  return map[style] ?? '';
}
