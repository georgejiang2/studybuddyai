import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Search, Sparkles, X } from 'lucide-react';
import { api, ApiError, type MatchStatus, type PartnerProfile } from '../api/client';
import styles from './MatchingScreen.module.css';

interface Props {
  subjects: string[];
  onMatched: (matchStatus: MatchStatus) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}

export default function MatchingScreen({ subjects, onMatched, onCancel, onError }: Props) {
  const [phase, setPhase] = useState<'pick' | 'searching' | 'found'>('pick');
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const [loading, setLoading] = useState(false);
  const [matchData, setMatchData] = useState<MatchStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startSearch = async () => {
    if (!subject) return;
    setLoading(true);
    try {
      const res = await api.startMatch(subject);
      if (res.status === 'matched' || res.status === 'in_session') {
        setMatchData(res);
        setPhase('found');
        setLoading(false);
        return;
      }
      setPhase('searching');
      setLoading(false);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          const status = await api.matchStatus();
          if (status.status === 'matched' || status.status === 'in_session') {
            cleanup();
            setMatchData(status);
            setPhase('found');
          }
        } catch {
          // keep polling
        }
      }, 2000);
    } catch (err) {
      setLoading(false);
      onError(err instanceof ApiError ? err.message : 'Failed to start matching.');
    }
  };

  const handleCancel = async () => {
    cleanup();
    try {
      await api.cancelMatch();
    } catch {
      // ignore
    }
    onCancel();
  };

  const handleJoinSession = () => {
    if (matchData) {
      onMatched(matchData);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (phase === 'found' && matchData) {
    return <MatchFound matchData={matchData} onJoin={handleJoinSession} />;
  }

  if (phase === 'searching') {
    return (
      <div className={styles.container}>
        <div className={styles.searchingCard}>
          <div className={styles.pulseRing}>
            <div className={styles.pulseCore}>
              <Search size={28} />
            </div>
          </div>
          <h2 className={styles.title}>Finding your study partner...</h2>
          <p className={styles.subtitle}>
            Studying <strong>{subject}</strong>
          </p>
          <div className={styles.timer}>{formatTime(elapsed)}</div>
          <div className={styles.hints}>
            {elapsed < 10 && <span>Scanning for students studying the same subject...</span>}
            {elapsed >= 10 && elapsed < 30 && <span>Expanding search to similar profiles...</span>}
            {elapsed >= 30 && <span>Still looking — hang tight!</span>}
          </div>
          <button className={styles.cancelBtn} onClick={handleCancel}>
            <X size={16} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.pickCard}>
        <div className={styles.iconWrap}>
          <Search size={24} />
        </div>
        <h2 className={styles.title}>What are you studying?</h2>
        <p className={styles.subtitle}>Pick a subject and we'll find you a study partner.</p>

        <div className={styles.chips}>
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.chip} ${s === subject ? styles.chipActive : ''}`}
              onClick={() => setSubject(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.startBtn}
            onClick={startSearch}
            disabled={loading || !subject}
          >
            {loading ? <Loader2 size={16} className={styles.spin} /> : <Search size={16} />}
            {loading ? 'Joining...' : 'Find a partner'}
          </button>
          <button className={styles.backBtn} onClick={onCancel}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchFound({
  matchData,
  onJoin,
}: {
  matchData: MatchStatus;
  onJoin: () => void;
}) {
  const partner = matchData.partnerProfile as PartnerProfile | null;

  return (
    <div className={styles.container}>
      <div className={styles.foundCard}>
        <div className={styles.sparkle}>
          <Sparkles size={32} />
        </div>
        <h2 className={styles.foundTitle}>Match found!</h2>
        <p className={styles.reason}>{matchData.reason}</p>

        {partner && (
          <div className={styles.partnerCard}>
            <div className={styles.avatar}>
              {partner.name.charAt(0).toUpperCase()}
            </div>
            <div className={styles.partnerInfo}>
              <h3>{partner.name}</h3>
              <p>{partner.school} &middot; {partner.major} &middot; {partner.year.charAt(0).toUpperCase() + partner.year.slice(1)}</p>
              {partner.bio && (
                <p className={styles.partnerBio}>&ldquo;{partner.bio}&rdquo;</p>
              )}
              {partner.subjects.length > 0 && (
                <div className={styles.partnerSubjects}>
                  {partner.subjects.map((s) => (
                    <span key={s} className={styles.tag}>{s}</span>
                  ))}
                </div>
              )}
              {partner.studyStyles && partner.studyStyles.length > 0 && (
                <div className={styles.partnerSubjects}>
                  {partner.studyStyles.map((s) => (
                    <span key={s} className={styles.styleTag}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <button className={styles.joinBtn} onClick={onJoin}>
          Join Study Session
        </button>
      </div>
    </div>
  );
}
