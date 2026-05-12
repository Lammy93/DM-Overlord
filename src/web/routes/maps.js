import { Router } from 'express';
import { readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { getCampaignMaps, getMap, addMap, updateMap, deleteMap, addPin, deletePin, updatePin, updateMapFog } from '../../services/maps.js';
import eventBus from '../../services/eventBus.js';
import { requireDmAuth } from '../server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DROP_DIR = join(__dirname, '..', '..', '..', 'data', 'uploads', 'map-drop');

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

const router = Router();

function ensureDropDir() {
  if (!existsSync(DROP_DIR)) mkdirSync(DROP_DIR, { recursive: true });
}

router.get('/drop-folder', requireDmAuth, (req, res) => {
  ensureDropDir();
  res.json({ path: DROP_DIR });
});

router.post('/scan-drop-folder', requireDmAuth, (req, res) => {
  ensureDropDir();
  const { campaignId } = req.body;
  if (!campaignId) return res.status(400).json({ error: 'campaignId is required' });
  const imported = [];
  try {
    const files = readdirSync(DROP_DIR);
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (!IMAGE_EXTS.includes(ext)) continue;
      const existing = getCampaignMaps(parseInt(campaignId, 10)).find(m => m.name === file);
      if (existing) continue;
      const imageUrl = `/uploads/map-drop/${encodeURIComponent(file)}`;
      const map = addMap(parseInt(campaignId, 10), {
        name: file.replace(ext, ''),
        imageUrl,
        gridSize: 50,
        notes: 'Imported from drop folder',
      });
      imported.push(map);
    }
    res.json({ imported: imported.length, maps: imported });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', (req, res) => {
  const { campaignId } = req.query;
  if (!campaignId) return res.status(400).json({ error: 'campaignId query param is required' });
  res.json(getCampaignMaps(parseInt(campaignId, 10)));
});

router.get('/:id', (req, res) => {
  const map = getMap(parseInt(req.params.id, 10));
  if (!map) return res.status(404).json({ error: 'Map not found' });
  res.json(map);
});

router.post('/', requireDmAuth, (req, res) => {
  const { campaignId, ...data } = req.body;
  if (!campaignId) return res.status(400).json({ error: 'campaignId is required' });
  if (!data.name || !data.imageUrl) return res.status(400).json({ error: 'name and imageUrl are required' });
  const map = addMap(campaignId, data);
  res.status(201).json(map);
});

router.post('/upload', requireDmAuth, (req, res) => {
  const upload = req.app.locals.upload;
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 10MB)' });
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { campaignId, name, gridSize, notes } = req.body;
    if (!campaignId || !name) return res.status(400).json({ error: 'campaignId and name are required' });

    const imageUrl = `/uploads/maps/${req.file.filename}`;
    const map = addMap(parseInt(campaignId, 10), {
      name,
      imageUrl,
      gridSize: parseInt(gridSize, 10) || 50,
      notes: notes || null,
    });

    eventBus.emit('log', {
      type: 'map_upload',
      subtype: 'map',
      title: `Map Uploaded: ${map.name}`,
      content: `New map "${map.name}" uploaded and added to campaign #${campaignId}`,
      mapId: map.id,
      campaignId: parseInt(campaignId, 10),
      timestamp: new Date().toISOString(),
    });

    res.status(201).json(map);
  });
});

router.patch('/:id', requireDmAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getMap(id);
  if (!existing) return res.status(404).json({ error: 'Map not found' });
  const updated = updateMap(id, req.body);
  res.json(updated);
});

router.delete('/:id', requireDmAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getMap(id);
  if (!existing) return res.status(404).json({ error: 'Map not found' });
  deleteMap(id);
  res.json({ success: true });
});

router.get('/:id/fog', (req, res) => {
  const map = getMap(parseInt(req.params.id, 10));
  if (!map) return res.status(404).json({ error: 'Map not found' });
  let fog = map.fog_data;
  if (fog && typeof fog === 'string') { try { fog = JSON.parse(fog); } catch { fog = []; } }
  res.json({ fog_data: fog || [] });
});

router.put('/:id/fog', requireDmAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getMap(id);
  if (!existing) return res.status(404).json({ error: 'Map not found' });
  const { fog_data } = req.body;
  if (!Array.isArray(fog_data)) return res.status(400).json({ error: 'fog_data must be an array' });
  const result = updateMapFog(id, fog_data);
  res.json({ fog_data: JSON.parse(result.fog_data || '[]') });
});

router.post('/:id/pins', requireDmAuth, (req, res) => {
  const mapId = parseInt(req.params.id, 10);
  const existing = getMap(mapId);
  if (!existing) return res.status(404).json({ error: 'Map not found' });
  const { x, y } = req.body;
  if (x === undefined || y === undefined) return res.status(400).json({ error: 'x and y are required' });
  const pin = addPin(mapId, req.body);
  res.status(201).json(pin);
});

router.patch('/:id/pins/:pinId', requireDmAuth, (req, res) => {
  const pinId = parseInt(req.params.pinId, 10);
  const pin = updatePin(pinId, req.body);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  res.json(pin);
});

router.delete('/:id/pins/:pinId', requireDmAuth, (req, res) => {
  const pinId = parseInt(req.params.pinId, 10);
  deletePin(pinId);
  res.json({ success: true });
});

export default router;
