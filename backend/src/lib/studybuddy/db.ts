import { Pool } from "pg";

const DB_KEY = "__studybuddy_pool__";

function getPool(): Pool {
  const g = globalThis as typeof globalThis & { [DB_KEY]?: Pool };
  if (!g[DB_KEY]) {
    g[DB_KEY] = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
      max: 10,
    });
  }
  return g[DB_KEY];
}

export function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) {
  return getPool().query<T>(text, params);
}

export async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_passwords (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      name TEXT NOT NULL DEFAULT '',
      school TEXT NOT NULL DEFAULT '',
      normalized_school TEXT NOT NULL DEFAULT '',
      major TEXT NOT NULL DEFAULT '',
      normalized_major TEXT NOT NULL DEFAULT '',
      year TEXT NOT NULL DEFAULT 'freshman',
      bio TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS profile_subjects (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      subject TEXT NOT NULL,
      UNIQUE(user_id, subject)
    );

    CREATE TABLE IF NOT EXISTS queue (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      current_subject TEXT NOT NULL,
      normalized_current_subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user_a TEXT NOT NULL REFERENCES users(id),
      user_b TEXT NOT NULL REFERENCES users(id),
      match_type TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL REFERENCES matches(id),
      room_name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'livekit',
      provider_room_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      end_reason TEXT,
      ended_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS friends (
      id TEXT PRIMARY KEY,
      requester_id TEXT NOT NULL REFERENCES users(id),
      recipient_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      friendship_id TEXT NOT NULL REFERENCES friends(id),
      sender_id TEXT NOT NULL REFERENCES users(id),
      recipient_id TEXT NOT NULL REFERENCES users(id),
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      caller_id TEXT NOT NULL REFERENCES users(id),
      recipient_id TEXT NOT NULL REFERENCES users(id),
      match_id TEXT NOT NULL REFERENCES matches(id),
      session_id TEXT NOT NULL REFERENCES sessions(id),
      status TEXT NOT NULL DEFAULT 'ringing',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS study_styles (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      style TEXT NOT NULL,
      UNIQUE(user_id, style)
    );

    CREATE TABLE IF NOT EXISTS skips (
      id SERIAL PRIMARY KEY,
      skipper_id TEXT NOT NULL REFERENCES users(id),
      skipped_id TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS session_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      sender_id TEXT NOT NULL REFERENCES users(id),
      sender_name TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migrations for existing databases
  await query(`
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS end_reason TEXT;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ended_by TEXT;
  `).catch(() => { /* columns may already exist */ });
}

const g = globalThis as typeof globalThis & { __db_initialized__?: boolean };

export async function ensureInitialized() {
  if (g.__db_initialized__) return;
  await initDatabase();
  await seedDemoUsers();
  g.__db_initialized__ = true;
}

export async function seedDemoUsers() {
  // Only seed if demo users don't exist
  const existing = await query("SELECT id FROM users WHERE id = $1", ["demo-user-1"]);
  if (existing.rows.length > 0) return;

  await query(`
    INSERT INTO users (id, email) VALUES
      ('demo-user-1', 'ava@studybuddy.dev'),
      ('demo-user-2', 'miles@studybuddy.dev'),
      ('demo-user-3', 'sofia@studybuddy.dev')
    ON CONFLICT DO NOTHING;
  `);

  await query(`
    INSERT INTO user_passwords (user_id, password) VALUES
      ('demo-user-1', 'demo12345'),
      ('demo-user-2', 'demo12345'),
      ('demo-user-3', 'demo12345')
    ON CONFLICT DO NOTHING;
  `);

  await query(`
    INSERT INTO profiles (user_id, name, school, normalized_school, major, normalized_major, year, bio) VALUES
      ('demo-user-1', 'Ava Chen', 'Georgia Institute of Technology', 'Georgia Institute of Technology', 'Computer Science', 'Computer Science', 'junior', 'Studying for systems and interview-heavy classes.'),
      ('demo-user-2', 'Miles Carter', 'Georgia Institute of Technology', 'Georgia Institute of Technology', 'Computer Science', 'Computer Science', 'junior', 'Best in focused sprint sessions with shared notes.'),
      ('demo-user-3', 'Sofia Patel', 'Emory University', 'Emory University', 'Mathematics', 'Mathematics', 'senior', 'Looking for accountability and exam-prep sessions.')
    ON CONFLICT DO NOTHING;
  `);

  const subjectInserts = [
    ["demo-user-1", "Data Structures"],
    ["demo-user-1", "Algorithms"],
    ["demo-user-1", "Operating Systems"],
    ["demo-user-2", "Data Structures"],
    ["demo-user-2", "Databases"],
    ["demo-user-2", "Computer Networks"],
    ["demo-user-3", "Calculus"],
    ["demo-user-3", "Linear Algebra"],
    ["demo-user-3", "Probability"],
  ];

  for (const [userId, subject] of subjectInserts) {
    await query(
      "INSERT INTO profile_subjects (user_id, subject) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, subject],
    );
  }

  // Seed study styles for demo users
  const styleInserts = [
    ["demo-user-1", "focused"],
    ["demo-user-1", "competitive"],
    ["demo-user-2", "collaborative"],
    ["demo-user-2", "focused"],
    ["demo-user-3", "competitive"],
    ["demo-user-3", "cramming"],
  ];

  for (const [userId, style] of styleInserts) {
    await query(
      "INSERT INTO study_styles (user_id, style) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, style],
    );
  }
}
