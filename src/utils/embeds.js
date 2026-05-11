import { EmbedBuilder, Colors } from 'discord.js';

export function baseEmbed(title, color = Colors.Blurple) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();
}

export function successEmbed(title, description) {
  return baseEmbed(title, Colors.Green).setDescription(description);
}

export function errorEmbed(title, description) {
  return baseEmbed(title, Colors.Red).setDescription(description);
}

export function infoEmbed(title, description) {
  return baseEmbed(title, Colors.Blurple).setDescription(description);
}

export function warningEmbed(title, description) {
  return baseEmbed(title, Colors.Yellow).setDescription(description);
}

export function diceEmbed(results, formula, total) {
  const embed = baseEmbed('🎲 Dice Roll', Colors.Purple);
  embed.addFields(
    { name: 'Formula', value: `\`${formula}\``, inline: true },
    { name: 'Total', value: `**${total}**`, inline: true }
  );
  if (results.length > 0) {
    embed.addFields({
      name: 'Rolls',
      value: results.map((r, i) => `Roll ${i + 1}: \`${r}\``).join('\n'),
    });
  }
  return embed;
}

export function characterEmbed(character) {
  const embed = baseEmbed(`${character.name} - Level ${character.level} ${character.race} ${character.class}`, Colors.Green);
  embed.setThumbnail('https://cdn.discordapp.com/embed/avatars/0.png');
  const stats = typeof character.stats === 'string' ? JSON.parse(character.stats) : character.stats;
  const statStr = Object.entries(stats)
    .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
    .join(' | ');
  embed.addFields(
    { name: 'Stats', value: statStr || 'Not set', inline: false },
    { name: 'HP', value: `${character.hp_current || character.hp_max || '?'}/${character.hp_max || '?'}`, inline: true },
    { name: 'AC', value: `${character.armor_class || '?'}`, inline: true },
    { name: 'Speed', value: `${character.speed || 30}ft`, inline: true },
    { name: 'Proficiencies', value: getArrayField(character.proficiencies, 'None') },
    { name: 'Inventory', value: getArrayField(character.inventory, 'Empty'), inline: false }
  );
  return embed;
}

function getArrayField(data, fallback) {
  if (!data) return fallback;
  const arr = typeof data === 'string' ? JSON.parse(data) : data;
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  return arr.slice(0, 10).join(', ') + (arr.length > 10 ? ` +${arr.length - 10} more` : '');
}

export function encounterEmbed(encounter, combatants) {
  const embed = baseEmbed(`⚔️ ${encounter.name}`, Colors.Red);
  embed.addFields(
    { name: 'Status', value: encounter.status, inline: true },
    { name: 'Round', value: `${encounter.round || 1}`, inline: true },
    { name: 'Environment', value: encounter.environment || 'None', inline: true },
    { name: 'Difficulty', value: encounter.difficulty || 'Unknown', inline: true }
  );
  if (combatants && combatants.length > 0) {
    const order = encounter.initiative_order
      ? (typeof encounter.initiative_order === 'string' ? JSON.parse(encounter.initiative_order) : encounter.initiative_order)
      : [];
    const sorted = [...combatants].sort((a, b) => (order.indexOf(a.id) !== -1 ? order.indexOf(a.id) : 999) - (order.indexOf(b.id) !== -1 ? order.indexOf(b.id) : 999));
    const list = sorted.map(c => {
      const marker = c.type === 'player' ? '🧑' : c.type === 'ally' ? '🤝' : '👹';
      const hpBar = getHpBar(c.hp_current, c.hp_max);
      return `${marker} **${c.name}** HP: ${c.hp_current}/${c.hp_max} ${hpBar} AC:${c.ac} Init:${c.initiative}`;
    });
    embed.addFields({ name: `Combatants (${combatants.length})`, value: list.join('\n') || 'None' });
  }
  return embed;
}

function getHpBar(current, max) {
  if (!max || max === 0) return '';
  const pct = current / max;
  const bars = 10;
  const filled = Math.round(pct * bars);
  const empty = bars - filled;
  const color = pct > 0.5 ? '🟢' : pct > 0.25 ? '🟡' : '🔴';
  return `${color.repeat(Math.max(1, filled))}${'⬜'.repeat(Math.max(0, empty))}`;
}
