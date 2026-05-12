import { Router } from 'express';
import { rollDice } from '../../services/dice.js';
import eventBus from '../../services/eventBus.js';

const router = Router();

router.post('/', (req, res) => {
  const { formula, advantage, disadvantage } = req.body;
  if (!formula) return res.status(400).json({ error: 'Formula is required' });
  const result = rollDice(formula, { advantage: !!advantage, disadvantage: !!disadvantage });
  if (!result) return res.status(400).json({ error: 'Invalid dice formula' });
  
  eventBus.emit('log', {
    type: 'roll',
    subtype: 'roll',
    title: `🎲 ${result.formula}`,
    content: `${result.formula} → **${result.total}**${result.details ? ` (${result.details})` : ''}`,
    formula: result.formula,
    total: result.total,
    timestamp: new Date().toISOString(),
  });

  res.json(result);
});

export default router;
