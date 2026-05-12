const VALID_STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const VALID_ALIGNMENTS = [
  'lawful good', 'neutral good', 'chaotic good',
  'lawful neutral', 'true neutral', 'chaotic neutral',
  'lawful evil', 'neutral evil', 'chaotic evil',
  'unaligned',
];
const VALID_SKILLS = [
  'acrobatics', 'animal handling', 'arcana', 'athletics',
  'deception', 'history', 'insight', 'intimidation',
  'investigation', 'medicine', 'nature', 'perception',
  'performance', 'persuasion', 'religion', 'sleight of hand',
  'stealth', 'survival',
];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'deadly'];

export function validateStats(stats) {
  if (typeof stats !== 'object' || stats === null) return false;
  return VALID_STATS.every(s => typeof stats[s] === 'number' && stats[s] >= 1 && stats[s] <= 30);
}

export function validateAlignment(alignment) {
  return VALID_ALIGNMENTS.includes(alignment?.toLowerCase());
}

export function validateSkill(skill) {
  return VALID_SKILLS.includes(skill?.toLowerCase());
}

export function validateDifficulty(difficulty) {
  return VALID_DIFFICULTIES.includes(difficulty?.toLowerCase());
}

export function validateLevel(level) {
  return Number.isInteger(level) && level >= 1 && level <= 20;
}

export function validateHp(hp) {
  return Number.isInteger(hp) && hp > 0;
}

export function validateCharacterName(name) {
  return typeof name === 'string' && name.trim().length >= 2 && name.length <= 50;
}

export const VALID_RACES = [
  'dwarf', 'elf', 'halfling', 'human', 'dragonborn',
  'gnome', 'half-elf', 'half-orc', 'tiefling',
  'aasimar', 'firbolg', 'goliath', 'kenku', 'tabaxi',
  'tortle', 'warforged',
];

export const VALID_CLASSES = [
  'barbarian', 'bard', 'cleric', 'druid', 'fighter',
  'monk', 'paladin', 'ranger', 'rogue', 'sorcerer',
  'warlock', 'wizard', 'artificer', 'blood hunter',
];
