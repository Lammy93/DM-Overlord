import config from '../config.js';
import { hasAI, parseJson } from './aiParser.js';
import { getSrdMonster, getSrdMonsters } from './srd.js';
import { createEncounter, addCombatant } from './encounter.js';
import { addMap, addPin } from './maps.js';
import { addLocation } from './campaign.js';

const ENCOUNTER_PROMPT = `You are a D&D 5e encounter designer. Create a balanced combat encounter.

Given party details (level, size), environment, and difficulty, return valid JSON:

{
  "name": "Encounter name",
  "description": "Evocative 2-3 sentence encounter description",
  "environment": "environment type",
  "difficulty": "easy|medium|hard|deadly",
  "monsters": [
    {
      "name": "SRD monster name (use exact 5e SRD names like Goblin, Hobgoblin, Owlbear, etc.)",
      "count": 2,
      "tactics": "How this group fights"
    }
  ],
  "loot": "Description of treasure or items found",
  "loot_items": ["item_name_1", "item_name_2"],
  "xp_reward": 450,
  "environmental_features": ["cover spots", "hazards", "terrain features"],
  "dm_notes": "Hidden DM strategy notes and encounter adjustments"
}

IMPORTANT: 
- Use real SRD monster names (Goblin, Hobgoblin, Giant Spider, Zombie, etc.)
- Match difficulty to party level using 5e encounter building rules
- Keep monster count reasonable (1-8 total)
- XP reward should match total monster XP`;

const MAP_PROMPT = `You are a D&D campaign cartographer. Given a campaign setting and location description, create a detailed map.

Return valid JSON:

{
  "name": "Map/Location name",
  "description": "Rich 3-4 sentence map description",
  "environment": "forest|dungeon|cave|city|mountain|swamp|coast|underdark|etc",
  "notes": "DM notes about this location, secrets, hidden passages, atmosphere",
  "grid_size": 50,
  "width": 2000,
  "height": 1500,
  "pins": [
    {
      "label": "Point of Interest name",
      "description": "What's here, encounters, loot, NPCs",
      "x": 500,
      "y": 300,
      "pin_type": "location|entrance|treasure|danger|npc|lore"
    }
  ],
  "location_type": "town|dungeon|wilderness|landmark",
  "suggested_encounters": ["encounter idea 1", "encounter idea 2"],
  "atmosphere": "Mood and sensory details for this place"
}

IMPORTANT:
- Pin coordinates should be within width/height bounds
- Include 3-6 pins minimum for interesting locations
- Make descriptions evocative and useful for a DM
- atmosphere should describe sights, sounds, and smells`;

async function callAI(systemPrompt, userMsg, temp = 0.7) {
  if (!hasAI()) return null;

  const useCompat = config.ai.provider === 'claude' && config.ai.claudeBaseUrl;
  const model = config.ai.model || (config.ai.provider === 'openai' || useCompat ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022');

  if (config.ai.provider === 'openai' || useCompat) {
    const { default: OpenAI } = await import('openai');
    const key = useCompat ? config.ai.claudeKey : config.ai.openaiKey;
    const baseUrl = useCompat ? config.ai.claudeBaseUrl : config.ai.openaiBaseUrl;
    const opts = { apiKey: key };
    if (baseUrl) opts.baseURL = baseUrl;
    const client = new OpenAI(opts);
    const cOpts = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      temperature: temp,
      max_tokens: 4000,
    };
    if (!useCompat) cOpts.response_format = { type: 'json_object' };
    const response = await client.chat.completions.create(cOpts);
    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    return parseJson(raw);
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: config.ai.claudeKey });
  const response = await client.messages.create({
    model,
    max_tokens: 4000,
    temperature: temp,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  });
  const raw = response.content[0]?.text;
  if (!raw) return null;
  return parseJson(raw);
}

function buildFallbackEncounter(partyLevel, partySize, environment, difficulty) {
  const crMap = { easy: 0.25, medium: 0.5, hard: 1, deadly: 2 };
  const targetCr = crMap[difficulty] || 0.5;
  const candidates = getSrdMonsters(partyLevel, environment);
  
  let chosen;
  if (candidates.length > 0) {
    chosen = candidates.sort((a, b) => {
      const aDiff = Math.abs(parseCr(a.challenge_rating) - targetCr);
      const bDiff = Math.abs(parseCr(b.challenge_rating) - targetCr);
      return aDiff - bDiff;
    })[0];
  } else {
    const all = getSrdMonsters(partyLevel);
    chosen = all.length > 0 ? all[Math.floor(Math.random() * all.length)] : null;
  }

  if (!chosen) {
    return {
      name: 'Random Encounter',
      description: 'A random group of foes blocks your path.',
      environment: environment || 'wilderness',
      difficulty,
      monsters: [{ name: 'Goblin', count: Math.min(partySize + 1, 6), tactics: 'Swarm the strongest foe' }],
      loot: 'A few silver coins and rations.',
      xp_reward: 100,
      environmental_features: ['Difficult terrain'],
      dm_notes: 'Adjust on the fly for party strength.',
    };
  }

  const count = Math.max(1, Math.min(Math.floor((partySize * (parseCr(chosen.challenge_rating) + 1)) / (parseCr(chosen.challenge_rating) || 0.5)), 8));
  return {
    name: `${chosen.size || 'Wild'} ${chosen.type || 'Creature'} Encounter`,
    description: `${count} ${chosen.name}${count > 1 ? 's' : ''} emerge from the ${environment || 'shadows'}!`,
    environment: environment || 'wilderness',
    difficulty,
    monsters: [{ name: chosen.name, count, tactics: 'Standard pack tactics' }],
    loot: `${chosen.name} lair contains scattered coins and gear.`,
    xp_reward: Math.round((parseCr(chosen.challenge_rating) || 0.5) * 200 * count),
    environmental_features: ['Some cover available'],
    dm_notes: 'Standard encounter. Adjust numbers if party breezes through.',
  };
}

function buildFallbackMap(campaignName, locationDesc) {
  return {
    name: `${locationDesc || 'Uncharted'} Region`,
    description: `A mysterious area within the ${campaignName} campaign. Unexplored and full of potential adventure.`,
    environment: 'wilderness',
    notes: 'This area is ripe for exploration. Consider adding custom encounters and points of interest.',
    grid_size: 50,
    width: 2000,
    height: 1500,
    pins: [
      { label: 'Entrance', description: 'The way into this area.', x: 1000, y: 1400, pin_type: 'entrance' },
      { label: 'Central Clearing', description: 'An open area that could serve as a camp or ambush site.', x: 1000, y: 750, pin_type: 'location' },
      { label: 'Ancient Ruins', description: 'Crumbled stone structures hint at older civilizations.', x: 400, y: 300, pin_type: 'lore' },
    ],
    location_type: 'wilderness',
    suggested_encounters: ['Wandering monsters', 'Environmental hazard'],
    atmosphere: 'The air is still and quiet. Nature has reclaimed this place.',
  };
}

function parseCr(cr) {
  if (cr === null || cr === undefined) return 0;
  if (typeof cr === 'number') return cr;
  const fractions = { '1/8': 0.125, '1/4': 0.25, '1/2': 0.5 };
  return fractions[cr] || parseFloat(cr) || 0;
}

export async function generateEncounterAI(campaignId, partyLevel, partySize, environment, difficulty) {
  const prompt = `
Party: ${partySize} characters, Level ${partyLevel}
Environment: ${environment || 'any'}
Difficulty: ${difficulty || 'medium'}

Design a balanced D&D 5e encounter. Return valid JSON.`;

  let data = null;
  if (hasAI()) {
    try {
      data = await callAI(ENCOUNTER_PROMPT, prompt, 0.7);
    } catch (e) {
      console.warn('AI encounter generation failed, using fallback:', e.message);
    }
  }

  if (!data || !data.monsters || data.monsters.length === 0) {
    data = buildFallbackEncounter(partyLevel, partySize, environment, difficulty);
  }

  const encounter = createEncounter({
    campaignId,
    name: data.name,
    description: `${data.description}\n\n**DM Notes:** ${data.dm_notes || 'None'}\n\n**Environmental Features:** ${(data.environmental_features || []).join(', ') || 'None'}`,
    environment: data.environment || environment || 'wilderness',
    difficulty: data.difficulty || difficulty || 'medium',
  });

  for (const m of data.monsters) {
    const monster = getSrdMonster(m.name);
    if (monster) {
      for (let i = 0; i < m.count; i++) {
        const name = m.count > 1 ? `${monster.name} ${i + 1}` : monster.name;
        const initiative = Math.floor(Math.random() * 20) + 1 + Math.floor((monster.stats?.dex || 10) - 10) / 2;
        addCombatant(encounter.id, {
          name,
          type: 'monster',
          monsterId: monster.id,
          hpMax: monster.hp,
          ac: monster.ac,
          initiative,
          notes: m.tactics || null,
        });
      }
    }
  }

  return {
    encounter,
    monsters: data.monsters,
    loot: data.loot || 'No notable treasure.',
    loot_items: data.loot_items || [],
    xp_reward: data.xp_reward || 0,
    environmental_features: data.environmental_features || [],
    dm_notes: data.dm_notes || '',
  };
}

export async function generateMapAI(campaignId, campaignName, locationName, locationDesc) {
  const prompt = `
Campaign: ${campaignName}
Location: ${locationName || 'Unnamed Area'}
Description: ${locationDesc || 'A mysterious uncharted location'}

Create a detailed D&D map for this location. Return valid JSON.`;

  let data = null;
  if (hasAI()) {
    try {
      data = await callAI(MAP_PROMPT, prompt, 0.8);
    } catch (e) {
      console.warn('AI map generation failed, using fallback:', e.message);
    }
  }

  if (!data) {
    data = buildFallbackMap(campaignName, locationName || locationDesc);
  }

  const map = addMap(campaignId, {
    name: data.name,
    imageUrl: '',
    width: data.width || 2000,
    height: data.height || 1500,
    gridSize: data.grid_size || 50,
    notes: `**Description:** ${data.description}\n\n**Atmosphere:** ${data.atmosphere || ''}\n\n**DM Notes:** ${data.notes || ''}\n\n**Suggested Encounters:** ${(data.suggested_encounters || []).join(', ') || 'None'}`,
  });

  if (data.pins && Array.isArray(data.pins)) {
    for (const pin of data.pins) {
      addPin(map.id, {
        label: pin.label,
        description: pin.description,
        x: pin.x,
        y: pin.y,
        pinType: pin.pin_type || 'location',
        icon: null,
      });
    }
  }

  addLocation(campaignId, {
    name: data.name,
    type: data.location_type || 'wilderness',
    description: `${data.description}\n\n${data.atmosphere || ''}`,
  });

  return {
    map,
    pins: data.pins || [],
    atmosphere: data.atmosphere || '',
    suggested_encounters: data.suggested_encounters || [],
    dm_notes: data.notes || '',
  };
}
