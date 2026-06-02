/**
 * Mock Supabase Auth.
 *
 * Implements the same surface as @supabase/supabase-js auth:
 *   supabase.auth.signUp({ email, password })
 *   supabase.auth.signInWithPassword({ email, password })
 *   supabase.auth.signOut(token)
 *   supabase.auth.getUser(token)
 *
 * Sessions are stored in data.json and sent to the client as an
 * HTTP-only cookie named `prooflink-session` (set by the API routes).
 *
 * Passwords are SHA-256 hashed. In production use bcrypt/argon2.
 *
 * ─── To connect real Supabase Auth ────────────────────────────────────────
 * Replace calls to `supabase.auth.*` in the API routes with the real
 * @supabase/supabase-js equivalents — the method signatures are intentionally
 * kept identical so the swap is a one-line import change.
 * ──────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { Database, User, Session } from './database.types';

const DB_PATH = path.join(process.cwd(), 'src/lib/mocks/data.json');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_NAME = 'prooflink-session';

// ── DB helpers ────────────────────────────────────────────────────────────────

const readDb = (): Database => {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as Database;
  } catch {
    return { projects: {}, profiles: {}, users: {}, sessions: {}, downloadTokens: {} };
  }
};

const writeDb = (db: Database): void => {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
};

// ── Crypto helpers ────────────────────────────────────────────────────────────

const hashPassword = (password: string): string =>
  crypto.createHash('sha256').update(password).digest('hex');

// ── Auth operations ───────────────────────────────────────────────────────────

type AuthResult =
  | { user: Pick<User, 'id' | 'email'>; token: string; error: null }
  | { user: null; token: null; error: string };

/**
 * Create a new freelancer account.
 * Mirrors: supabase.auth.signUp({ email, password })
 */
const signUp = (email: string, password: string): AuthResult => {
  const db = readDb();

  // Ensure users/sessions maps exist (safety for legacy data.json)
  if (!db.users) db.users = {};
  if (!db.sessions) db.sessions = {};
  if (!db.profiles) db.profiles = {};

  const existingUser = Object.values(db.users).find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (existingUser) {
    return { user: null, token: null, error: 'An account with this email already exists.' };
  }

  if (password.length < 8) {
    return { user: null, token: null, error: 'Password must be at least 8 characters.' };
  }

  const userId = uuidv4();
  const newUser: User = {
    id: userId,
    email: email.toLowerCase().trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  // Create an empty profile for this user
  db.users[userId] = newUser;
  db.profiles[userId] = { id: userId, deal_count: 0 };

  const token = uuidv4();
  const session: Session = {
    token,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  db.sessions[token] = session;

  writeDb(db);

  return { user: { id: userId, email: newUser.email }, token, error: null };
};

/**
 * Sign in with email + password.
 * Mirrors: supabase.auth.signInWithPassword({ email, password })
 */
const signInWithPassword = (email: string, password: string): AuthResult => {
  const db = readDb();
  if (!db.users) db.users = {};
  if (!db.sessions) db.sessions = {};

  const user = Object.values(db.users).find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (!user || user.passwordHash !== hashPassword(password)) {
    return { user: null, token: null, error: 'Invalid email or password.' };
  }

  const token = uuidv4();
  const session: Session = {
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  db.sessions[token] = session;
  writeDb(db);

  return { user: { id: user.id, email: user.email }, token, error: null };
};

/**
 * Invalidate a session.
 * Mirrors: supabase.auth.signOut()
 */
const signOut = (token: string): void => {
  const db = readDb();
  if (!db.sessions) return;
  delete db.sessions[token];
  writeDb(db);
};

/**
 * Resolve a session token to the authenticated user.
 * Mirrors: supabase.auth.getUser(token)
 */
const getUser = (
  token: string | undefined
): { user: Pick<User, 'id' | 'email'>; error: null } | { user: null; error: string } => {
  if (!token) return { user: null, error: 'No session token.' };

  const db = readDb();
  if (!db.sessions || !db.users) return { user: null, error: 'Not authenticated.' };

  const session = db.sessions[token];
  if (!session) return { user: null, error: 'Session not found.' };
  if (new Date(session.expiresAt) < new Date()) {
    // Clean up expired session
    delete db.sessions[token];
    writeDb(db);
    return { user: null, error: 'Session expired.' };
  }

  const user = db.users[session.userId];
  if (!user) return { user: null, error: 'User not found.' };

  return { user: { id: user.id, email: user.email }, error: null };
};

export const mockAuth = { signUp, signInWithPassword, signOut, getUser, COOKIE_NAME };
