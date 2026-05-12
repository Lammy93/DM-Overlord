export function rollDice(formula, options = {}) {
  const { advantage = false, disadvantage = false } = options;
  const parsed = parseFormula(formula);
  if (!parsed) return null;

  let { count, sides, modifier } = parsed;

  if (sides === 20 && (advantage || disadvantage)) {
    return rollWithAdvantage(count, modifier, advantage);
  }

  return rollNormal(count, sides, modifier);
}

function parseFormula(formula) {
  const cleaned = formula.replace(/\s+/g, '').toLowerCase();
  const regex = /^(\d+)?d(\d+)((?:\+|-)\d+)?$/;
  const match = cleaned.match(regex);
  if (!match) return null;

  return {
    count: match[1] ? parseInt(match[1], 10) : 1,
    sides: parseInt(match[2], 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0,
  };
}

function rollNormal(count, sides, modifier) {
  const rolls = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const result = Math.floor(Math.random() * sides) + 1;
    rolls.push(result);
    total += result;
  }
  total += modifier;
  return {
    rolls,
    total,
    modifier,
    formula: `${count}d${sides}${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''}`,
    details: rolls.map(r => `\`${r}\``).join(' + ') + (modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''),
  };
}

function rollWithAdvantage(count, modifier, isAdvantage) {
  const firstRoll = Math.floor(Math.random() * 20) + 1;
  const secondRoll = Math.floor(Math.random() * 20) + 1;
  const chosen = isAdvantage ? Math.max(firstRoll, secondRoll) : Math.min(firstRoll, secondRoll);
  const total = chosen + modifier;

  return {
    rolls: [firstRoll, secondRoll],
    total,
    modifier,
    formula: `1d20${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''}`,
    details: `(${firstRoll}, ${secondRoll}) → **${chosen}**${modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}`,
    advantage: isAdvantage,
    chosen,
  };
}

export function rollAbilityCheck(ability, modifier) {
  return rollDice('1d20', {}).then(r => ({
    ...r,
    total: r.total + modifier,
    ability,
    modifier,
  }));
}

export function rollSkillCheck(skill, modifier) {
  return rollDice('1d20', {}).then(r => ({
    ...r,
    total: r.total + modifier,
    skill,
    modifier,
  }));
}

export function rollDamage(diceFormula) {
  return rollDice(diceFormula);
}

export function rollHitPoints(hitDice, conMod = 0) {
  const result = rollNormal(1, hitDice, 0);
  return result.rolls[0] + conMod;
}
