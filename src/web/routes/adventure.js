import { Router } from 'express';
import {
  getModule, listModules, createModule, updateModule, deleteModule,
  startAdventure, getSession, getActiveSessions,
  getCurrentScene, goToScene, renderSceneText, processChoice,
  endAdventure, setVariable, getVariable, lobbyStart,
} from '../../services/adventure.js';

const router = Router();

router.get('/', (req, res) => {
  const { campaignId } = req.query;
  if (!campaignId) return res.json([]);
  const modules = listModules(parseInt(campaignId, 10));
  res.json(modules.map(m => ({
    id: m.id, title: m.title, description: m.description,
    min_level: m.min_level, max_level: m.max_level,
    scene_count: m.scenes?.length || 0, setting: m.setting,
  })));
});

router.get('/:id', (req, res) => {
  const mod = getModule(parseInt(req.params.id, 10));
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  res.json(mod);
});

router.post('/', (req, res) => {
  const mod = createModule(req.body);
  res.status(201).json({ id: mod.id, title: mod.title });
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getModule(id);
  if (!existing) return res.status(404).json({ error: 'Module not found' });
  const updated = updateModule(id, req.body);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getModule(id);
  if (!existing) return res.status(404).json({ error: 'Module not found' });
  deleteModule(id);
  res.json({ success: true });
});

router.get('/:id/sessions', (req, res) => {
  const campaignId = parseInt(req.query.campaignId, 10);
  if (!campaignId) return res.status(400).json({ error: 'campaignId query param required' });
  const sessions = getActiveSessions(campaignId).filter(s => s.module_id === parseInt(req.params.id, 10));
  res.json(sessions);
});

router.post('/:id/start', (req, res) => {
  const moduleId = parseInt(req.params.id, 10);
  const mod = getModule(moduleId);
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  const { campaignId, dmDiscordId } = req.body;
  if (!campaignId || !dmDiscordId) return res.status(400).json({ error: 'campaignId and dmDiscordId are required' });
  const session = startAdventure(moduleId, parseInt(campaignId, 10), dmDiscordId);
  res.status(201).json({ session });
});

// Session endpoints
router.get('/sessions/:id', (req, res) => {
  const session = getSession(parseInt(req.params.id, 10));
  if (!session) return res.status(404).json({ error: 'Session not found' });
  let scene = null;
  if (session.currentSceneId) {
    const raw = getCurrentScene(session.id);
    if (raw) scene = renderSceneText(raw, session);
  }
  const mod = getModule(session.module_id);
  res.json({ session, mod: mod ? { id: mod.id, title: mod.title, scenes: mod.scenes } : null, scene });
});

router.post('/sessions/:id/choose', (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  const { choiceId } = req.body;
  if (!choiceId) return res.status(400).json({ error: 'choiceId is required' });
  const result = processChoice(sessionId, choiceId);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

router.post('/sessions/:id/goto', (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  const { sceneId } = req.body;
  if (!sceneId) return res.status(400).json({ error: 'sceneId is required' });
  goToScene(sessionId, sceneId);
  const session = getSession(sessionId);
  const scene = getCurrentScene(sessionId);
  const rendered = renderSceneText(scene, session);
  res.json({ session, scene: rendered });
});

router.post('/sessions/:id/end', (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  endAdventure(sessionId, req.body.state || 'completed');
  res.json({ success: true });
});

router.post('/sessions/:id/start', (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  const { dmDiscordId } = req.body;
  if (!dmDiscordId) return res.status(400).json({ error: 'dmDiscordId is required' });
  const result = lobbyStart(sessionId, dmDiscordId);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

router.get('/sessions/:id/scene', (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  const scene = getCurrentScene(sessionId);
  if (!scene) return res.status(404).json({ error: 'No current scene' });
  const session = getSession(sessionId);
  const rendered = renderSceneText(scene, session);
  res.json(rendered);
});

export default router;
