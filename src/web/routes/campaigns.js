import { Router } from 'express';
import { getDb } from '../../db/index.js';
import { createCampaign, getCampaign, updateCampaign, deleteCampaign,
  addPlayer, removePlayer, getCampaignPlayers, addLocation, getLocations, addNote, getNotes } from '../../services/campaign.js';
import { writeLocationNote } from '../../services/obsidian.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const guildId = req.query.guildId || null;
  const allCampaigns = req.query.all === '1' || req.query.library === '1';
  let sql = 'SELECT * FROM campaigns';
  const params = [];
  if (guildId) { sql += ' WHERE guild_id = ?'; params.push(guildId); }
  sql += ' ORDER BY updated_at DESC';
  const campaigns = db.prepare(sql).all(...params);
  res.json(campaigns);
});

router.get('/:id', (req, res) => {
  const campaign = getCampaign(parseInt(req.params.id, 10));
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

router.post('/', (req, res) => {
  const campaign = createCampaign(req.body);
  res.status(201).json(campaign);
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const campaign = getCampaign(id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const updated = updateCampaign(id, req.body);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const campaign = getCampaign(id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  deleteCampaign(id);
  res.json({ success: true });
});

router.get('/:id/players', (req, res) => {
  const players = getCampaignPlayers(parseInt(req.params.id, 10));
  res.json(players);
});

router.post('/:id/players', (req, res) => {
  const { discordId, username, role } = req.body;
  addPlayer(parseInt(req.params.id, 10), discordId, username, role || 'player');
  res.status(201).json({ success: true });
});

router.delete('/:id/players/:discordId', (req, res) => {
  removePlayer(parseInt(req.params.id, 10), req.params.discordId);
  res.json({ success: true });
});

router.get('/:id/locations', (req, res) => {
  res.json(getLocations(parseInt(req.params.id, 10)));
});

router.post('/:id/locations', (req, res) => {
  const loc = addLocation(parseInt(req.params.id, 10), req.body);
  const campaign = getCampaign(parseInt(req.params.id, 10));
  writeLocationNote(loc, campaign?.name).catch(() => {});
  res.status(201).json(loc);
});

router.get('/:id/notes', (req, res) => {
  res.json(getNotes(parseInt(req.params.id, 10)));
});

router.post('/:id/notes', (req, res) => {
  const note = addNote(parseInt(req.params.id, 10), req.body);
  res.status(201).json(note);
});

export default router;
