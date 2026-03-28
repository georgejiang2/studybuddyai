import { useState, type FormEvent } from 'react';
import { BookOpen, LogOut, Video, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import ThemeToggle from '../components/ThemeToggle';
import styles from './DashboardPage.module.css';

type View = 'home' | 'searching';

export default function DashboardPage() {
  const { user, meData, logout, refresh } = useAuth();
  const [view, setView] = useState<View>('home');
  const [error, setError] = useState('');

  const profile = meData?.profile;
  const subjects = meData?.subjects ?? [];
  const profileDone = meData?.profileCompleted ?? false;
  const displayName = profile?.name || user?.email?.split('@')[0] || 'Student';

  const handleLogout = async () => {
    await logout();
  };

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

      <main className={styles.main}>
        <div className={styles.content}>
          {!profileDone ? (
            <ProfileSetup onDone={refresh} />
          ) : view === 'searching' ? (
            <SearchingView
              subjects={subjects}
              onCancel={() => { setView('home'); setError(''); }}
              onError={(msg) => { setError(msg); setView('home'); }}
            />
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

function SearchingView({
  subjects,
  onCancel,
  onError,
}: {
  subjects: string[];
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const [status, setStatus] = useState<'pick' | 'queued' | 'matched'>('pick');
  const [matchReason, setMatchReason] = useState('');
  const [loading, setLoading] = useState(false);

  const startSearch = async () => {
    if (!subject) return;
    setLoading(true);
    try {
      const res = await api.startMatch(subject);
      if (res.status === 'matched') {
        setStatus('matched');
        setMatchReason(res.reason ?? 'You were matched!');
      } else {
        setStatus('queued');
      }
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to start matching.');
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    try {
      await api.cancelMatch();
    } catch {
      // ignore
    }
    onCancel();
  };

  if (status === 'matched') {
    return (
      <div className={styles.center}>
        <h1 className={styles.greeting}>Match found!</h1>
        <p className={styles.sub}>{matchReason}</p>
        <button className={styles.secondaryBtn} onClick={onCancel}>
          Back to dashboard
        </button>
      </div>
    );
  }

  if (status === 'queued') {
    return (
      <div className={styles.center}>
        <Loader2 size={32} className={styles.spin} />
        <h1 className={styles.greeting}>Looking for a partner...</h1>
        <p className={styles.sub}>
          Studying <strong>{subject}</strong>. We'll match you as soon as someone joins.
        </p>
        <button className={styles.secondaryBtn} onClick={cancel}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.greeting}>What are you studying?</h1>
      <p className={styles.sub}>Pick a subject and we'll find you a partner.</p>

      <div className={styles.subjectPicker}>
        {subjects.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.subjectChip} ${s === subject ? styles.subjectActive : ''}`}
            onClick={() => setSubject(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className={styles.searchActions}>
        <button className={styles.startBtn} onClick={startSearch} disabled={loading || !subject}>
          {loading ? 'Joining...' : 'Find a partner'}
        </button>
        <button className={styles.secondaryBtn} onClick={onCancel}>
          Back
        </button>
      </div>
    </div>
  );
}
