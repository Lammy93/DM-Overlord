import { Router } from 'express';
import { getDb } from '../../db/index.js';
import { createCharacter, getCharacter, getCampaignCharacters, getPlayerCharacters, updateCharacter, deleteCharacter } from '../../services/character.js';
import { writeCharacterNote } from '../../services/obsidian.js';
import config from '../../config.js';
import { REST } from 'discord.js';

const router = Router();
const discordRest = config.discord.token ? new REST({ version: '10' }).setToken(config.discord.token) : null;
const userNameCache = { entries: {}, lastFetch: 0 };

async function resolveUserName(discordId) {
  if (!discordRest || !discordId) return null;
  const now = Date.now();
  if (now - userNameCache.lastFetch > 300000) userNameCache.entries = {};
  if (userNameCache.entries[discordId]) return userNameCache.entries[discordId];
  try {
    const user = await discordRest.get(`/users/${discordId}`);
    const name = user?.global_name || user?.username || null;
    if (name) { userNameCache.entries[discordId] = name; userNameCache.lastFetch = now; }
    return name;
  } catch {
    return null;
  }
}

async function enrichWithPlayerName(characters) {
  return Promise.all(characters.map(async ch => {
    if (ch.player_discord_id && !ch.player_name) {
      ch.player_name = await resolveUserName(ch.player_discord_id);
    }
    return ch;
  }));
}

router.get('/', async (req, res) => {
  const { campaignId, playerDiscordId, search } = req.query;
  if (campaignId) return res.json(getCampaignCharacters(parseInt(campaignId, 10)));
  if (playerDiscordId) return res.json(getPlayerCharacters(playerDiscordId));
  const db = getDb();
  const baseSql = `
    SELECT c.id, c.name, c.race, c.class, c.level, c.background,
           c.player_discord_id, c.campaign_id, c.hp_max, c.armor_class,
           c.image_url, wu.display_name AS player_name
    FROM characters c
    LEFT JOIN web_users wu ON c.player_discord_id = wu.discord_id
  `;
  if (search) {
    const like = `%${search}%`;
    const results = db.prepare(`${baseSql} WHERE c.is_active = 1 AND (c.name LIKE ? OR c.player_discord_id LIKE ?) ORDER BY c.updated_at DESC LIMIT 50`).all(like, like);
    return res.json(await enrichWithPlayerName(results));
  }
  const all = db.prepare(`${baseSql} WHERE c.is_active = 1 ORDER BY c.updated_at DESC`).all();
  res.json(await enrichWithPlayerName(all));
});

router.get('/:id', (req, res) => {
  const character = getCharacter(parseInt(req.params.id, 10));
  if (!character) return res.status(404).json({ error: 'Character not found' });
  res.json(character);
});

router.post('/', (req, res) => {
  try {
    const character = createCharacter(req.body);
    res.status(201).json(character);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const character = getCharacter(id);
  if (!character) return res.status(404).json({ error: 'Character not found' });
  const updated = updateCharacter(id, req.body);
  writeCharacterNote(getCharacter(id)).catch(() => {});
  res.json(updated);
});

router.put('/:id/link', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { discordId } = req.body;
  if (!discordId || discordId === '') return res.status(400).json({ error: 'discordId is required' });
  const character = getCharacter(id);
  if (!character) return res.status(404).json({ error: 'Character not found' });
  const db = getDb();
  db.prepare('UPDATE characters SET player_discord_id = ? WHERE id = ?').run(discordId, id);
  const updated = getCharacter(id);
  writeCharacterNote(updated).catch(() => {});
  res.json({ success: true, characterId: id, linkedTo: discordId });
});

router.delete('/:id/link', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const character = getCharacter(id);
  if (!character) return res.status(404).json({ error: 'Character not found' });
  const db = getDb();
  db.prepare("UPDATE characters SET player_discord_id = '' WHERE id = ?").run(id);
  const updated = getCharacter(id);
  writeCharacterNote(updated).catch(() => {});
  res.json({ success: true, characterId: id, unlinked: true });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const character = getCharacter(id);
  if (!character) return res.status(404).json({ error: 'Character not found' });
  deleteCharacter(id);
  res.json({ success: true });
});

// Import character from standard D&D 5e JSON format (Roll20 compatible)
router.post('/import-json', (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.name) return res.status(400).json({ error: 'Character name is required' });

    // Map standard JSON fields to DM-Overlord schema
    const getVal = (obj, ...keys) => { for (const k of keys) { if (obj[k] != null) return obj[k]; } return null; };

    // Stats (handle both flat and nested formats)
    const stats = {};
    const statsSrc = data.stats || data.abilityScores || data.abilities || {};
    for (const s of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      const val = statsSrc[s] ?? statsSrc[s.toUpperCase()] ?? statsSrc[s.charAt(0).toUpperCase() + s.slice(1)];
      if (val != null) stats[s] = val;
    }
    // Also check for nested objects like { strength: { value: 15 } }
    if (Object.keys(stats).length === 0) {
      for (const s of ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']) {
        const entry = statsSrc[s];
        if (typeof entry === 'object' && entry.value != null) stats[s.slice(0, 3)] = entry.value;
        else if (typeof entry === 'number') stats[s.slice(0, 3)] = entry;
      }
    }

    // HP
    const hpMax = getVal(data, 'hpMax', 'hp_max', 'hitPoints', 'hp');
    const hpCurrent = getVal(data, 'hpCurrent', 'hp_current', 'hp') || hpMax;

    // AC
    const ac = getVal(data, 'armorClass', 'armor_class', 'ac');

    // Class (handle both string and { name } formats)
    let charClass = 'Unknown';
    if (data.class) charClass = typeof data.class === 'string' ? data.class : (data.class.name || data.class.class || 'Unknown');
    else if (data.classes?.length) {
      const cls = data.classes[0];
      charClass = typeof cls === 'string' ? cls : cls.name || cls.class || 'Unknown';
    }

    // Race (handle both string and { name } formats)
    let race = data.race || 'Unknown';
    if (typeof race === 'object') race = race.name || race.race || 'Unknown';

    // Background
    let bg = data.background || null;
    if (typeof bg === 'object') bg = bg.name || null;

    // Alignment
    let alignment = data.alignment || null;
    if (typeof alignment === 'object') alignment = alignment.name || null;

    // XP
    const xp = getVal(data, 'xp', 'experience') || 0;

    // Skills
    const skills = {};
    const skillSrc = data.skills || data.proficiencies || {};
    for (const s of ['acrobatics', 'animal handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight of hand', 'stealth', 'survival']) {
      const val = skillSrc[s] ?? skillSrc[s.replace(' ', '_')];
      if (val) skills[s.toLowerCase()] = true;
    }

    // Proficiencies (array)
    let proficiencies = [];
    if (Array.isArray(data.proficiencies)) proficiencies = data.proficiencies;
    else if (data.skills && Array.isArray(data.skills)) proficiencies = Object.keys(data.skills).filter(k => data.skills[k]);

    // Features & Traits
    let features = [];
    if (Array.isArray(data.features)) features = data.features;
    else if (data.traits) features = Array.isArray(data.traits) ? data.traits : [];

    // Inventory / Equipment
    let inventory = [];
    if (Array.isArray(data.inventory)) inventory = data.inventory;
    else if (data.equipment) inventory = Array.isArray(data.equipment) ? data.equipment : [];
    else if (data.items) inventory = Array.isArray(data.items) ? data.items : [];

    // Spells
    let spells = data.spells || {};

    // Currency
    const currency = data.currency || data.wealth || {};

    // Build the character data
    const charData = {
      playerDiscordId: data.playerDiscordId || data.player?.id || '',
      name: data.name,
      race,
      class: charClass,
      level: data.level || 1,
      background: bg,
      alignment,
      experience: xp,
      stats,
      hpCurrent,
      hpMax,
      armorClass: ac,
      proficiencies,
      features,
      spells,
      inventory,
      copper: currency.cp || currency.copper || 0,
      silver: currency.sp || currency.silver || 0,
      electrum: currency.ep || currency.electrum || 0,
      gold: currency.gp || currency.gold || 0,
      platinum: currency.pp || currency.platinum || 0,
      personalityTraits: data.personalityTraits || data.details?.personality || null,
      ideals: data.ideals || data.details?.ideals || null,
      bonds: data.bonds || data.details?.bonds || null,
      flaws: data.flaws || data.details?.flaws || null,
      appearance: data.appearance || data.details?.appearance || null,
      imageUrl: data.imageUrl || data.image_url || data.avatar || null,
    };

    const character = createCharacter(charData);
    res.status(201).json(character);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
