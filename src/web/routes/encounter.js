import { Router } from 'express';
import {
  createEncounter, getEncounter, listEncounters, updateEncounter, deleteEncounter,
  addCombatant, removeCombatant, updateCombatant,
  startEncounter, nextTurn, damageCombatant, addCondition, removeCondition, endEncounter,
} from '../../services/encounter.js';
import { getSrdMonster, searchMonsters } from '../../services/srd.js';

const router = Router();

router.get('/', (req, res) => {
  const { campaignId } = req.query;
  if (!campaignId) return res.status(400).json({ error: 'campaignId query param is required' });
  const encounters = listEncounters(parseInt(campaignId, 10));
  res.json(encounters);
});

router.get('/:id', (req, res) => {
  const enc = getEncounter(parseInt(req.params.id, 10));
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });
  res.json(enc);
});

router.post('/', (req, res) => {
  const { campaignId, name, description, environment, difficulty } = req.body;
  if (!campaignId || !name) return res.status(400).json({ error: 'campaignId and name are required' });
  const enc = createEncounter({ campaignId: parseInt(campaignId, 10), name, description, environment, difficulty });
  res.status(201).json(enc);
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getEncounter(id);
  if (!existing) return res.status(404).json({ error: 'Encounter not found' });
  const updated = updateEncounter(id, req.body);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getEncounter(id);
  if (!existing) return res.status(404).json({ error: 'Encounter not found' });
  deleteEncounter(id);
  res.json({ success: true });
});

router.post('/:id/start', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getEncounter(id);
  if (!existing) return res.status(404).json({ error: 'Encounter not found' });
  if (!existing.combatants?.length) return res.status(400).json({ error: 'No combatants in encounter' });
  const updated = startEncounter(id);
  res.json(updated);
});

router.post('/:id/next', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getEncounter(id);
  if (!existing) return res.status(404).json({ error: 'Encounter not found' });
  const updated = nextTurn(id);
  res.json(updated);
});

router.post('/:id/end', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getEncounter(id);
  if (!existing) return res.status(404).json({ error: 'Encounter not found' });
  endEncounter(id, req.body.status || 'completed');
  res.json({ success: true });
});

router.get('/:id/combatants', (req, res) => {
  const enc = getEncounter(parseInt(req.params.id, 10));
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });
  res.json(enc.combatants || []);
});

router.post('/:id/combatants', (req, res) => {
  const encounterId = parseInt(req.params.id, 10);
  const existing = getEncounter(encounterId);
  if (!existing) return res.status(404).json({ error: 'Encounter not found' });

  const { name, type, monsterId, hpMax, ac, initiative, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  if (monsterId) {
    const monster = getSrdMonster(monsterId);
    if (!monster) return res.status(400).json({ error: 'Monster not found in SRD' });
  }

  const combatant = addCombatant(encounterId, {
    name, type: type || 'monster', monsterId: monsterId || null,
    hpMax: hpMax || (monsterId ? getSrdMonster(monsterId)?.hp : 10),
    ac: ac || (monsterId ? getSrdMonster(monsterId)?.ac : 10),
    initiative: initiative !== undefined ? initiative : Math.floor(Math.random() * 20) + 1,
    notes,
  });
  res.status(201).json(combatant);
});

router.patch('/:id/combatants/:combatantId', (req, res) => {
  const combatantId = parseInt(req.params.combatantId, 10);
  const updated = updateCombatant(combatantId, req.body);
  if (!updated) return res.status(404).json({ error: 'Combatant not found' });
  res.json(updated);
});

router.delete('/:id/combatants/:combatantId', (req, res) => {
  const combatantId = parseInt(req.params.combatantId, 10);
  const result = removeCombatant(combatantId);
  if (!result) return res.status(404).json({ error: 'Combatant not found' });
  res.json({ success: true });
});

router.post('/:id/combatants/:combatantId/damage', (req, res) => {
  const combatantId = parseInt(req.params.combatantId, 10);
  const { amount } = req.body;
  if (!amount || amount < 1) return res.status(400).json({ error: 'amount must be positive' });
  const updated = damageCombatant(combatantId, amount);
  if (!updated) return res.status(404).json({ error: 'Combatant not found' });
  res.json(updated);
});

router.post('/:id/combatants/:combatantId/heal', (req, res) => {
  const combatantId = parseInt(req.params.combatantId, 10);
  const { amount } = req.body;
  if (!amount || amount < 1) return res.status(400).json({ error: 'amount must be positive' });
  const existing = getEncounter(parseInt(req.params.id, 10))?.combatants?.find(c => c.id === combatantId);
  if (!existing) return res.status(404).json({ error: 'Combatant not found' });
  const newHp = Math.min(existing.hp_max, existing.hp_current + amount);
  const updated = updateCombatant(combatantId, { hpCurrent: newHp });
  res.json(updated);
});

router.post('/:id/combatants/:combatantId/condition', (req, res) => {
  const combatantId = parseInt(req.params.combatantId, 10);
  const { condition } = req.body;
  if (!condition) return res.status(400).json({ error: 'condition is required' });
  const updated = addCondition(combatantId, condition);
  if (!updated) return res.status(404).json({ error: 'Combatant not found' });
  res.json(updated);
});

router.delete('/:id/combatants/:combatantId/condition/:condition', (req, res) => {
  const combatantId = parseInt(req.params.combatantId, 10);
  const updated = removeCondition(combatantId, req.params.condition);
  if (!updated) return res.status(404).json({ error: 'Combatant not found' });
  res.json(updated);
});

export default router;
