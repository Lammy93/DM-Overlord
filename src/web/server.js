import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import path from 'path';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import crypto from 'crypto';
import config from '../config.js';
import { getDb } from '../db/index.js';
import { authenticateWebUser, seedDefaultAdmin, createWebUser, changePassword } from '../services/webUsers.js';
import { getGuildSetting, setGuildSetting } from '../services/guildSettings.js';
import { REST } from 'discord.js';

const discordRest = config.discord.token ? new REST({ version: '10' }).setToken(config.discord.token) : null;
const guildNameCache = { entries: {}, lastFetch: 0 };

async function getGuildNames() {
  if (!discordRest) return {};
  const now = Date.now();
  if (now - guildNameCache.lastFetch < 60000 && Object.keys(guildNameCache.entries).length > 0) {
    return guildNameCache.entries;
  }
  try {
    const guilds = await discordRest.get('/users/@me/guilds');
    const map = {};
    for (const g of guilds) map[g.id] = g.name;
    guildNameCache.entries = map;
    guildNameCache.lastFetch = now;
    return map;
  } catch {
    return guildNameCache.entries;
  }
}
import campaignRoutes from './routes/campaigns.js';
import characterRoutes from './routes/characters.js';
import rollRoutes from './routes/roll.js';
import srdRoutes from './routes/srd.js';
import adventureRoutes from './routes/adventure.js';
import sessionRoutes from './routes/sessions.js';
import mapRoutes from './routes/maps.js';
import logRoutes from './routes/logs.js';
import encounterRoutes from './routes/encounter.js';
import dmRoutes from './routes/dm.js';
import eventBus from '../services/eventBus.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DM_PASSWORD = process.env.WEB_DM_PASSWORD || 'overlord';
const DM_TOKENS = new Map(); // token -> { id, username, display_name }
const PLAYER_TOKENS = new Map(); // token -> { id, username, display_name }

export function requireDmAuth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token && DM_TOKENS.has(token)) return next();
  return res.status(401).json({ error: 'Unauthorized. Log in as DM first.' });
}

export function startWebServer() {
  const app = express();
  const port = Number(config.web?.port) || 3000;

  app.use(express.json());

  const publicDir = join(__dirname, '..', '..', 'public');
  app.use(express.static(publicDir));

  const uploadsDir = join(__dirname, '..', '..', 'data', 'uploads');
  const mapsDir = join(uploadsDir, 'maps');
  const mapDropDir = join(uploadsDir, 'map-drop');
  if (!existsSync(mapsDir)) mkdirSync(mapsDir, { recursive: true });
  if (!existsSync(mapDropDir)) mkdirSync(mapDropDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, mapsDir),
    filename: (req, file) => {
      const ext = file.originalname.split('.').pop() || 'png';
      return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      if (!allowed.includes(file.mimetype)) {
        cb(new Error('Only PNG, JPG, GIF, WebP images are allowed'), false);
      } else {
        cb(null, true);
      }
    },
  });

  app.locals.upload = upload;

  app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
  });

  // Seed default admin on first startup
  seedDefaultAdmin();

  // Auth endpoints
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};

    // Fallback: env var DM_PASSWORD (legacy)
    if (!username && password && DM_PASSWORD) {
      if (password === DM_PASSWORD) {
        const token = crypto.randomBytes(32).toString('hex');
        DM_TOKENS.set(token, { id: null, username: 'admin', display_name: 'DM' });
        return res.json({ success: true, role: 'dm', token });
      }
      return res.status(401).json({ success: false, error: 'Invalid password.' });
    }

    // Primary: authenticate against web_users with admin role
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    const user = authenticateWebUser(username, password);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    
    // Check if user has admin role
    const db = getDb();
    const dbUser = db.prepare('SELECT role, must_change_password FROM web_users WHERE username = ?').get(username);
    if (!dbUser || dbUser.role !== 'admin') return res.status(403).json({ success: false, error: 'User does not have admin privileges.' });

    const token = crypto.randomBytes(32).toString('hex');
    DM_TOKENS.set(token, { id: user.id, username: user.username, display_name: user.display_name });
    res.json({ success: true, role: 'dm', token, user: { username: user.username, display_name: user.display_name }, mustChangePassword: !!dbUser.must_change_password });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (token) {
      DM_TOKENS.delete(token);
      PLAYER_TOKENS.delete(token);
    }
    res.json({ success: true });
  });

  app.post('/api/auth/player-login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    const user = authenticateWebUser(username, password);
    if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
    const token = crypto.randomBytes(24).toString('hex');
    PLAYER_TOKENS.set(token, user);
    // Clean up old tokens for this user (keep only latest)
    for (const [t, u] of PLAYER_TOKENS) {
      if (u.id === user.id && t !== token) PLAYER_TOKENS.delete(t);
    }
    res.json({ success: true, role: 'player', token, user: { username: user.username, display_name: user.display_name }, mustChangePassword: !!user.mustChangePassword });
  });

  app.post('/api/auth/change-password', (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    const dmUser = token ? DM_TOKENS.get(token) : null;
    const playerUser = token ? PLAYER_TOKENS.get(token) : null;
    const authedUser = dmUser || playerUser;
    if (!authedUser) return res.status(401).json({ error: 'Not authenticated.' });
    if (authedUser.id === null) return res.status(400).json({ error: 'Password change not available for legacy admin sessions. Use the web UI admin login instead.' });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password are required.' });

    const result = changePassword(authedUser.id, currentPassword, newPassword);
    if (result.error) return res.status(400).json(result);
    res.json({ success: true });
  });

  app.get('/api/auth/status', (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    const isDm = !DM_PASSWORD || (token && DM_TOKENS.has(token));
    const playerUser = token ? PLAYER_TOKENS.get(token) : null;
    if (playerUser) {
      return res.json({ role: 'player', loggedIn: true, user: { username: playerUser.username, display_name: playerUser.display_name } });
    }
    res.json({ role: isDm ? 'dm' : 'player', hasPassword: !!DM_PASSWORD, loggedIn: isDm || !!playerUser });
  });

  // SSE endpoint for live log stream
  app.get('/api/events/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.write('data: {"type":"connected"}\n\n');

    const onEvent = (event) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (e) { /* ignore */ }
    };

    eventBus.on('log', onEvent);

    const keepAlive = setInterval(() => {
      try { res.write(':keepalive\n\n'); } catch (e) { clearInterval(keepAlive); }
    }, 15000);

    req.on('close', () => {
      eventBus.off('log', onEvent);
      clearInterval(keepAlive);
    });
  });

  // Guild list endpoint (used by guild selector)
  app.get('/api/guilds', requireDmAuth, async (req, res) => {
    const names = await getGuildNames();
    // Merge guilds from Discord API (all guilds bot is in) with campaign guilds
    const db = getDb();
    const campaignGuilds = db.prepare('SELECT DISTINCT guild_id FROM campaigns WHERE guild_id IS NOT NULL').all().map(r => r.guild_id);
    const allIds = new Set([...Object.keys(names), ...campaignGuilds]);
    const guilds = Array.from(allIds).map(id => ({ id, name: names[id] || id }));
    guilds.sort((a, b) => a.name.localeCompare(b.name));
    res.json(guilds);
  });

  // Guild channels endpoint (used by settings page)
  app.get('/api/guilds/:guildId/channels', requireDmAuth, async (req, res) => {
    const names = await getGuildNames();
    const guildName = names[req.params.guildId];
    if (!guildName) return res.status(404).json({ error: 'Guild not found' });
    if (!discordRest) return res.json([]);
    try {
      const channels = await discordRest.get(`/guilds/${req.params.guildId}/channels`);
      const textChannels = channels
        .filter(c => c.type === 0 || c.type === 5)
        .map(c => ({ id: c.id, name: c.name, type: c.type }));
      res.json(textChannels);
    } catch {
      res.json([]);
    }
  });

  // Guild role management
  app.get('/api/guilds/:guildId/roles', requireDmAuth, (req, res) => {
    const db = getDb();
    const guildId = req.params.guildId;

    // Get all campaigns in this guild
    const campaigns = db.prepare('SELECT id, name FROM campaigns WHERE guild_id = ?').all(guildId);
    const campaignIds = campaigns.map(c => c.id);

    // Get all players across those campaigns with their roles
    const players = [];
    if (campaignIds.length) {
      const placeholders = campaignIds.map(() => '?').join(',');
      const rows = db.prepare(`SELECT DISTINCT cp.discord_id, cp.discord_username, cp.role AS campaign_role, cp.campaign_id, c.name AS campaign_name FROM campaign_players cp JOIN campaigns c ON cp.campaign_id = c.id WHERE cp.campaign_id IN (${placeholders}) ORDER BY cp.discord_username`).all(...campaignIds);
      players.push(...rows);
    }

    // Get guild admins
    const admins = db.prepare('SELECT discord_id, discord_username, role FROM guild_admins WHERE guild_id = ?').all(guildId);

    // Get all characters with player links
    const allChars = campaignIds.length
      ? db.prepare(`SELECT id, name, race, class, level, player_discord_id, campaign_id FROM characters WHERE campaign_id IN (${campaignIds.map(() => '?').join(',')}) AND player_discord_id IS NOT NULL AND player_discord_id != ''`).all(...campaignIds)
      : [];

    // Resolve Discord usernames for any player_discord_id in characters that isn't in players/admins
    const knownIds = new Set([...players.map(p => p.discord_id), ...admins.map(a => a.discord_id)]);
    for (const ch of allChars) {
      if (!knownIds.has(ch.player_discord_id)) {
        players.push({ discord_id: ch.player_discord_id, discord_username: null, campaign_role: 'player', campaign_id: ch.campaign_id, campaign_name: campaigns.find(c => c.id === ch.campaign_id)?.name });
        knownIds.add(ch.player_discord_id);
      }
    }

    res.json({
      campaigns,
      players: players.map(p => ({
        discordId: p.discord_id,
        username: p.discord_username || p.discord_id,
        campaignRole: p.campaign_role || 'player',
        campaignId: p.campaign_id,
        campaignName: p.campaign_name,
        characters: allChars.filter(ch => ch.player_discord_id === p.discord_id).map(ch => ({ id: ch.id, name: ch.name, level: ch.level, race: ch.race, class: ch.class, campaignId: ch.campaign_id })),
      })),
      admins: admins.map(a => ({ discordId: a.discord_id, username: a.discord_username || a.discord_id, role: a.role })),
    });
  });

  // Update a player's campaign role
  app.put('/api/guilds/:guildId/roles', requireDmAuth, (req, res) => {
    const { discordId, campaignId, role } = req.body;
    if (!discordId || !campaignId || !role) return res.status(400).json({ error: 'discordId, campaignId, and role are required' });
    const db = getDb();
    const validRoles = ['player', 'co-dm', 'observer'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
    db.prepare('UPDATE campaign_players SET role = ? WHERE campaign_id = ? AND discord_id = ?').run(role, campaignId, discordId);
    res.json({ success: true });
  });

  // File browser upload
  const fileUploadMw = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadsDir = join(__dirname, '..', '..', 'data', 'uploads');
        if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
        cb(null, uploadsDir);
      },
      filename: (req, file) => {
        const ext = path.extname(file.originalname);
        return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.post('/api/files/upload', requireDmAuth, (req, res) => {
    fileUploadMw.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      res.json({ success: true, file: { name: req.file.filename, originalName: req.file.originalname, size: req.file.size, path: req.file.filename } });
    });
  });

  // File browser
  app.get('/api/files', requireDmAuth, (req, res) => {
    const uploadsDir = join(__dirname, '..', '..', 'data', 'uploads');
    function scan(dir, relative) {
      const entries = [];
      try {
        for (const name of readdirSync(dir)) {
          const fullPath = join(dir, name);
          const stat = statSync(fullPath);
          entries.push({ name, path: join(relative, name), size: stat.size, isDirectory: stat.isDirectory(), modified: stat.mtime });
          if (stat.isDirectory()) entries.push(...scan(fullPath, join(relative, name)));
        }
      } catch {}
      return entries;
    }
    const files = scan(uploadsDir, '');
    res.json({ files, root: uploadsDir });
  });

  // Guild settings endpoints
  app.get('/api/settings/:guildId', requireDmAuth, (req, res) => {
    const embedChannel = getGuildSetting(req.params.guildId, 'embed_channel');
    res.json({ guildId: req.params.guildId, embed_channel: embedChannel || '' });
  });

  app.put('/api/settings/:guildId', requireDmAuth, (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });
    setGuildSetting(req.params.guildId, key, value || '');
    res.json({ success: true });
  });

  // Player-accessible routes (no auth required)
  app.use('/api/roll', rollRoutes);
  app.use('/api/srd', srdRoutes);
  app.use('/api/maps', mapRoutes);
  app.use('/api/auth', (req, res, next) => next());

  // DM-only routes
  app.use('/api/campaigns', requireDmAuth, campaignRoutes);
  app.use('/api/characters', requireDmAuth, characterRoutes);
  app.use('/api/adventures', requireDmAuth, adventureRoutes);
  app.use('/api/sessions', requireDmAuth, sessionRoutes);
  app.use('/api/logs', requireDmAuth, logRoutes);
  app.use('/api/dm', requireDmAuth, dmRoutes);
  app.use('/api/encounters', requireDmAuth, encounterRoutes);

  app.use((err, req, res, next) => {
    console.error('Web error:', err);
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Max 10 MB.' });
    }
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
  });

  const host = config.web?.host || 'localhost';
  const baseUrl = config.web?.baseUrl || '';

  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      console.log(`Web UI: http://${host}:${port}`);
      if (baseUrl) console.log(`Web UI (external): ${baseUrl}`);
      resolve(server);
    });
  });
}
