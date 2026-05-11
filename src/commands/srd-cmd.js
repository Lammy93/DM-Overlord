import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import { searchMonsters, getSrdMonster, getSrdMonsters, searchSpells, getSrdSpell, searchItems, getSrdItem, getAllMonsterTypes, getAllEnvironments } from '../services/srd.js';

export default {
  data: new SlashCommandBuilder()
    .setName('srd')
    .setDescription('Search the SRD content database')
    .addSubcommand(sub =>
      sub.setName('monster')
        .setDescription('Look up a monster from the SRD')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Monster name to search')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('spell')
        .setDescription('Look up a spell from the SRD')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Spell name to search')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('item')
        .setDescription('Look up an item from the SRD')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Item name to search')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('monsters-by-cr')
        .setDescription('List monsters by challenge rating')
        .addStringOption(opt =>
          opt.setName('cr')
            .setDescription('Challenge rating (e.g., 1, 2, 5, 10)')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('environment')
            .setDescription('Filter by environment')
            .setRequired(false))),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const subcommand = interaction.options.getSubcommand();

    let results = [];
    if (subcommand === 'monster') {
      results = searchMonsters(focusedValue).slice(0, 10).map(m => ({ name: m.name, value: m.name }));
    } else if (subcommand === 'spell') {
      results = searchSpells(focusedValue).slice(0, 10).map(s => ({ name: s.name, value: s.name }));
    } else if (subcommand === 'item') {
      results = searchItems(focusedValue).slice(0, 10).map(i => ({ name: i.name, value: i.name }));
    }

    await interaction.respond(results);
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'monster': {
        const name = interaction.options.getString('name');
        const monster = getSrdMonster(name);
        if (!monster) {
          const suggestions = searchMonsters(name).slice(0, 5);
          const msg = suggestions.length > 0
            ? `Monster not found. Did you mean: ${suggestions.map(m => `\`${m.name}\``).join(', ')}?`
            : `Monster "${name}" not found in SRD.`;
          return interaction.reply({ content: msg, ephemeral: true });
        }
        const embed = new EmbedBuilder()
          .setTitle(monster.name)
          .setColor(Colors.Red)
          .setDescription(monster.description || '')
          .addFields(
            { name: 'Stats', value: `STR ${monster.stats.str} | DEX ${monster.stats.dex} | CON ${monster.stats.con} | INT ${monster.stats.int} | WIS ${monster.stats.wis} | CHA ${monster.stats.cha}`, inline: false },
            { name: 'Armor Class', value: `${monster.ac}`, inline: true },
            { name: 'Hit Points', value: `${monster.hp} (${monster.hit_dice})`, inline: true },
            { name: 'Speed', value: `${monster.speed}ft`, inline: true },
            { name: 'Challenge', value: `${monster.challenge_rating} (${monster.xp} XP)`, inline: true },
            { name: 'Size/Type', value: `${monster.size} ${monster.type}`, inline: true },
            { name: 'Senses', value: monster.senses ? Object.entries(monster.senses).map(([k, v]) => `${k} ${v}`).join(', ') : 'None', inline: false },
            { name: 'Languages', value: monster.languages?.join(', ') || 'None', inline: false },
          );
        if (monster.traits?.length > 0) {
          embed.addFields({ name: 'Traits', value: monster.traits.map(t => `**${t.name}:** ${t.description}`).join('\n'), inline: false });
        }
        if (monster.actions?.length > 0) {
          embed.addFields({ name: 'Actions', value: monster.actions.map(a => {
            const dmg = a.damage?.map(d => `${d.damage_dice}${d.damage_bonus ? '+' + d.damage_bonus : ''} ${d.damage_type}`).join(' + ');
            return `**${a.name}:** ${a.description}${dmg ? ` (${dmg})` : ''}`;
          }).join('\n'), inline: false });
        }
        if (monster.environments?.length > 0) {
          embed.addFields({ name: 'Environments', value: monster.environments.join(', '), inline: true });
        }
        return interaction.reply({ embeds: [embed] });
      }

      case 'spell': {
        const name = interaction.options.getString('name');
        const spell = getSrdSpell(name);
        if (!spell) {
          return interaction.reply({ content: `Spell "${name}" not found in SRD.`, ephemeral: true });
        }
        const embed = new EmbedBuilder()
          .setTitle(spell.name)
          .setColor(Colors.Blue)
          .setDescription(spell.description)
          .addFields(
            { name: 'Level', value: spell.level === 0 ? 'Cantrip' : `${spell.level}`, inline: true },
            { name: 'School', value: spell.school, inline: true },
            { name: 'Casting Time', value: spell.casting_time, inline: true },
            { name: 'Range', value: spell.range, inline: true },
            { name: 'Components', value: spell.components?.join(', ') || 'None', inline: true },
            { name: 'Duration', value: spell.duration, inline: true },
            { name: 'Classes', value: spell.classes?.join(', ') || 'None', inline: false },
          );
        return interaction.reply({ embeds: [embed] });
      }

      case 'item': {
        const name = interaction.options.getString('name');
        const item = getSrdItem(name);
        if (!item) {
          return interaction.reply({ content: `Item "${name}" not found in SRD.`, ephemeral: true });
        }
        const embed = new EmbedBuilder()
          .setTitle(item.name)
          .setColor(Colors.Gold)
          .setDescription(item.description)
          .addFields(
            { name: 'Category', value: item.category || 'General', inline: true },
            { name: 'Rarity', value: item.rarity || 'Common', inline: true },
          );
        if (item.ac) embed.addFields({ name: 'AC', value: `${item.ac}`, inline: true });
        if (item.damage) embed.addFields({ name: 'Damage', value: item.damage, inline: true });
        if (item.cost) embed.addFields({ name: 'Cost', value: `${item.cost} gp`, inline: true });
        return interaction.reply({ embeds: [embed] });
      }

      case 'monsters-by-cr': {
        const crStr = interaction.options.getString('cr');
        const environment = interaction.options.getString('environment');
        const cr = parseFloat(crStr);
        if (isNaN(cr)) {
          return interaction.reply({ content: 'Invalid CR value.', ephemeral: true });
        }
        const monsters = getSrdMonsters(cr, environment);
        if (monsters.length === 0) {
          return interaction.reply({ content: `No monsters found for CR ${cr}${environment ? ` in ${environment}` : ''}.`, ephemeral: true });
        }
        const list = monsters.slice(0, 20).map(m => `• **${m.name}** — CR ${m.challenge_rating} (${m.xp} XP) — ${m.type}`);
        const embed = new EmbedBuilder()
          .setTitle(`Monsters — CR ${cr}${environment ? ` (${environment})` : ''}`)
          .setColor(Colors.Red)
          .setDescription(list.join('\n') + (monsters.length > 20 ? `\n*+${monsters.length - 20} more...*` : ''));
        return interaction.reply({ embeds: [embed] });
      }
    }
  },
};
