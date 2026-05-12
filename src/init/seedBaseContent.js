import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { getDb } from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CAMPAIGN_NAME = 'The Shadow of Blackfen Moor';
const MODULE_FILE = join(__dirname, '..', 'data', 'blackfen-moor.json');
const DM_DISCORD_ID = process.env.SEED_DM_DISCORD_ID || '000000000000000000';
const WARN_NO_DM = DM_DISCORD_ID === '000000000000000000';

export async function seedBaseContent() {
  if (!existsSync(MODULE_FILE)) {
    console.log(chalk.yellow('[seed] blackfen-moor.json not found, skipping base content seeding'));
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM campaigns WHERE name = ?').get(CAMPAIGN_NAME);
  if (existing) {
    console.log(chalk.gray(`[seed] Campaign "${CAMPAIGN_NAME}" already exists (id=${existing.id}), skipping`));
    return;
  }

  const raw = readFileSync(MODULE_FILE, 'utf-8');
  let moduleData;
  try {
    moduleData = JSON.parse(raw);
  } catch {
    console.log(chalk.red('[seed] Invalid JSON in blackfen-moor.json, skipping'));
    return;
  }
  if (!moduleData.scenes || !moduleData.title) {
    console.log(chalk.red('[seed] blackfen-moor.json missing required fields (title, scenes), skipping'));
    return;
  }
  console.log(chalk.blue(`[seed] Seeding base content: "${CAMPAIGN_NAME}"...`));
  if (WARN_NO_DM) {
    console.log(chalk.yellow('[seed] WARNING: Using placeholder DM ID. Set SEED_DM_DISCORD_ID in .env to assign the campaign to a real user.'));
  }

  const tx = db.transaction(() => {
    const campResult = db.prepare(`
      INSERT INTO campaigns (name, description, setting, status, dm_discord_id, starting_level)
      VALUES (?, ?, ?, 'preparation', ?, ?)
    `).run(
      CAMPAIGN_NAME,
      moduleData.description || null,
      moduleData.setting || null,
      DM_DISCORD_ID,
      moduleData.min_level || 1
    );
    const campaignId = campResult.lastInsertRowid;

    const modResult = db.prepare(`
      INSERT INTO adventure_modules (campaign_id, title, description, min_level, max_level, setting, scenes, variables)
      VALUES (?, ?, ?, ?, ?, ?, ?, '{}')
    `).run(
      campaignId,
      moduleData.title,
      moduleData.description || null,
      moduleData.min_level || 1,
      moduleData.max_level || 20,
      moduleData.setting || null,
      JSON.stringify(moduleData.scenes)
    );
    const moduleId = modResult.lastInsertRowid;

    const customStmt = db.prepare(`
      INSERT INTO custom_content (campaign_id, type, name, data, is_shared)
      VALUES (?, ?, ?, ?, 1)
    `);

    let npcs = 0, locations = 0, items = 0, monsters = 0;

    if (moduleData.npcs) {
      for (const npc of moduleData.npcs) {
        customStmt.run(campaignId, 'npc', npc.name, JSON.stringify(npc));
        npcs++;
      }
    }
    if (moduleData.locations) {
      for (const loc of moduleData.locations) {
        customStmt.run(campaignId, 'location', loc.name, JSON.stringify(loc));
        locations++;
      }
    }
    if (moduleData.items) {
      for (const item of moduleData.items) {
        customStmt.run(campaignId, 'item', item.name, JSON.stringify(item));
        items++;
      }
    }
    if (moduleData.monsters) {
      for (const mon of moduleData.monsters) {
        customStmt.run(campaignId, 'monster', mon.name, JSON.stringify(mon));
        monsters++;
      }
    }

    return { campaignId, moduleId, npcs, locations, items, monsters };
  });

  const result = tx();

  console.log(chalk.green(`  ✔ Campaign "${CAMPAIGN_NAME}" created (id=${result.campaignId})`));
  console.log(chalk.green(`  ✔ Adventure module created (id=${result.moduleId}, ${moduleData.scenes.length} scenes)`));
  if (result.npcs > 0) console.log(chalk.green(`  ✔ ${result.npcs} NPCs imported`));
  if (result.locations > 0) console.log(chalk.green(`  ✔ ${result.locations} locations imported`));
  if (result.items > 0) console.log(chalk.green(`  ✔ ${result.items} items imported`));
  if (result.monsters > 0) console.log(chalk.green(`  ✔ ${result.monsters} monsters imported`));
  console.log(chalk.blue('[seed] Base content seeding complete'));
}
