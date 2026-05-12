import { Router } from 'express';
import { listDms, isDm, addDm, removeDm } from '../../services/dmRoles.js';

const router = Router();

function requireAdmin(req, res, next) {
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (!adminToken) {
    return res.status(403).json({ error: 'Admin API token not configured. Set ADMIN_API_TOKEN in .env to use this endpoint.' });
  }
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized. Provide a valid ADMIN_API_TOKEN in the Authorization header.' });
  }
  next();
}

router.get('/', (req, res) => {
  res.json(listDms());
});

router.get('/:discordId', (req, res) => {
  const result = isDm(req.params.discordId);
  res.json({ isDm: result });
});

router.post('/', requireAdmin, (req, res) => {
  const { discordId, discordUsername, notes } = req.body;
  if (!discordId) return res.status(400).json({ error: 'discordId is required' });
  addDm(discordId, discordUsername, notes);
  res.json({ success: true });
});

router.delete('/:discordId', requireAdmin, (req, res) => {
  removeDm(req.params.discordId);
  res.json({ success: true });
});

export default router;
