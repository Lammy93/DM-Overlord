import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, Colors,
} from 'discord.js';
import { createCharacter } from './character.js';
import { getDb } from '../db/index.js';
import { writeCharacterNote } from './obsidian.js';
import { getCampaign } from './campaign.js';

const wizards = new Map();

const STEP_ICONS = ['📝', '🌍', '⚔️', '📜', '⚖️', '🎒', '💪', '🎯', '✨', '🖼️', '✅'];

const RACES = ['Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Halfling', 'Half-Orc', 'Human', 'Tiefling'];

const RACE_FLAVOR = {
  Dragonborn: 'Proud heirs of ancient draconic bloodlines, blessed with breath weapons and elemental resistance.',
  Dwarf: 'Stout and resilient folk of mountain halls, known for their craftsmanship and endurance.',
  Elf: 'Graceful and long-lived people of the forest, gifted with keen senses and innate magic.',
  Gnome: 'Inventive and curious tinkerers who find magic in the everyday and joy in discovery.',
  'Half-Elf': 'Bridging two worlds with the grace of elves and the adaptability of humans.',
  Halfling: 'Cheerful and brave smallfolk who rely on luck and good nature to overcome any obstacle.',
  'Half-Orc': 'Fierce warriors forged from two bloodlines, combining human cunning with orcish strength.',
  Human: 'The most adaptable and ambitious people, whose short lives burn bright with achievement.',
  Tiefling: 'Bearing the mark of infernal ancestry, with innate magic and a will forged in adversity.',
};

const RACE_ASI = {
  Dragonborn: '+2 Str, +1 Cha',
  Dwarf: '+2 Con, +1 Wis',
  Elf: '+2 Dex, +1 Int',
  Gnome: '+2 Int, +1 Dex',
  'Half-Elf': '+2 Cha, +1 to two others',
  Halfling: '+2 Dex, +1 Cha',
  'Half-Orc': '+2 Str, +1 Con',
  Human: '+1 to all',
  Tiefling: '+2 Cha, +1 Int',
};

const CLASSES = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];

const CLASS_FLAVOR = {
  Barbarian: 'A fierce warrior driven by primal rage, channeling fury into devastating attacks.',
  Bard: 'A master of music and magic, weaving inspiration and enchantment through performance.',
  Cleric: 'A divine servant wielding the power of the gods to heal the wounded and smite the wicked.',
  Druid: 'A guardian of nature who commands the elements, shapes beasts, and protects the wild.',
  Fighter: 'A master of martial combat, trained in every weapon and armor known to civilization.',
  Monk: 'A disciplined warrior who channels inner ki to perform supernatural feats of martial arts.',
  Paladin: 'A holy knight bound by sacred oath, wielding divine power to protect the righteous.',
  Ranger: 'A skilled hunter and tracker, at home in the wild with a bow or blade in hand.',
  Rogue: 'A cunning opportunist who strikes from shadows, using stealth and skill to overcome any obstacle.',
  Sorcerer: 'A spellcaster with innate magic flowing through their blood, shaping reality by force of will.',
  Warlock: 'A wielder of forbidden knowledge granted by an otherworldly patron in exchange for service.',
  Wizard: 'A scholar of arcane mysteries who masters reality through rigorous study and preparation.',
};

const CLASS_ROLE = {
  Barbarian: 'Melee Damage / Tank', Bard: 'Support / Utility Caster',
  Cleric: 'Healer / Support', Druid: 'Utility Caster / Shapeshifter',
  Fighter: 'Melee / Ranged Damage', Monk: 'Melee Damage / Mobility',
  Paladin: 'Melee Damage / Tank / Healer', Ranger: 'Ranged Damage / Explorer',
  Rogue: 'Stealth / Single-Target Damage', Sorcerer: 'Arcane Damage Dealer',
  Warlock: 'Arcane Damage / Utility', Wizard: 'Arcane Utility / Control',
};

const CLASS_HD = {
  Barbarian: 'd12', Bard: 'd8', Cleric: 'd8', Druid: 'd8', Fighter: 'd10',
  Monk: 'd8', Paladin: 'd10', Ranger: 'd10', Rogue: 'd8', Sorcerer: 'd6',
  Warlock: 'd8', Wizard: 'd6',
};

const CLASS_PRIMARY = {
  Barbarian: 'Strength', Bard: 'Charisma', Cleric: 'Wisdom', Druid: 'Wisdom',
  Fighter: 'Strength or Dexterity', Monk: 'Dexterity & Wisdom', Paladin: 'Strength & Charisma',
  Ranger: 'Dexterity & Wisdom', Rogue: 'Dexterity', Sorcerer: 'Charisma',
  Warlock: 'Charisma', Wizard: 'Intelligence',
};

const BACKGROUNDS = ['Acolyte', 'Charlatan', 'Criminal', 'Entertainer', 'Folk Hero', 'Guild Artisan', 'Hermit', 'Noble', 'Outlander', 'Sage', 'Sailor', 'Soldier', 'Urchin'];

const BG_FLAVOR = {
  Acolyte: 'Devoted to a deity or faith, you served in a temple and know the power of prayer.',
  Charlatan: 'A master of deception and disguise, you make your way through lies and charm.',
  Criminal: 'You have a past filled with heists, shady deals, and a network of underworld contacts.',
  Entertainer: 'A performer at heart, you captivate audiences with song, story, or spectacle.',
  'Folk Hero': 'A commoner who rose to prominence through a courageous act that won the people\'s hearts.',
  'Guild Artisan': 'A skilled craftsperson with connections to a powerful trade guild.',
  Hermit: 'You lived in seclusion, pursuing enlightenment or hidden knowledge away from society.',
  Noble: 'Born to privilege and status, you carry the weight and expectations of your lineage.',
  Outlander: 'Raised in the wilds, you know the ways of nature and survive where others cannot.',
  Sage: 'A lifelong scholar who has devoted themselves to the pursuit of knowledge and lore.',
  Sailor: 'The sea is your home — you\'ve weathered storms, explored coasts, and know ships inside out.',
  Soldier: 'Trained for war, you served in an army or militia and know the discipline of the ranks.',
  Urchin: 'You grew up on the streets, surviving by wits, stealth, and a knack for finding hidden paths.',
};
const CLASS_EQUIPMENT = {
  Barbarian: {
    choices: [
      { label: 'Greataxe', value: 'greataxe', items: ['Greataxe'] },
      { label: 'Any martial melee weapon', value: 'martial_melee', items: ['Any martial melee weapon'] },
    ],
    auto: ["Explorer's Pack", '4 Javelins'],
  },
  Bard: {
    choices: [
      { label: 'Rapier', value: 'rapier', items: ['Rapier'] },
      { label: 'Longsword', value: 'longsword', items: ['Longsword'] },
      { label: 'Shortsword', value: 'shortsword', items: ['Shortsword'] },
      { label: 'Any simple weapon', value: 'simple_weapon', items: ['Any simple weapon'] },
    ],
    auto: ['Leather Armor', "Entertainer's Pack", 'Dagger'],
  },
  Cleric: {
    choices: [
      { label: 'Mace + Shield', value: 'mace', items: ['Mace', 'Shield'] },
      { label: 'Warhammer + Shield', value: 'warhammer', items: ['Warhammer', 'Shield'] },
    ],
    auto: ['Scale Mail', "Priest's Pack"],
  },
  Druid: {
    choices: [
      { label: 'Wooden Shield + Scimitar', value: 'shield_scimitar', items: ['Wooden Shield', 'Scimitar'] },
      { label: 'Any simple weapon', value: 'simple_weapon', items: ['Any simple weapon'] },
    ],
    auto: ['Leather Armor', "Explorer's Pack", 'Druidic Focus'],
  },
  Fighter: {
    choices: [
      { label: 'Chain mail + weapon + shield', value: 'chain_weapon_shield', items: ['Chain Mail', 'Martial weapon', 'Shield'] },
      { label: 'Leather + longbow + dual weapons', value: 'leather_longbow_dual', items: ['Leather Armor', 'Longbow', '20 Arrows', 'Two martial weapons'] },
    ],
    auto: ["Dungeoneer's Pack"],
  },
  Monk: {
    choices: [
      { label: 'Shortsword', value: 'shortsword', items: ['Shortsword'] },
      { label: 'Any simple weapon', value: 'simple_weapon', items: ['Any simple weapon'] },
    ],
    auto: ["Dungeoneer's Pack", '10 Darts'],
  },
  Paladin: {
    choices: [
      { label: 'Martial weapon + shield', value: 'weapon_shield', items: ['Martial weapon', 'Shield'] },
      { label: 'Two martial weapons', value: 'dual_martial', items: ['Two martial weapons'] },
    ],
    auto: ['Chain Mail', "Priest's Pack", 'Holy Symbol'],
  },
  Ranger: {
    choices: [
      { label: 'Scale mail', value: 'scale_mail', items: ['Scale Mail'] },
      { label: 'Leather armor', value: 'leather_armor', items: ['Leather Armor'] },
    ],
    auto: ['Two shortswords', "Explorer's Pack", 'Longbow', '20 Arrows'],
  },
  Rogue: {
    choices: [
      { label: 'Rapier', value: 'rapier', items: ['Rapier'] },
      { label: 'Shortsword', value: 'shortsword', items: ['Shortsword'] },
    ],
    auto: ['Shortbow', '20 Arrows', 'Leather Armor', "Thief's Pack", '2 Daggers', "Thieves' Tools"],
  },
  Sorcerer: {
    choices: [
      { label: 'Light crossbow + 20 bolts', value: 'crossbow', items: ['Light Crossbow', '20 Bolts'] },
      { label: 'Any simple weapon', value: 'simple_weapon', items: ['Any simple weapon'] },
    ],
    auto: ['Component Pouch', "Dungeoneer's Pack", '2 Daggers', 'Arcane Focus'],
  },
  Warlock: {
    choices: [
      { label: 'Light crossbow + 20 bolts', value: 'crossbow', items: ['Light Crossbow', '20 Bolts'] },
      { label: 'Any simple weapon', value: 'simple_weapon', items: ['Any simple weapon'] },
    ],
    auto: ['Component Pouch', "Scholar's Pack", 'Leather Armor', 'Arcane Focus'],
  },
  Wizard: {
    choices: [
      { label: 'Quarterstaff', value: 'quarterstaff', items: ['Quarterstaff'] },
      { label: 'Dagger', value: 'dagger', items: ['Dagger'] },
    ],
    auto: ['Component Pouch', "Scholar's Pack", 'Spellbook', 'Arcane Focus'],
  },
};

const BG_EQUIPMENT = {
  Acolyte: ['Holy symbol', 'Prayer book', '5 sticks of incense', 'Vestments', 'Common clothes', 'Belt pouch (15 gp)'],
  Charlatan: ['Fine clothes', 'Disguise kit', 'Trinkets (10 gp)', 'Belt pouch (15 gp)'],
  Criminal: ['Crowbar', 'Common clothes', 'Belt pouch (15 gp)'],
  Entertainer: ['Musical instrument', 'Costume', 'Belt pouch (15 gp)'],
  'Folk Hero': ["Shovel", 'Iron pot', 'Common clothes', 'Belt pouch (10 gp)'],
  'Guild Artisan': ['Tool of the trade', 'Letter of introduction', 'Common clothes', 'Belt pouch (15 gp)'],
  Hermit: ['Scroll case', 'Winter blanket', 'Common clothes', 'Herbalism kit', 'Belt pouch (5 gp)'],
  Noble: ['Fine clothes', 'Signet ring', 'Scroll of pedigree', 'Belt pouch (25 gp)'],
  Outlander: ['Staff', 'Hunting trap', 'Animal trophy', 'Common clothes', 'Belt pouch (10 gp)'],
  Sage: ['Bottle of ink', 'Quill', 'Small knife', 'Letter from colleague', 'Common clothes', 'Belt pouch (10 gp)'],
  Sailor: ['Belaying pin (club)', '50 ft silk rope', 'Common clothes', 'Belt pouch (10 gp)'],
  Soldier: ['Insignia of rank', 'Trophy', 'Common clothes', 'Belt pouch (10 gp)'],
  Urchin: ['Tiny pet mouse', 'Token from parents', 'Common clothes', 'Belt pouch (10 gp)'],
};

const ARMOR_AC = {
  'None': { base: 10, dex: true },
  'Leather Armor': { base: 11, dex: true },
  'Scale Mail': { base: 14, dex: true, dexMax: 2 },
  'Chain Mail': { base: 16, dex: false, strReq: 13 },
  'Shield': { bonus: 2 },
  'Wooden Shield': { bonus: 2 },
};

const UNARMORED_AC = {
  Barbarian: { base: 10, addCon: true, addDex: true },
  Monk: { base: 10, addWis: true, addDex: true },
};

function calcHp(wiz) {
  const hd = CLASS_HD[wiz.data.class] || 'd8';
  const hdSize = parseInt(hd.slice(1), 10);
  const conMod = statMod(wiz.data.stats?.con || 10);
  return hdSize + conMod;
}

function calcAc(wiz) {
  const inv = wiz.data.inventory || [];
  const dexMod = statMod(wiz.data.stats?.dex || 10);
  const unarmored = UNARMORED_AC[wiz.data.class];

  const wornArmor = inv.find(i => ARMOR_AC[i]);
  const hasShield = inv.some(i => (ARMOR_AC[i]?.bonus || 0) > 0);

  if (wornArmor) {
    const a = ARMOR_AC[wornArmor];
    const dex = a.dex ? (a.dexMax != null ? Math.min(dexMod, a.dexMax) : dexMod) : 0;
    return a.base + Math.max(dex, 0) + (hasShield ? 2 : 0);
  }

  if (unarmored) {
    let ac = unarmored.base;
    if (unarmored.addDex) ac += Math.max(dexMod, 0);
    if (unarmored.addCon) ac += Math.max(statMod(wiz.data.stats?.con || 10), 0);
    if (unarmored.addWis) ac += Math.max(statMod(wiz.data.stats?.wis || 10), 0);
    return ac + (hasShield ? 2 : 0);
  }

  return 10 + Math.max(dexMod, 0) + (hasShield ? 2 : 0);
}

const ALIGNMENTS = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];

const ALIGN_FLAVOR = {
  'Lawful Good': 'Acts with honor, justice, and compassion — the classic hero.',
  'Neutral Good': 'Does good without bias for or against order — a practical altruist.',
  'Chaotic Good': 'Follows conscience over rules — a freedom-loving rebel with a heart.',
  'Lawful Neutral': 'Follows a personal code, law, or tradition — judge, enforcer, or loyal soldier.',
  'True Neutral': 'Balances all perspectives — values harmony and avoids extremes.',
  'Chaotic Neutral': 'Follows whims and urges — unpredictable and utterly free-spirited.',
  'Lawful Evil': 'Uses order and structure for selfish or cruel ends — a calculating tyrant.',
  'Neutral Evil': 'Pure self-interest without pretense — a villain without a cause.',
  'Chaotic Evil': 'Destructive and unpredictable — wants to watch the world burn.',
};
const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

const CLASS_SKILLS = {
  Barbarian: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'],
  Bard: ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'],
  Cleric: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'],
  Druid: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'],
  Fighter: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'],
  Monk: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'],
  Paladin: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'],
  Ranger: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'],
  Rogue: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'],
  Sorcerer: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'],
  Warlock: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'],
  Wizard: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'],
};

function statMod(score) {
  return Math.floor((score - 10) / 2);
}

function formatMod(v) {
  const m = statMod(v);
  return m >= 0 ? `+${m}` : `${m}`;
}

function defaultWizard(userId) {
  return {
    userId,
    step: 0,
    rolledValues: [],
    data: {
      name: '',
      race: '',
      class: '',
      background: '',
      alignment: '',
      stats: {},
      skills: [],
      inventory: [],
      appearance: '',
      personalityTraits: '',
      ideals: '',
      bonds: '',
      flaws: '',
      imageUrl: '',
      campaignId: null,
    },
  };
}

const STEP_COLORS = [Colors.Blurple, Colors.Green, Colors.Red, Colors.Purple, Colors.Gold, Colors.DarkGold, Colors.Orange, Colors.DarkAqua, Colors.LuminousVividPink, Colors.Greyple, Colors.Blurple];

function stepFooter(wiz) {
  const total = 11;
  const done = Math.min(wiz.step, total);
  const blocks = '█'.repeat(done) + '░'.repeat(total - done);
  return `Step ${wiz.step + 1}/${total}  ${blocks}`;
}

function wizardEmbed(wizard, stepIcon) {
  const d = wizard.data;
  const embed = new EmbedBuilder()
    .setColor(STEP_COLORS[wizard.step] || Colors.Blurple)
    .setTitle(`${stepIcon || ''} Character Creation Wizard`)
    .setDescription(d.name ? `**${d.name}**` : 'Create a new character!')
    .setFooter({ text: stepFooter(wizard) });

  const fields = [];
  if (d.race) fields.push({ name: 'Race', value: d.race, inline: true });
  if (d.class) fields.push({ name: 'Class', value: d.class, inline: true });
  if (d.background) fields.push({ name: 'Background', value: d.background, inline: true });
  if (d.alignment) fields.push({ name: 'Alignment', value: d.alignment, inline: true });
  if (Object.keys(d.stats).length) {
    const statStr = ABILITY_NAMES.map(s => `${s.toUpperCase()} ${d.stats[s] || '?'} (${formatMod(d.stats[s] || 10)})`).join(' | ');
    fields.push({ name: 'Ability Scores', value: statStr, inline: false });
  }
  if (d.skills.length) fields.push({ name: 'Skills', value: d.skills.join(', '), inline: false });
  if (fields.length) embed.addFields(fields.slice(0, 8));
  return embed;
}

// ---- Name ----
async function stepName(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('charwizard_modal_name')
    .setTitle('Character Name')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('What is your character\'s name?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., Valeria Shadowbane')
          .setRequired(true)
          .setMaxLength(100)
      )
    );
  await interaction.showModal(modal);
}

// ---- Race ----
async function stepRace(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const select = new StringSelectMenuBuilder()
    .setCustomId('charwizard_race')
    .setPlaceholder('Choose your race...')
    .addOptions(RACES.map(r => new StringSelectMenuOptionBuilder()
      .setLabel(r)
      .setDescription(RACE_ASI[r] || '')
      .setValue(r)
    ));
  const embed = wizardEmbed(wiz, '🌍');
  embed.setDescription(`**${wiz.data.name}** — Choose your **Race**\n\nYour race grants ability score bonuses, special traits, and shapes your character's place in the world.`);
  await interaction.update({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

// ---- Class ----
async function stepClass(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const select = new StringSelectMenuBuilder()
    .setCustomId('charwizard_class')
    .setPlaceholder('Choose your class...')
    .addOptions(CLASSES.map(c => new StringSelectMenuOptionBuilder()
      .setLabel(c)
      .setDescription(`${CLASS_ROLE[c]}  |  HD: ${CLASS_HD[c]}  |  ${CLASS_PRIMARY[c]}`)
      .setValue(c)
    ));
  const embed = wizardEmbed(wiz, '⚔️');
  embed.setDescription(`**${wiz.data.name}** — Choose your **Class**\n\n${CLASS_FLAVOR[wiz.data.class] || 'Your class defines your combat role, hit points, and primary abilities.'}`);
  await interaction.update({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

// ---- Background ----
async function stepBackground(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const select = new StringSelectMenuBuilder()
    .setCustomId('charwizard_bg')
    .setPlaceholder('Choose your background...')
    .addOptions(BACKGROUNDS.map(b => new StringSelectMenuOptionBuilder()
      .setLabel(b)
      .setDescription((BG_FLAVOR[b] || '').slice(0, 100))
      .setValue(b)
    ));
  const embed = wizardEmbed(wiz, '📜');
  embed.setDescription(`**${wiz.data.name}** — Choose your **Background**\n\n${BG_FLAVOR[wiz.data.background] || 'Your background shapes your character\'s history, skills, and starting equipment.'}`);
  await interaction.update({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

// ---- Alignment ----
async function stepAlignment(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const select = new StringSelectMenuBuilder()
    .setCustomId('charwizard_align')
    .setPlaceholder('Choose your alignment...')
    .addOptions(ALIGNMENTS.map(a => new StringSelectMenuOptionBuilder()
      .setLabel(a)
      .setDescription((ALIGN_FLAVOR[a] || '').slice(0, 100))
      .setValue(a)
    ));
  const embed = wizardEmbed(wiz, '⚖️');
  embed.setDescription(`**${wiz.data.name}** — Choose your **Alignment**\n\nAlignment describes your character's moral and ethical outlook — a guide for their decisions and roleplaying.`);
  await interaction.update({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

// ---- Equipment ----
async function stepEquipment(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const cls = wiz.data.class;
  const bg = wiz.data.background;
  const equip = CLASS_EQUIPMENT[cls];
  const bgItems = BG_EQUIPMENT[bg] || [];

  if (!equip || equip.choices.length === 0) {
    wiz.data.inventory = [...(equip?.auto || []), ...bgItems];
    wiz.step = 7;
    return stepStatsMethod(interaction);
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('charwizard_equip')
    .setPlaceholder('Choose your starting equipment...')
    .addOptions(equip.choices.map((c, i) => new StringSelectMenuOptionBuilder()
      .setLabel(c.label)
      .setDescription(c.items.join(', ').slice(0, 100))
      .setValue(String(i))
    ));

  const embed = wizardEmbed(wiz, '🎒');
  embed.setDescription(`**${wiz.data.name}** — Choose **Starting Equipment**\n\nEvery adventurer needs gear. Pick one option for your **${cls}**:`);
  embed.addFields(
    { name: 'Auto-included', value: equip.auto.join(', ') || 'None', inline: false },
    { name: `Background (${bg})`, value: bgItems.join(', ') || 'None', inline: false },
  );
  await interaction.update({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

// ---- Stats Method ----
async function stepStatsMethod(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('charwizard_stats_standard').setLabel('Standard Array').setStyle(ButtonStyle.Primary).setEmoji('📊'),
    new ButtonBuilder().setCustomId('charwizard_stats_pointbuy').setLabel('Point Buy').setStyle(ButtonStyle.Success).setEmoji('💰'),
    new ButtonBuilder().setCustomId('charwizard_stats_roll').setLabel('Roll 4d6').setStyle(ButtonStyle.Danger).setEmoji('🎲'),
  );
  const embed = wizardEmbed(wiz, '💪');
  embed.setDescription(`**${wiz.data.name}** — Generate **Ability Scores**\n\nChoose how to determine your six core abilities: Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma.`);
  await interaction.update({ embeds: [embed], components: [row] });
}

// ---- Standard Array Assign ----
async function showStandardArray(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const assigns = wiz.data.stats || {};
  const assigned = Object.values(assigns).filter(v => v).length;
  const remaining = STANDARD_ARRAY.filter(v => !Object.values(assigns).includes(v));

  if (assigned >= 6) {
    return stepSkills(interaction);
  }

  const nextStat = ABILITY_NAMES.find(s => !assigns[s]);
  if (!nextStat) return stepSkills(interaction);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`charwizard_assign_${nextStat}`)
    .setPlaceholder(`Assign value for ${nextStat.toUpperCase()}...`)
    .addOptions(remaining.map(v => new StringSelectMenuOptionBuilder().setLabel(`${v} (mod ${formatMod(v)})`).setValue(`${v}`)));

  const embed = wizardEmbed(wiz);
  embed.setDescription(`**${wiz.data.name}** — Assign ability scores\nPick a value for **${nextStat.toUpperCase()}** (${assigned + 1}/6)`);
  await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

// ---- Skills ----
async function stepSkills(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const classSkillList = CLASS_SKILLS[wiz.data.class] || [];
  const maxSkills = wiz.data.class === 'Bard' || wiz.data.class === 'Ranger' ? 3 : wiz.data.class === 'Rogue' ? 4 : 2;
  const limited = classSkillList.slice(0, 30);

  if (limited.length === 0) return stepDetailsModal(interaction);

  const select = new StringSelectMenuBuilder()
    .setCustomId('charwizard_skill')
    .setPlaceholder(`Choose up to ${maxSkills} skills...`)
    .setMinValues(1)
    .setMaxValues(Math.min(maxSkills, limited.length))
    .addOptions(limited.map(s => new StringSelectMenuOptionBuilder().setLabel(s).setValue(s)));

  const embed = wizardEmbed(wiz, '🎯');
  embed.setDescription(`**${wiz.data.name}** — Choose **Skills**\n\nAs a **${wiz.data.class}**, you can choose up to **${maxSkills}** class skills. These represent what your character is trained in.`);
  await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

// ---- Details Modal ----
async function stepDetailsModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('charwizard_modal_details')
    .setTitle('Character Details')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('appearance').setLabel('Appearance').setStyle(TextInputStyle.Paragraph).setPlaceholder('e.g., Tall with silver hair and green eyes').setRequired(false).setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('traits').setLabel('Personality Traits').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ideals').setLabel('Ideals').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('bonds').setLabel('Bonds').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('flaws').setLabel('Flaws').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
      ),
    );
  await interaction.showModal(modal);
}

// ---- Image URL ----
async function stepImage(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('charwizard_img_skip').setLabel('Skip — no portrait').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('charwizard_img_add').setLabel('Add portrait URL').setStyle(ButtonStyle.Primary),
  );
  const embed = wizardEmbed(wiz, '🖼️');
  embed.setDescription(`**${wiz.data.name}** — Add a **Portrait**\n\nOptionally add an image URL for your character's portrait, or skip to finish.`);
  await interaction.update({ embeds: [embed], components: [row] });
}

// ---- Confirm ----
async function stepConfirm(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const d = wiz.data;
  const hp = calcHp(wiz);
  const ac = calcAc(wiz);
  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle('Review Your Character')
    .setDescription(`**${d.name}** — Level 1 ${d.race} ${d.class}`)
    .addFields(
      { name: 'Background', value: d.background || 'None', inline: true },
      { name: 'Alignment', value: d.alignment || 'Unaligned', inline: true },
      { name: 'HP', value: `**${hp}** (${CLASS_HD[d.class] || 'd8'} + CON ${formatMod(d.stats.con || 10)})`, inline: true },
      { name: 'AC', value: `**${ac}**`, inline: true },
      { name: 'Ability Scores', value: ABILITY_NAMES.map(s => `${s.toUpperCase()} ${d.stats[s]} (${formatMod(d.stats[s])})`).join(' | '), inline: false },
    );
  if (d.skills.length) embed.addFields({ name: 'Skills', value: d.skills.join(', '), inline: false });
  if (d.inventory && d.inventory.length) embed.addFields({ name: 'Inventory', value: d.inventory.slice(0, 10).join(', '), inline: false });
  if (d.imageUrl) embed.setThumbnail(d.imageUrl);
  if (d.appearance) embed.addFields({ name: 'Appearance', value: d.appearance, inline: false });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('charwizard_confirm_yes').setLabel('Create Character').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('charwizard_confirm_no').setLabel('Cancel').setStyle(ButtonStyle.Danger),
  );
  await interaction.update({ embeds: [embed], components: [row] });
}

// ---- Create ----
async function finishWizard(interaction) {
  const wiz = wizards.get(interaction.user.id);
  const d = wiz.data;
  const hp = calcHp(wiz);
  const ac = calcAc(wiz);

  // Validate campaignId exists before inserting
  let campaignId = d.campaignId;
  if (campaignId) {
    const db = getDb();
    const exists = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(campaignId);
    if (!exists) campaignId = null;
  }

  try {
    const character = createCharacter({
    name: d.name,
    race: d.race,
    class: d.class,
    level: 1,
    background: d.background,
    alignment: d.alignment,
    stats: d.stats,
    hpCurrent: hp,
    hpMax: hp,
    armorClass: ac,
    skills: d.skills.reduce((acc, s) => { acc[s.toLowerCase()] = true; return acc; }, {}),
    proficiencies: d.skills,
    inventory: d.inventory,
    appearance: d.appearance,
    personalityTraits: d.personalityTraits,
    ideals: d.ideals,
    bonds: d.bonds,
    flaws: d.flaws,
    imageUrl: d.imageUrl,
    campaignId,
    playerDiscordId: interaction.user.id,
  });

    wizards.delete(interaction.user.id);

    const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle('Character Created!')
    .setDescription(`**${character.name}** enters the world!`)
    .addFields(
      { name: 'ID', value: `\`${character.id}\``, inline: true },
      { name: 'Race', value: character.race, inline: true },
      { name: 'Class', value: character.class, inline: true },
      { name: 'Level', value: `1`, inline: true },
      { name: 'HP', value: `${character.hp_max}`, inline: true },
      { name: 'AC', value: `${character.armor_class}`, inline: true },
    );
    if (d.imageUrl) embed.setThumbnail(d.imageUrl);
    embed.setFooter({ text: 'Use /character view to see your full sheet' });

    await interaction.update({ embeds: [embed], components: [] });

    const campaignName = campaignId ? getCampaign(campaignId)?.name : null;
    writeCharacterNote(character, interaction.user.username, campaignName).catch(() => {});
  } catch (err) {
    console.error('finishWizard error:', err);
    await interaction.update({
      embeds: [new (await import('discord.js')).EmbedBuilder().setColor(0xc94a4a).setTitle('Error').setDescription('Failed to create character: ' + err.message)],
      components: [],
    }).catch(() => {});
  }
}

// ---- Public API ----
export function getWizard(userId) {
  return wizards.get(userId);
}

export async function startWizard(interaction) {
  const existing = wizards.get(interaction.user.id);
  if (existing) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('charwizard_continue').setLabel('Continue existing').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('charwizard_restart').setLabel('Start over').setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(Colors.Yellow).setTitle('Wizard in Progress').setDescription('You already have a character creation in progress. Continue or start over?')],
      components: [row],
      ephemeral: true,
    });
    return;
  }

  wizards.set(interaction.user.id, {
    ...defaultWizard(interaction.user.id),
    data: { ...defaultWizard(interaction.user.id).data, campaignId: interaction.options?.getInteger('campaign-id') || null },
  });

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(Colors.Blurple).setTitle('Character Creation Wizard').setDescription('Let\'s create your character! Click below to begin.').setFooter({ text: 'Step 1' })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('charwizard_begin').setLabel('Begin').setStyle(ButtonStyle.Success)
    )],
    ephemeral: true,
  });
}

export async function handleWizardComponent(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  let wiz = wizards.get(userId);

  if (!wiz && customId !== 'charwizard_begin') return;

  switch (customId) {
    case 'charwizard_continue':
      await showWizardStep(interaction, wiz);
      break;
    case 'charwizard_restart':
      wizards.set(userId, defaultWizard(userId));
      wiz = wizards.get(userId);
      await showWizardStep(interaction, wiz);
      break;
    case 'charwizard_begin':
      await stepName(interaction);
      break;
    case 'charwizard_race':
      wiz.data.race = interaction.values[0];
      wiz.step = 3;
      await stepClass(interaction);
      break;
    case 'charwizard_class':
      wiz.data.class = interaction.values[0];
      wiz.data.skills = [];
      wiz.step = 4;
      await stepBackground(interaction);
      break;
    case 'charwizard_bg':
      wiz.data.background = interaction.values[0];
      wiz.step = 5;
      await stepAlignment(interaction);
      break;
    case 'charwizard_align':
      wiz.data.alignment = interaction.values[0];
      wiz.step = 6;
      await stepEquipment(interaction);
      break;
    case 'charwizard_equip': {
      const cls = wiz.data.class;
      const bg = wiz.data.background;
      const equip = CLASS_EQUIPMENT[cls];
      const bgItems = BG_EQUIPMENT[bg] || [];
      const choiceIndex = parseInt(interaction.values[0], 10);
      const chosen = equip?.choices[choiceIndex];
      const chosenItems = chosen?.items || [];
      wiz.data.inventory = [...chosenItems, ...(equip?.auto || []), ...bgItems];
      wiz.step = 7;
      await stepStatsMethod(interaction);
      break;
    }
    case 'charwizard_stats_standard':
      wiz.data.stats = {};
      wiz.step = 8;
      await showStandardArray(interaction);
      break;
    case 'charwizard_stats_pointbuy':
      await showPointBuyModal(interaction);
      break;
    case 'charwizard_stats_roll':
      await rollAndShow(interaction);
      break;
    case 'charwizard_skill':
      wiz.data.skills = interaction.values;
      wiz.step = 10;
      await stepDetailsModal(interaction);
      break;
    case 'charwizard_img_skip':
      wiz.step = 12;
      await stepConfirm(interaction);
      break;
    case 'charwizard_img_add':
      await showImageModal(interaction);
      break;
    case 'charwizard_confirm_yes':
      await finishWizard(interaction);
      break;
    case 'charwizard_confirm_no':
      wizards.delete(userId);
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle('Cancelled').setDescription('Character creation cancelled.')],
        components: [],
      });
      break;
    default:
      if (customId.startsWith('charwizard_assign_')) {
        const stat = customId.replace('charwizard_assign_', '');
        const rawValue = interaction.values[0];
        const value = parseInt(rawValue, 10);
        wiz.data.stats[stat] = value;
        if (Object.keys(wiz.data.stats).length >= 6) {
          wiz.step = 9;
          await stepSkills(interaction);
        } else if (wiz.rolledValues.length > 0) {
          const remaining = wiz.rolledValues.filter(v => {
            const assigned = Object.values(wiz.data.stats);
            const countNeeded = wiz.rolledValues.filter(r => r === v).length;
            const countAssigned = assigned.filter(a => a === v).length;
            return countAssigned < countNeeded;
          });
          const nextStat = ABILITY_NAMES.find(s => wiz.data.stats[s] === undefined);
          const select = buildRollAssignSelect(nextStat, remaining);
          const embed = wizardEmbed(wiz);
          embed.setDescription(`**${wiz.data.name}** — Assign ability scores\nPick a value for **${nextStat.toUpperCase()}** (${Object.keys(wiz.data.stats).length + 1}/6)`);
          await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
        } else {
          await showStandardArray(interaction);
        }
      }
  }
}

export async function handleWizardModal(interaction) {
  const wiz = wizards.get(interaction.user.id);
  if (!wiz) return;

  switch (interaction.customId) {
    case 'charwizard_modal_name':
      wiz.data.name = interaction.fields.getTextInputValue('name');
      wiz.step = 2;
      await stepRace(interaction);
      break;
    case 'charwizard_modal_details':
      wiz.data.appearance = interaction.fields.getTextInputValue('appearance');
      wiz.data.personalityTraits = interaction.fields.getTextInputValue('traits');
      wiz.data.ideals = interaction.fields.getTextInputValue('ideals');
      wiz.data.bonds = interaction.fields.getTextInputValue('bonds');
      wiz.data.flaws = interaction.fields.getTextInputValue('flaws');
      wiz.step = 11;
      await stepImage(interaction);
      break;
    case 'charwizard_modal_pointbuy':
      const stats = {};
      for (const s of ABILITY_NAMES) {
        stats[s] = parseInt(interaction.fields.getTextInputValue(s), 10) || 8;
      }
      wiz.data.stats = stats;
      wiz.step = 9;
      await stepSkills(interaction);
      break;
    case 'charwizard_modal_image':
      wiz.data.imageUrl = interaction.fields.getTextInputValue('url');
      wiz.step = 12;
      await stepConfirm(interaction);
      break;
  }
}

async function showWizardStep(interaction, wiz) {
  switch (wiz.step) {
    case 0: return stepName(interaction);
    case 1: return stepName(interaction);
    case 2: return stepRace(interaction);
    case 3: return stepClass(interaction);
    case 4: return stepBackground(interaction);
    case 5: return stepAlignment(interaction);
    case 6: return stepEquipment(interaction);
    case 7: return stepStatsMethod(interaction);
    case 8: return showStandardArray(interaction);
    case 9: return stepSkills(interaction);
    case 10: return stepDetailsModal(interaction);
    case 11: return stepImage(interaction);
    case 12: return stepConfirm(interaction);
    default: return stepConfirm(interaction);
  }
}

async function showPointBuyModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('charwizard_modal_pointbuy')
    .setTitle('Point Buy (27 points)')
    .addComponents(
      ...ABILITY_NAMES.map(s => new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(s)
          .setLabel(`${s.toUpperCase()} (8-15, cost: score-8)`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('8')
          .setRequired(true)
          .setMaxLength(2)
      ))
    );
  await interaction.showModal(modal);
}

async function showImageModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('charwizard_modal_image')
    .setTitle('Portrait Image URL')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('url')
          .setLabel('Image URL (optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('https://i.imgur.com/your-image.png')
          .setRequired(false)
      )
    );
  await interaction.showModal(modal);
}

function buildRollAssignSelect(statName, values) {
  const counts = {};
  return new StringSelectMenuBuilder()
    .setCustomId(`charwizard_assign_${statName}`)
    .setPlaceholder(`Assign value for ${statName.toUpperCase()}...`)
    .addOptions(values.map(v => {
      counts[v] = (counts[v] || 0) + 1;
      const key = counts[v] > 1 ? `${v}_${counts[v]}` : `${v}`;
      return new StringSelectMenuOptionBuilder().setLabel(`${v}`).setValue(key);
    }));
}

async function rollAndShow(interaction) {
  const rolls = [];
  for (let i = 0; i < 6; i++) {
    const dice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    dice.sort((a, b) => a - b);
    rolls.push(dice.slice(1).reduce((a, b) => a + b, 0));
  }
  const sorted = [...rolls].sort((a, b) => b - a);

  const embed = wizardEmbed(wizards.get(interaction.user.id));
  embed.setDescription(`**${wizards.get(interaction.user.id).data.name}** — Rolled scores: ${sorted.join(', ')}`);
  embed.addFields({ name: 'Assign scores', value: 'Use the select menus below to assign each value.' });

  const wiz = wizards.get(interaction.user.id);
  wiz.data.stats = {};
  wiz.rolledValues = sorted;

  const select = buildRollAssignSelect('str', sorted);

  await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}
