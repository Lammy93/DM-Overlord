import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { readFile } from 'fs/promises';
import config from '../config.js';

const TEMPLATES = {
  campaign: `# {{name}}
> *{{description}}*

## Setting
{{setting}}

## Players
{{players}}

## Characters
{{characters}}

## Sessions
{{sessions}}

## Locations
{{locations}}

---

*Created: {{date}}*
`,

  character: `# {{name}}
- **Race:** {{race}}
- **Class:** {{class}}
- **Level:** {{level}}
- **Background:** {{background}}
- **Alignment:** {{alignment}}

## Stats
| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| {{str}} | {{dex}} | {{con}} | {{int}} | {{wis}} | {{cha}} |

**HP:** {{hpCurrent}}/{{hpMax}} | **AC:** {{armorClass}} | **Speed:** {{speed}}ft

## Proficiencies
{{proficiencies}}

## Features & Traits
{{features}}

## Spells
{{spells}}

## Inventory
{{inventory}}

## Wealth
{{currency}}

## Personality
- **Traits:** {{traits}}
- **Ideals:** {{ideals}}
- **Bonds:** {{bonds}}
- **Flaws:** {{flaws}}

## Backstory
{{backstory}}

---

*Player: {{playerName}}*
`,

  session: `# Session {{sessionNumber}}: {{title}}
**Date:** {{date}}
**Location:** {{location}}

## Summary
{{summary}}

## Highlights
{{highlights}}

## Loot Found
{{loot}}

## XP Gained
{{xp}}

## DM Notes
{{dmNotes}}

## Full Log
{{logContent}}
`,

  encounter: `# Encounter: {{name}}
- **Difficulty:** {{difficulty}}
- **Environment:** {{environment}}
- **Status:** {{status}}

## Combatants
{{combatants}}

## Description
{{description}}

## Tactics
{{tactics}}

## Loot
{{loot}}
`,
};

function getVaultPath() {
  return config.obsidian.vaultPath;
}

function getSubfolder() {
  return config.obsidian.subfolder || 'DM-Overlord';
}

function ensureVaultStructure() {
  const base = join(getVaultPath(), getSubfolder());
  const dirs = ['Campaigns', 'Characters', 'Sessions', 'Encounters', 'Locations', 'Templates'];
  for (const dir of dirs) {
    const fullPath = join(base, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  }
  return base;
}

async function writeNote(filePath, content) {
  if (!existsSync(getVaultPath())) {
    return { success: false, error: 'Obsidian vault path does not exist' };
  }
  ensureVaultStructure();
  writeFileSync(filePath, content, 'utf-8');
  return { success: true, path: filePath };
}

export async function writeCampaignNote(campaign) {
  const base = ensureVaultStructure();
  const players = campaign.players?.map(p => `- ${p.discord_username} (${p.role})`).join('\n') || 'None';
  const characters = campaign.characters?.map(c => `- ${c.name} (Level ${c.level} ${c.class})`).join('\n') || 'None';
  const sessions = campaign.currentSession ? `Session ${campaign.currentSession} completed` : 'None yet';

  const content = TEMPLATES.campaign
    .replace('{{name}}', campaign.name)
    .replace('{{description}}', campaign.description || 'No description')
    .replace('{{setting}}', campaign.setting || 'Unknown')
    .replace('{{players}}', players)
    .replace('{{characters}}', characters)
    .replace('{{sessions}}', sessions)
    .replace('{{locations}}', 'No locations registered')
    .replace('{{date}}', new Date().toLocaleDateString());

  const safeName = campaign.name.replace(/[<>:"/\\|?*]/g, '_');
  const filePath = join(base, 'Campaigns', `${safeName}.md`);
  return writeNote(filePath, content);
}

export async function writeCharacterNote(character, playerName = 'Unknown') {
  const base = ensureVaultStructure();
  const stats = typeof character.stats === 'object' ? character.stats : {};
  const profs = Array.isArray(character.proficiencies) ? character.proficiencies.join(', ') : 'None';
  const features = Array.isArray(character.features) ? character.features.join(', ') : 'None';
  const spells = character.spells ? Object.entries(character.spells).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n') : 'None';
  const inv = Array.isArray(character.inventory) ? character.inventory.map(i => `- ${typeof i === 'string' ? i : i.name || i}`).join('\n') : 'None';
  const currency = `${character.gold || 0} gp, ${character.silver || 0} sp, ${character.copper || 0} cp`;

  const content = TEMPLATES.character
    .replace('{{name}}', character.name)
    .replace('{{race}}', character.race || 'Unknown')
    .replace('{{class}}', character.class || 'Unknown')
    .replace('{{level}}', character.level || 1)
    .replace('{{background}}', character.background || 'Unknown')
    .replace('{{alignment}}', character.alignment || 'Unaligned')
    .replace('{{str}}', stats.str || 10)
    .replace('{{dex}}', stats.dex || 10)
    .replace('{{con}}', stats.con || 10)
    .replace('{{int}}', stats.int || 10)
    .replace('{{wis}}', stats.wis || 10)
    .replace('{{cha}}', stats.cha || 10)
    .replace('{{hpCurrent}}', character.hp_current || character.hpMax || '?')
    .replace('{{hpMax}}', character.hp_max || '?')
    .replace('{{armorClass}}', character.armor_class || '?')
    .replace('{{speed}}', character.speed || 30)
    .replace('{{proficiencies}}', profs)
    .replace('{{features}}', features)
    .replace('{{spells}}', spells)
    .replace('{{inventory}}', inv)
    .replace('{{currency}}', currency)
    .replace('{{traits}}', character.personality_traits || 'Unknown')
    .replace('{{ideals}}', character.ideals || 'Unknown')
    .replace('{{bonds}}', character.bonds || 'Unknown')
    .replace('{{flaws}}', character.flaws || 'Unknown')
    .replace('{{backstory}}', character.backstory || 'None yet')
    .replace('{{playerName}}', playerName);

  const safeName = character.name.replace(/[<>:"/\\|?*]/g, '_');
  const filePath = join(base, 'Characters', `${safeName}.md`);
  return writeNote(filePath, content);
}

export async function writeSessionNote(session, campaignName) {
  const base = ensureVaultStructure();
  const content = TEMPLATES.session
    .replace('{{sessionNumber}}', session.session_number)
    .replace('{{title}}', session.title || `Session ${session.session_number}`)
    .replace('{{date}}', new Date(session.created_at || Date.now()).toLocaleDateString())
    .replace('{{location}}', session.location || 'Unknown')
    .replace('{{summary}}', session.summary || 'No summary')
    .replace('{{highlights}}', session.highlights || 'None recorded')
    .replace('{{loot}}', session.loot_found || 'None')
    .replace('{{xp}}', session.xp_gained || 0)
    .replace('{{dmNotes}}', session.dm_notes || 'None')
    .replace('{{logContent}}', session.log_content || 'No detailed log');

  const safeName = `${campaignName ? campaignName.replace(/[<>:"/\\|?*]/g, '_') + '_' : ''}Session_${session.session_number}`;
  const filePath = join(base, 'Sessions', `${safeName}.md`);
  return writeNote(filePath, content);
}

export async function writeEncounterNote(encounter, campaignName) {
  const base = ensureVaultStructure();
  const combatants = encounter.combatants?.map(c =>
    `- ${c.name} | HP: ${c.hp_current}/${c.hp_max} | AC: ${c.ac} | Init: ${c.initiative}`
  ).join('\n') || 'None';

  const content = TEMPLATES.encounter
    .replace('{{name}}', encounter.name)
    .replace('{{difficulty}}', encounter.difficulty || 'Unknown')
    .replace('{{environment}}', encounter.environment || 'Unknown')
    .replace('{{status}}', encounter.status || 'prepared')
    .replace('{{combatants}}', combatants)
    .replace('{{description}}', encounter.description || 'No description')
    .replace('{{tactics}}', 'No tactics recorded')
    .replace('{{loot}}', 'No loot recorded');

  const safeName = `${campaignName ? campaignName.replace(/[<>:"/\\|?*]/g, '_') + '_' : ''}${encounter.name.replace(/[<>:"/\\|?*]/g, '_')}`;
  const filePath = join(base, 'Encounters', `${safeName}.md`);
  return writeNote(filePath, content);
}

export async function testVaultConnection() {
  try {
    if (!existsSync(getVaultPath())) {
      return { connected: false, error: 'Vault path does not exist' };
    }
    ensureVaultStructure();
    return { connected: true, path: getVaultPath(), subfolder: getSubfolder() };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}
