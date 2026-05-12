import { Router } from 'express';
import { getDb } from '../../db/index.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;
  const type = req.query.type || null;
  const campaignId = req.query.campaignId ? parseInt(req.query.campaignId, 10) : null;
  const guildId = req.query.guildId || null;

  let sql = `
    SELECT l.*, s.title as session_title, s.session_number, c.name as campaign_name
    FROM session_auto_logs l
    JOIN session_logs s ON l.session_log_id = s.id
    JOIN campaigns c ON s.campaign_id = c.id
  `;
  const where = [];
  const params = {};
  if (type) { where.push('l.type = @type'); params.type = type; }
  if (campaignId) { where.push('s.campaign_id = @campaignId'); params.campaignId = campaignId; }
  if (guildId) { where.push('c.guild_id = @guildId'); params.guildId = guildId; }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY l.created_at DESC LIMIT @limit OFFSET @offset';
  params.limit = limit;
  params.offset = offset;

  const logs = db.prepare(sql).all(params);

  const countSql = `SELECT COUNT(*) as total FROM session_auto_logs l JOIN session_logs s ON l.session_log_id = s.id JOIN campaigns c ON s.campaign_id = c.id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
  const { total } = db.prepare(countSql).get(params);

  res.json({ logs, total, limit, offset });
});

router.get('/recent', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const guildId = req.query.guildId || null;
  let sql = `
    SELECT l.*, s.title as session_title, s.session_number, c.name as campaign_name
    FROM session_auto_logs l
    JOIN session_logs s ON l.session_log_id = s.id
    JOIN campaigns c ON s.campaign_id = c.id
  `;
  const params = [];
  if (guildId) { sql += ' WHERE c.guild_id = ?'; params.push(guildId); }
  sql += ' ORDER BY l.created_at DESC LIMIT ?';
  params.push(limit);
  const logs = db.prepare(sql).all(...params);
  res.json(logs);
});

router.get('/sessions', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const guildId = req.query.guildId || null;
  let sql = `
    SELECT s.*, c.name as campaign_name,
      (SELECT COUNT(*) FROM session_auto_logs WHERE session_log_id = s.id) as event_count
    FROM session_logs s
    JOIN campaigns c ON s.campaign_id = c.id
  `;
  const params = [];
  if (guildId) { sql += ' WHERE c.guild_id = ?'; params.push(guildId); }
  sql += ' ORDER BY s.created_at DESC LIMIT ?';
  params.push(limit);
  const sessions = db.prepare(sql).all(...params);
  res.json(sessions);
});

router.get('/active', (req, res) => {
  const db = getDb();
  const guildId = req.query.guildId || null;
  let sql = `
    SELECT sa.*, sl.title as session_title, sl.session_number, c.name as campaign_name, c.id as campaign_id
    FROM session_active sa
    JOIN session_logs sl ON sa.session_log_id = sl.id
    JOIN campaigns c ON sl.campaign_id = c.id
  `;
  const params = [];
  if (guildId) { sql += ' WHERE c.guild_id = ?'; params.push(guildId); }
  const active = db.prepare(sql).all(...params);
  res.json(active);
});

export default router;
