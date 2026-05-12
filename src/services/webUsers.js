import { getDb } from '../db/index.js';
import crypto from 'crypto';

export function ensureWebUsersTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS web_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      discord_id TEXT,
      display_name TEXT,
      created_by TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verify;
}

export function createWebUser(username, password, discordId = null, displayName = null, createdBy = null, role = 'player', mustChangePassword = true) {
  ensureWebUsersTable();
  const db = getDb();
  const existing = db.prepare('SELECT id FROM web_users WHERE username = ?').get(username);
  if (existing) return { error: `Username "${username}" is already taken.` };
  const hash = hashPassword(password);
  db.prepare(`
    INSERT INTO web_users (username, password_hash, discord_id, display_name, role, created_by, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(username, hash, discordId || null, displayName || username, role, createdBy, mustChangePassword ? 1 : 0);
  return { success: true, user: db.prepare('SELECT id, username, discord_id, display_name, role FROM web_users WHERE username = ?').get(username) };
}

export function seedDefaultAdmin() {
  ensureWebUsersTable();
  const db = getDb();
  const admin = db.prepare("SELECT id FROM web_users WHERE role = 'admin' LIMIT 1").get();
  if (admin) return; // Already have an admin
  const hash = hashPassword('DM');
  db.prepare(`
    INSERT OR IGNORE INTO web_users (username, password_hash, display_name, role)
    VALUES (?, ?, ?, 'admin')
  `).run('Overlord', hash, 'Overlord');
  console.log('Seeded default admin: Overlord / DM');
}

export function authenticateWebUser(username, password) {
  ensureWebUsersTable();
  const db = getDb();
  const user = db.prepare('SELECT * FROM web_users WHERE username = ? AND is_active = 1').get(username);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return {
    id: user.id,
    username: user.username,
    discord_id: user.discord_id,
    display_name: user.display_name,
    role: user.role,
    mustChangePassword: !!user.must_change_password,
  };
}

export function changePassword(userId, currentPassword, newPassword) {
  ensureWebUsersTable();
  const db = getDb();
  const user = db.prepare('SELECT * FROM web_users WHERE id = ?').get(userId);
  if (!user) return { error: 'User not found.' };
  if (!verifyPassword(currentPassword, user.password_hash)) return { error: 'Current password is incorrect.' };
  if (newPassword.length < 4) return { error: 'New password must be at least 4 characters.' };
  const hash = hashPassword(newPassword);
  db.prepare('UPDATE web_users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, userId);
  return { success: true };
}

export function listWebUsers() {
  ensureWebUsersTable();
  const db = getDb();
  return db.prepare('SELECT id, username, discord_id, display_name, is_active, created_at FROM web_users ORDER BY username ASC').all();
}

export function deleteWebUser(id) {
  ensureWebUsersTable();
  const db = getDb();
  db.prepare('UPDATE web_users SET is_active = 0 WHERE id = ?').run(id);
}

export function resetWebUserPassword(id, newPassword) {
  ensureWebUsersTable();
  const db = getDb();
  const user = db.prepare('SELECT id FROM web_users WHERE id = ?').get(id);
  if (!user) return { error: 'User not found.' };
  const hash = hashPassword(newPassword);
  db.prepare('UPDATE web_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, id);
  return { success: true };
}
