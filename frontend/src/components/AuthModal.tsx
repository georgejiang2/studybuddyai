import { useState, useEffect, type FormEvent } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import styles from './AuthModal.module.css';

interface AuthModalProps {
  open: boolean;
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
  onClose: () => void;
}

export default function AuthModal({ open, mode, onModeChange, onClose }: AuthModalProps) {
  const { login, signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setSchool('');
    setShowPw(false);
    setLoading(false);
    setError('');
  };

  const switchMode = (next: 'login' | 'signup') => {
    resetForm();
    onModeChange(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        await signup(email, password, { name, school });
      } else {
        await login(email, password);
      }
      resetForm();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <h2 className={styles.title}>
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className={styles.subtitle}>
          {mode === 'login'
            ? 'Sign in to start studying with your matches.'
            : 'It takes less than a minute to get started.'}
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === 'signup' && (
            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="auth-school">School</label>
                <input
                  id="auth-school"
                  type="text"
                  placeholder="Georgia Tech"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="auth-password">Password</label>
            <div className={styles.pwWrap}>
              <input
                id="auth-password"
                type={showPw ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Min 8 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 8 : undefined}
              />
              <button
                type="button"
                className={styles.eye}
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? <span className={styles.spinner} /> : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className={styles.terms}>
            By signing up you agree to our <a href="#">Terms</a> and{' '}
            <a href="#">Privacy Policy</a>.
          </p>
        )}

        <p className={styles.switch}>
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => switchMode('signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
