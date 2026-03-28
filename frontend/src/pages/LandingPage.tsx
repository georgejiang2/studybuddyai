import { Video, Users, Zap, MessageCircle, ArrowRight, ChevronDown, BookOpen } from 'lucide-react';
import styles from './LandingPage.module.css';

interface Props {
  onLogin: () => void;
  onSignup: () => void;
}

const features = [
  {
    icon: Zap,
    title: 'Smart Matching',
    desc: 'Our AI pairs you with students in the same courses, year, and study style so every session is productive.',
  },
  {
    icon: Video,
    title: 'Video Study Rooms',
    desc: 'One click to start a live video session — no links, no scheduling. Just hit "Start Studying."',
  },
  {
    icon: MessageCircle,
    title: 'Built-in Chat',
    desc: 'Text chat alongside video so you can share notes, links, and questions without leaving the session.',
  },
  {
    icon: Users,
    title: 'Friends & Groups',
    desc: 'Add study partners you click with. Message them anytime and jump back into sessions together.',
  },
];

export default function LandingPage({ onLogin, onSignup }: Props) {
  return (
    <div className={styles.page}>
      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <a href="/" className={styles.logo}>
            <BookOpen size={22} strokeWidth={2.2} />
            <span>StudyBuddy</span>
          </a>
          <div className={styles.navRight}>
            <button onClick={onLogin} className={styles.navLink}>
              Log in
            </button>
            <button onClick={onSignup} className={styles.navCta}>
              Sign up free
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>
            Stop studying alone.
            <br />
            Find your people.
          </h1>
          <p className={styles.heroSub}>
            StudyBuddy matches you with students at your school who share your
            courses and goals — then lets you collaborate over live video in
            seconds.
          </p>
          <div className={styles.heroBtns}>
            <button onClick={onSignup} className={styles.btnPrimary}>
              Get started — it's free
              <ArrowRight size={16} />
            </button>
            <button onClick={onLogin} className={styles.btnSecondary}>
              I already have an account
            </button>
          </div>

          <a href="#how-it-works" className={styles.scrollHint}>
            <ChevronDown size={20} />
          </a>
        </div>
      </header>

      {/* ── How it works ── */}
      <section id="how-it-works" className={styles.steps}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>How it works</h2>
          <div className={styles.stepGrid}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <h3>Create your profile</h3>
              <p>Add your school, major, year, and the courses you're taking. Takes 30 seconds.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <h3>Hit "Start Studying"</h3>
              <p>Our AI finds a student who matches your profile and availability right now.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <h3>Study together live</h3>
              <p>Jump into a video call with chat. Add them as a friend to study again later.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.features}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Everything you need to study better</h2>
          <div className={styles.featureGrid}>
            {features.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <f.icon size={20} strokeWidth={2} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2>Ready to find your study partner?</h2>
          <p>Join thousands of students who stopped cramming alone.</p>
          <button onClick={onSignup} className={styles.btnPrimary}>
            Create your free account
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerLogo}>
            <BookOpen size={16} strokeWidth={2.2} />
            StudyBuddy
          </span>
          <span className={styles.footerCopy}>&copy; {new Date().getFullYear()} StudyBuddy. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
