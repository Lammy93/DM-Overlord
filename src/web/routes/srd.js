import { Router } from 'express';
import { getSrdMonsters, getSrdSpells, getSrdItems, getSrdClasses, getSrdRaces } from '../../services/srd.js';

const router = Router();

router.get('/monsters', (req, res) => {
  const { level, environment } = req.query;
  res.json(getSrdMonsters(level ? parseInt(level, 10) : null, environment || null));
});

router.get('/monsters/:name', (req, res) => {
  const monsters = getSrdMonsters();
  const monster = monsters.find(m => m.name?.toLowerCase() === req.params.name.toLowerCase());
  if (!monster) return res.status(404).json({ error: 'Monster not found' });
  res.json(monster);
});

router.get('/spells', (req, res) => {
  const { level, school } = req.query;
  let spells = getSrdSpells();
  if (level !== undefined) spells = spells.filter(s => s.level === parseInt(level, 10));
  if (school) spells = spells.filter(s => s.school?.toLowerCase() === school.toLowerCase());
  res.json(spells);
});

router.get('/spells/:name', (req, res) => {
  const spells = getSrdSpells();
  const spell = spells.find(s => s.name?.toLowerCase() === req.params.name.toLowerCase());
  if (!spell) return res.status(404).json({ error: 'Spell not found' });
  res.json(spell);
});

router.get('/items', (req, res) => {
  const { category, rarity } = req.query;
  let items = getSrdItems();
  if (category) items = items.filter(i => i.category?.toLowerCase() === category.toLowerCase());
  if (rarity) items = items.filter(i => i.rarity?.toLowerCase() === rarity.toLowerCase());
  res.json(items);
});

router.get('/items/:name', (req, res) => {
  const items = getSrdItems();
  const item = items.find(i => i.name?.toLowerCase() === req.params.name.toLowerCase());
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

router.get('/classes', (req, res) => {
  res.json(getSrdClasses());
});

router.get('/races', (req, res) => {
  res.json(getSrdRaces());
});

export default router;
