import { Router } from 'express';
import { createSessionLog, getSessionLogs } from '../../services/campaign.js';

const router = Router();

router.get('/:campaignId', (req, res) => {
  const campaignId = parseInt(req.params.campaignId, 10);
  if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });
  res.json(getSessionLogs(campaignId));
});

router.post('/:campaignId', (req, res) => {
  const campaignId = parseInt(req.params.campaignId, 10);
  if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });
  const { sessionNumber, title, summary, highlights, lootFound, xpGained } = req.body;
  if (!sessionNumber) return res.status(400).json({ error: 'sessionNumber is required' });
  const session = createSessionLog(campaignId, sessionNumber, { title, summary, highlights, lootFound, xpGained });
  res.status(201).json(session);
});

export default router;
