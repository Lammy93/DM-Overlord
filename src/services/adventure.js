import { getDb } from '../db/index.js';
import { getNarration } from './narration.js';
import { rollDice } from './dice.js';
import { postToCampaignChannel, narrationEmbed, characterSpeechEmbed, logChoiceToDiscord, logSceneTransition } from './discordLog.js';

export function createModule(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO adventure_modules (campaign_id, author_discord_id, title, description, min_level, max_level, setting, scenes, variables)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.campaignId || null,
    data.authorDiscordId,
    data.title,
    data.description || null,
    data.minLevel || 1,
    data.maxLevel || 20,
    data.setting || null,
    JSON.stringify(data.scenes || []),
    JSON.stringify(data.variables || {})
  );
  return getModule(result.lastInsertRowid);
}

export function getModule(id) {
  const db = getDb();
  const mod = db.prepare('SELECT * FROM adventure_modules WHERE id = ?').get(id);
  if (!mod) return null;
  return parseModuleFields(mod);
}

export function listModules(campaignId) {
  const db = getDb();
  return db.prepare('SELECT * FROM adventure_modules WHERE campaign_id = ? ORDER BY created_at DESC').all(campaignId).map(parseModuleFields);
}

export function updateModule(id, data) {
  const db = getDb();
  const fields = [];
  const values = {};
  for (const [key, value] of Object.entries(data)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    const val = Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : value;
    fields.push(`${dbKey} = @${key}`);
    values[key] = val;
  }
  if (fields.length === 0) return getModule(id);
  values.id = id;
  fields.push('updated_at = CURRENT_TIMESTAMP');
  db.prepare(`UPDATE adventure_modules SET ${fields.join(', ')} WHERE id = @id`).run(values);
  return getModule(id);
}

export function deleteModule(id) {
  const db = getDb();
  db.prepare('DELETE FROM adventure_modules WHERE id = ?').run(id);
}

export function setLobbyMessageId(sessionId, messageId) {
  const db = getDb();
  db.prepare('UPDATE adventure_sessions SET variables = json_set(COALESCE(variables, \'{}\'), \'$.lobby_message_id\', ?) WHERE id = ?').run(messageId, sessionId);
}

export function getLobbyMessageId(session) {
  return session?.variables?.lobby_message_id || null;
}

export function startAdventure(moduleId, campaignId, dmDiscordId) {
  const db = getDb();
  const mod = getModule(moduleId);
  if (!mod) return null;

  // Check for existing lobby for this module+campaign
  const existing = db.prepare("SELECT id FROM adventure_sessions WHERE module_id = ? AND campaign_id = ? AND state = 'not_started' AND current_scene_id IS NULL").get(moduleId, campaignId);
  if (existing) return getSession(existing.id);

  const stmt = db.prepare(`
    INSERT INTO adventure_sessions (module_id, campaign_id, dm_discord_id, state, current_scene_id, variables, history, player_states)
    VALUES (?, ?, ?, 'not_started', NULL, ?, '[]', '{}')
  `);
  const result = stmt.run(
    moduleId,
    campaignId || null,
    dmDiscordId,
    JSON.stringify(mod.variables || {})
  );
  return getSession(result.lastInsertRowid);
}

export function lobbyJoin(sessionId, playerDiscordId, playerName, characterId, characterName) {
  const db = getDb();
  const session = getSession(sessionId);
  if (!session || session.state !== 'not_started') return { error: 'No active lobby for this session.' };
  const states = session.playerStates || {};
  states[playerDiscordId] = { discordId: playerDiscordId, playerName, characterId, characterName, joinedAt: new Date().toISOString(), ready: false };
  db.prepare('UPDATE adventure_sessions SET player_states = ? WHERE id = ?').run(JSON.stringify(states), sessionId);
  return { success: true, players: Object.values(states) };
}

export function lobbyLeave(sessionId, playerDiscordId) {
  const db = getDb();
  const session = getSession(sessionId);
  if (!session || session.state !== 'not_started') return { error: 'No active lobby.' };
  const states = session.playerStates || {};
  delete states[playerDiscordId];
  db.prepare('UPDATE adventure_sessions SET player_states = ? WHERE id = ?').run(JSON.stringify(states), sessionId);
  return { success: true };
}

export function lobbySetReady(sessionId, playerDiscordId, ready) {
  const db = getDb();
  const session = getSession(sessionId);
  if (!session || session.state !== 'not_started') return { error: 'No active lobby.' };
  const states = session.playerStates || {};
  if (!states[playerDiscordId]) return { error: 'You are not in this lobby.' };
  states[playerDiscordId].ready = ready;
  db.prepare('UPDATE adventure_sessions SET player_states = ? WHERE id = ?').run(JSON.stringify(states), sessionId);
  return { success: true, players: Object.values(states) };
}

export function lobbyStart(sessionId, dmDiscordId) {
  const db = getDb();
  const session = getSession(sessionId);
  if (!session) return { error: 'Session not found.' };
  if (session.state !== 'not_started') return { error: 'Session has not started yet.' };

  // Allow session DM, campaign DM, and guild admins/co-dms to start
  const isSessionDm = session.dm_discord_id === dmDiscordId;
  const isGuildAdmin = session.campaign_id && (() => {
    const campaign = db.prepare('SELECT guild_id FROM campaigns WHERE id = ?').get(session.campaign_id);
    if (!campaign) return false;
    return !!db.prepare("SELECT 1 FROM guild_admins WHERE guild_id = ? AND discord_id = ? AND role IN ('admin','co-dm')").get(campaign.guild_id, dmDiscordId);
  })();
  if (!isSessionDm && !isGuildAdmin) return { error: 'Only the DM or a guild admin can start the adventure.' };

  const mod = getModule(session.module_id);
  if (!mod) return { error: 'Module not found.' };
  const firstScene = mod.scenes[0];
  if (!firstScene) return { error: 'Module has no scenes.' };

  db.prepare('UPDATE adventure_sessions SET state = ?, current_scene_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('running', firstScene.id, sessionId);
  const updated = getSession(sessionId);
  const rendered = renderSceneText(firstScene, updated);
  return { session: updated, scene: rendered };
}

export function getSession(id) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM adventure_sessions WHERE id = ?').get(id);
  if (!session) return null;
  return parseSessionFields(session);
}

export function getActiveSessions(campaignId) {
  const db = getDb();
  return db.prepare("SELECT * FROM adventure_sessions WHERE campaign_id = ? AND state IN ('running','paused') ORDER BY updated_at DESC")
    .all(campaignId)
    .map(parseSessionFields);
}

export function getCurrentScene(sessionId) {
  const session = getSession(sessionId);
  if (!session || !session.currentSceneId) return null;
  const mod = getModule(session.module_id);
  if (!mod) return null;
  return mod.scenes.find(s => s.id === session.currentSceneId) || null;
}

export function goToScene(sessionId, sceneId) {
  const db = getDb();
  const session = getSession(sessionId);
  if (!session) return null;
  const mod = getModule(session.module_id);
  if (!mod) return null;
  const scene = mod.scenes.find(s => s.id === sceneId);
  if (!scene) return null;

  const history = [...session.history, {
    sceneId: session.currentSceneId,
    timestamp: new Date().toISOString(),
  }];

  db.prepare('UPDATE adventure_sessions SET current_scene_id = ?, history = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(sceneId, JSON.stringify(history), sessionId);
  return getSession(sessionId);
}

export function setVariable(sessionId, key, value) {
  const db = getDb();
  const session = getSession(sessionId);
  if (!session) return null;
  const vars = { ...session.variables, [key]: value };
  db.prepare('UPDATE adventure_sessions SET variables = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(vars), sessionId);
  return getSession(sessionId);
}

export function getVariable(sessionId, key) {
  const session = getSession(sessionId);
  if (!session) return null;
  return session.variables[key];
}

export function endAdventure(sessionId, state = 'completed') {
  const db = getDb();
  db.prepare('UPDATE adventure_sessions SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(state, sessionId);
  return getSession(sessionId);
}

export function renderSceneText(scene, session) {
  if (!scene) return null;

  const vars = session?.variables || {};
  let text = scene.text || '';

  Object.entries(vars).forEach(([key, value]) => {
    text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  });

  let narration = '';
  if (scene.type === 'combat') {
    narration = getNarration('encounter_start');
  }

  const choices = (scene.choices || []).map((c, i) => ({
    id: c.id || `choice_${i + 1}`,
    label: c.label || c.text,
    text: c.text,
    nextScene: c.nextScene,
    requiredCheck: c.requiredCheck || null,
    condition: c.condition || null,
  }));

  return {
    id: scene.id,
    type: scene.type || 'narrative',
    title: scene.title || null,
    text: narration ? `${narration}\n\n${text}` : text,
    narration,
    choices,
    monsters: scene.monsters || [],
    loot: scene.loot || null,
    skillChecks: scene.skillChecks || [],
    environment: scene.environment || null,
  };
}

export function processChoice(sessionId, choiceId) {
  const session = getSession(sessionId);
  if (!session) return { error: 'Session not found' };

  const scene = getCurrentScene(sessionId);
  if (!scene) return { error: 'No current scene' };

  const choice = (scene.choices || []).find(c => c.id === choiceId || c.id === `choice_${choiceId}`);
  if (!choice) return { error: 'Invalid choice' };

  if (choice.condition) {
    const passed = evaluateCondition(choice.condition, session.variables);
    if (!passed) return { error: choice.condition.failText || 'You cannot do that.' };
  }

  if (choice.requiredCheck) {
    const check = choice.requiredCheck;
    const result = rollDice('1d20');
    const total = result.total + (check.modifier || 0);
    const success = total >= (check.dc || 10);
    if (!success && !check.allowFailure) {
      return {
        error: check.failText || `You failed the ${check.skill || 'check'} (DC ${check.dc}).`,
        failed: true,
        roll: result,
      };
    }
  }

  if (choice.setVariables) {
    Object.entries(choice.setVariables).forEach(([key, value]) => {
      setVariable(sessionId, key, value);
    });
  }

  if (choice.nextScene) {
    goToScene(sessionId, choice.nextScene);
    const newScene = getCurrentScene(sessionId);
    const newSession = getSession(sessionId);

    logChoiceToDiscord(session.campaign_id, 'The Party', choice.label || choice.text, scene.title).catch(() => {});
    if (newScene) {
      const rendered = renderSceneText(newScene, newSession);
      logSceneTransition(session.campaign_id, rendered?.title || newScene.title, rendered?.text || newScene.text || '').catch(() => {});
    }

    return {
      success: true,
      choice: choice.label || choice.text,
      nextScene: newScene ? renderSceneText(newScene, getSession(sessionId)) : null,
    };
  }

  logChoiceToDiscord(session.campaign_id, 'The Party', choice.label || choice.text, scene.title).catch(() => {});
  return { success: true, choice: choice.label || choice.text };
}

export function getModuleFromJson(json) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (!data.title || !data.scenes || !Array.isArray(data.scenes)) {
      return { valid: false, error: 'Module must have title and scenes array' };
    }
    if (data.scenes.length === 0) {
      return { valid: false, error: 'Module must have at least one scene' };
    }
    for (const scene of data.scenes) {
      if (!scene.id || !scene.text) {
        return { valid: false, error: 'Each scene must have id and text' };
      }
    }
    return { valid: true, data };
  } catch {
    return { valid: false, error: 'Invalid JSON' };
  }
}

function evaluateCondition(condition, variables) {
  if (!condition) return true;
  const { key, operator, value } = condition;
  const actual = variables[key];
  switch (operator) {
    case 'equals': return actual === value;
    case 'not_equals': return actual !== value;
    case 'greater_than': return actual > value;
    case 'less_than': return actual < value;
    case 'has': return actual !== undefined && actual !== null;
    case 'not_has': return actual === undefined || actual === null;
    default: return true;
  }
}

function parseModuleFields(mod) {
  return {
    ...mod,
    scenes: parseField(mod.scenes, []),
    variables: parseField(mod.variables, {}),
  };
}

function parseSessionFields(session) {
  return {
    ...session,
    variables: parseField(session.variables, {}),
    history: parseField(session.history, []),
    playerStates: parseField(session.player_states, {}),
  };
}

function parseField(field, fallback) {
  if (!field) return fallback;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return fallback;
  }
}
