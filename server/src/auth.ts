import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '@shared/index';
import { config } from './env';
import { query } from './db';
import { hasDisallowedPublicContent } from './moderation';

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  equipped_user_icon_id?: string;
  password_hash: string;
}

export interface PasswordResetRequest {
  email: string;
  token: string;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ username: user.username }, config.jwtSecret, {
    subject: user.id,
    expiresIn: '30d',
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function registerUser(username: string, email: string, password: string): Promise<AuthUser> {
  const normalizedEmail = normalizeEmail(email);
  const existing = await query<UserRow>(
    'SELECT id, username, email, equipped_user_icon_id, password_hash FROM users WHERE username = $1 OR lower(email) = $2',
    [username, normalizedEmail],
  );
  if (existing.rowCount) {
    const conflict = existing.rows[0].username.toLowerCase() === username.toLowerCase()
      ? 'Username already taken'
      : 'Email already in use';
    const err = new Error(conflict);
    (err as { status?: number }).status = 409;
    throw err;
  }
  const id = randomUUID();
  const hash = await bcrypt.hash(password, 10);
  await query(
    'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
    [id, username, normalizedEmail, hash],
  );
  return { id, username, userIconId: '' };
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
  const identifier = email.trim();
  const normalizedEmail = normalizeEmail(identifier);
  const res = await query<UserRow>(
    `SELECT * FROM users
     WHERE lower(email) = $1 OR (email IS NULL AND username = $2)`,
    [normalizedEmail, identifier],
  );
  const row = res.rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    const err = new Error('Invalid email or password');
    (err as { status?: number }).status = 401;
    throw err;
  }
  return { id: row.id, username: row.username, userIconId: row.equipped_user_icon_id ?? '' };
}

export async function requestPasswordReset(email: string): Promise<PasswordResetRequest | null> {
  const normalizedEmail = normalizeEmail(email);
  const res = await query<Pick<UserRow, 'id' | 'email'>>(
    'SELECT id, email FROM users WHERE lower(email) = $1',
    [normalizedEmail],
  );
  const user = res.rows[0];
  if (!user.email) return null;

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(token);
  await query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 hour')`,
    [randomUUID(), user.id, tokenHash],
  );
  return { email: user.email, token };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const tokenHash = hashResetToken(token);
  const res = await query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash],
  );
  const reset = res.rows[0];
  if (!reset) {
    const err = new Error('Reset link is invalid or expired');
    (err as { status?: number }).status = 400;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, reset.user_id]);
  await query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [reset.id]);
}

// Express augmentation for the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

async function extractUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
    if (!payload.sub) return null;
    const result = await query<Pick<UserRow, 'id' | 'username' | 'equipped_user_icon_id'>>(
      'SELECT id, username, equipped_user_icon_id FROM users WHERE id = $1',
      [String(payload.sub)],
    );
    const user = result.rows[0];
    return user && !hasDisallowedPublicContent(user.username)
      ? { id: user.id, username: user.username, userIconId: user.equipped_user_icon_id ?? '' }
      : null;
  } catch {
    return null;
  }
}

// Attaches req.user if a valid token is present; never rejects.
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await extractUser(req);
    if (user) req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Rejects with 401 unless a valid token is present.
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user ?? await extractUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
