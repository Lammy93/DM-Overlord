import { getDb } from '../db/index.js';
import { createSessionLog, getSessionLog, getCampaign } from './campaign.js';
import { writeSessionNote } from './obsidian.js';

export function startAutoSession(campaignId, sessionNumber, dmDiscordId, channelId = null, title = null) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM session_active WHERE campaign_id = ?').get(campaignId);
  if (existing) {
    const session = getSessionLog(existing.session_log_id);
    return { session, active: existing, message: `Already logging Session ${session.session_number}. Use /session stop first.` };
  }

  const session = createSessionLog(campaignId, sessionNumber, { title });
  db.prepare(`
    INSERT INTO session_active (campaign_id, session_log_id, channel_id, started_by_discord_id)
    VALUES (?, ?, ?, ?)
  `).run(campaignId, session.id, channelId, dmDiscordId);

  logEvent(session.id, 'narrative', 'Session Started', `Session ${sessionNumber}${title ? ': ' + title : ''} has begun.`, dmDiscordId);
  return { session, active: db.prepare('SELECT * FROM session_active WHERE campaign_id = ?').get(campaignId), message: null };
}

export function stopAutoSession(campaignId, dmDiscordId) {
  const db = getDb();
  const active = db.prepare('SELECT * FROM session_active WHERE campaign_id = ?').get(campaignId);
  if (!active) return { error: 'No active session' };

  const session = getSessionLog(active.session_log_id);
  logEvent(active.session_log_id, 'narrative', 'Session Ended', `Session ${session.session_number} has concluded.`, dmDiscordId);
  db.prepare('DELETE FROM session_active WHERE campaign_id = ?').run(campaignId);
  return { session };
}

export function getActiveSession(campaignId) {
  const db = getDb();
  const active = db.prepare('SELECT * FROM session_active WHERE campaign_id = ?').get(campaignId);
  if (!active) return null;
  const session = getSessionLog(active.session_log_id);
  const logs = getSessionEvents(active.session_log_id);
  return { active, session, logs };
}

export function logEvent(sessionLogId, type, title, content, authorDiscordId = null, authorUsername = null, isDmOnly = false) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO session_auto_logs (session_log_id, type, title, content, author_discord_id, author_username, is_dm_only)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(sessionLogId, type, title, content || null, authorDiscordId, authorUsername, isDmOnly ? 1 : 0);
  return db.prepare('SELECT * FROM session_auto_logs WHERE id = ?').get(result.lastInsertRowid);
}

export function logToActiveSession(campaignId, type, title, content, authorDiscordId = null, authorUsername = null, isDmOnly = false) {
  const active = getActiveSession(campaignId);
  if (!active) return null;
  return logEvent(active.session.session_log_id, type, title, content, authorDiscordId, authorUsername, isDmOnly);
}

export function getSessionEvents(sessionLogId) {
  const db = getDb();
  return db.prepare('SELECT * FROM session_auto_logs WHERE session_log_id = ? AND is_dm_only = 0 ORDER BY created_at ASC').all(sessionLogId);
}

export function getSessionEventsAll(sessionLogId) {
  const db = getDb();
  return db.prepare('SELECT * FROM session_auto_logs WHERE session_log_id = ? ORDER BY created_at ASC').all(sessionLogId);
}

export function buildSessionSummary(sessionLogId) {
  const session = getSessionLog(sessionLogId);
  if (!session) return null;

  const events = getSessionEventsAll(sessionLogId);
  const byType = {};
  for (const e of events) {
    if (!byType[e.type]) byType[e.type] = [];
    byType[e.type].push(e);
  }

  return {
    session,
    events,
    counts: {
      total: events.length,
      narrative: byType.narrative?.length || 0,
      combat: byType.combat?.length || 0,
      interaction: byType.interaction?.length || 0,
      character_update: byType.character_update?.length || 0,
      loot: byType.loot?.length || 0,
      note: byType.note?.length || 0,
      milestone: byType.milestone?.length || 0,
      roll: byType.roll?.length || 0,
    },
    highlights: byType.milestone || [],
    combats: byType.combat || [],
    characterChanges: byType.character_update || [],
    interactions: byType.interaction || [],
    loot: byType.loot || [],
    byType,
  };
}

export function syncToObsidian(sessionLogId) {
  const summary = buildSessionSummary(sessionLogId);
  if (!summary) return { error: 'Session not found' };

  const campaign = getCampaign(summary.session.campaign_id);
  const campaignName = campaign?.name || 'Unknown';

  let logContent = '';
  for (const event of summary.events) {
    const emoji = {
      narrative: '📖', combat: '⚔️', interaction: '💬',
      character_update: '📝', loot: '💰', note: '📌',
      milestone: '⭐', roll: '🎲', location_change: '📍',
    }[event.type] || '•';
    const author = event.author_username ? ` *(${event.author_username})*` : '';
    logContent += `\n- ${emoji} **${event.title}**${author}\n  ${event.content || ''}\n`;
  }

  const enriched = {
    ...summary.session,
    log_content: logContent,
    highlights: summary.highlights.map(h => `- ⭐ **${h.title}**: ${h.content}`).join('\n'),
    loot_found: summary.loot.map(l => `- 💰 ${l.title}: ${l.content}`).join('\n') || summary.session.loot_found,
    summary: summary.session.summary || `Session ${summary.session.session_number} with ${summary.counts.total} logged events.`,
  };

  return writeSessionNote(enriched, campaignName);
}
