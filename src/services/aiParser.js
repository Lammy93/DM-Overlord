import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';

let openai;
let anthropic;

function useOpenAICompat() {
  return config.ai.provider === 'claude' && config.ai.claudeBaseUrl;
}

function getKey() {
  if (config.ai.provider === 'claude' && !config.ai.claudeBaseUrl) return config.ai.claudeKey;
  if (config.ai.provider === 'claude') return config.ai.claudeKey;
  return config.ai.openaiKey;
}

function getClient() {
  if (config.ai.provider === 'openai' || useOpenAICompat()) {
    if (!openai) {
      const key = useOpenAICompat() ? config.ai.claudeKey : config.ai.openaiKey;
      if (!key) return null;
      const opts = { apiKey: key };
      const baseUrl = useOpenAICompat() ? config.ai.claudeBaseUrl : config.ai.openaiBaseUrl;
      if (baseUrl) opts.baseURL = baseUrl;
      openai = new OpenAI(opts);
    }
    return openai;
  }
  if (!anthropic) {
    if (!config.ai.claudeKey) return null;
    anthropic = new Anthropic({ apiKey: config.ai.claudeKey });
  }
  return anthropic;
}

function getModel() {
  if (config.ai.model) return config.ai.model;
  if (useOpenAICompat()) return 'claude-3-5-sonnet-20241022';
  if (config.ai.provider === 'openai') return 'gpt-4o-mini';
  return 'claude-3-5-sonnet-20241022';
}

const CHUNK_SIZE = 100000;
const CHUNK_OVERLAP = 2000;

const PARSE_PROMPT = `You are a D&D campaign parser. Given raw text extracted from a D&D campaign book PDF, extract ALL structured data.

Return valid JSON with this structure:
{
  "title": "Campaign title",
  "summary": "Brief 2-3 sentence summary",
  "chapters": [
    {
      "title": "Chapter title",
      "chapter_number": 1,
      "content": "Full detailed chapter content — preserve as much original text as possible, do not condense or summarize",
      "is_dm_section": false,
      "scenes": [
        {
          "id": "unique_scene_id",
          "title": "Scene title",
          "type": "narrative|combat|roleplay|exploration",
          "text": "Full scene text — preserve details, dialogue, and descriptions",
          "dm_notes": "Hidden DM information",
          "choices": [
            {
              "text": "Choice description",
              "nextScene": "target_scene_id",
              "requiredCheck": { "skill": "perception", "dc": 12 }
            }
          ],
          "monsters": ["monster_name_or_srd_id"],
          "environment": "forest|dungeon|etc",
          "loot": "Description of loot found"
        }
      ]
    }
  ],
  "npcs": [
    { "name": "NPC name", "role": "quest_giver|villain|ally|merchant|innkeeper", "description": "Full appearance and personality", "location": "Where found", "secrets": "Hidden info" }
  ],
  "locations": [
    { "name": "Location name", "type": "town|dungeon|wilderness|shop|temple|tavern", "description": "Full location description", "notable_features": ["feature1"], "danger_level": "low|medium|high|deadly" }
  ],
  "monsters": [
    { "name": "Monster name", "count": 2, "tactics": "How they fight", "page": "page number or N/A" }
  ],
  "items": [
    { "name": "Item name", "type": "weapon|armor|potion|magic|wondrous", "description": "Full item description", "value": "gp value if listed" }
  ],
  "materials": [
    { "name": "Material name", "type": "crafting|alchemical|harvest", "description": "Description", "value": "value if listed" }
  ]
}

RULES:
- Extract EVERYTHING — do not skip content, do not condense
- Preserve all chapter text in the "content" field — this is the full chapter text, not a summary
- Extract ALL NPCs mentioned with their roles and locations
- Extract ALL locations with features
- Extract ALL monsters, items, and materials
- For scenes, preserve original descriptions, dialogue, and room details
- If unsure about a field, use empty array or null
- The "content" field should contain the complete original chapter text whenever possible`;

const CONTINUE_PROMPT = `You are a D&D campaign parser continuing to parse additional text from a campaign book. You have already extracted data from earlier portions. Now extract ALL new structured data from this additional text.

Return valid JSON with this structure — only include NEW content not already extracted:
{
  "chapters": [
    {
      "title": "Chapter title",
      "chapter_number": number,
      "content": "Full detailed chapter content — preserve original text",
      "is_dm_section": false,
      "scenes": [
        {
          "id": "scene_id",
          "title": "Scene title",
          "type": "narrative|combat|roleplay|exploration",
          "text": "Full scene text",
          "dm_notes": "Hidden DM info",
          "choices": [],
          "monsters": [],
          "environment": "",
          "loot": ""
        }
      ]
    }
  ],
  "npcs": [
    { "name": "", "role": "", "description": "", "location": "", "secrets": "" }
  ],
  "locations": [
    { "name": "", "type": "", "description": "", "notable_features": [], "danger_level": "" }
  ],
  "monsters": [
    { "name": "", "count": 1, "tactics": "", "page": "" }
  ],
  "items": [
    { "name": "", "type": "", "description": "", "value": "" }
  ],
  "materials": [
    { "name": "", "type": "", "description": "", "value": "" }
  ]
}

Only include entries that appear in THIS text segment. Do not repeat entries from previous segments.`;

function hasAI() {
  if (useOpenAICompat()) return !!config.ai.claudeKey;
  if (config.ai.provider === 'claude') return !!config.ai.claudeKey;
  return !!config.ai.openaiKey;
}

export { hasAI, parseJson };

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse AI response as JSON');
  }
}

async function callAIAPI(systemPrompt, userMsg, maxTokens = 16000, temperature = 0.3) {
  const client = getClient();
  const model = getModel();

  if (useOpenAICompat() || config.ai.provider === 'openai') {
    const opts = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      temperature,
      max_tokens: maxTokens,
    };
    if (!useOpenAICompat()) opts.response_format = { type: 'json_object' };
    const response = await client.chat.completions.create(opts);
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('AI returned empty response');
    return raw;
  }

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  });
  const raw = response.content[0]?.text;
  if (!raw) throw new Error('AI returned empty response');
  return raw;
}

function fallbackParse(text, title) {
  const chapters = [];
  const lines = text.split('\n');
  let currentChapter = null;
  let currentContent = [];
  let chapterNum = 0;

  const chapterPattern = /^(chapter|appendix|introduction|prologue|epilogue)\s+(\d+|[IVXLCDM]+)/i;
  const sectionPattern = /^[A-Z][A-Z\s\-]{3,}$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const chapterMatch = trimmed.match(chapterPattern);
    const sectionMatch = !chapterMatch && trimmed.match(sectionPattern) && trimmed.length > 10;

    if (chapterMatch || sectionMatch) {
      if (currentChapter) {
        chapters.push({ title: currentChapter, chapter_number: chapterNum, content: currentContent.join('\n').trim(), is_dm_section: false, scenes: [] });
      }
      chapterNum++;
      currentChapter = trimmed;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentChapter && currentContent.length > 0) {
    chapters.push({ title: currentChapter, chapter_number: chapterNum, content: currentContent.join('\n').trim(), is_dm_section: false, scenes: [] });
  }

  if (chapters.length === 0) {
    const paragraphs = text.split(/\n\s*\n/);
    const chunkSize = 5;
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      const chunk = paragraphs.slice(i, i + chunkSize).join('\n\n');
      const firstLine = chunk.split('\n')[0].trim().slice(0, 60);
      chapters.push({ title: firstLine || `Section ${Math.floor(i / chunkSize) + 1}`, chapter_number: Math.floor(i / chunkSize) + 1, content: chunk, is_dm_section: false, scenes: [] });
    }
  }

  const npcs = [];
  const extractPattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*\(/gm;
  let npcMatch;
  while ((npcMatch = extractPattern.exec(text)) !== null) {
    const name = npcMatch[0].replace(/\(.*$/, '').trim();
    if (name.length > 2 && name.split(' ').length <= 4) {
      npcs.push({ name, role: 'unknown', description: '', location: '', secrets: '' });
    }
  }

  const locations = [];
  const locPattern = /^(?:area|location|room)\s+\d+[:\s].+$/gim;
  let locMatch;
  while ((locMatch = locPattern.exec(text)) !== null) {
    locations.push({ name: locMatch[0].trim(), type: 'location', description: '', notable_features: [], danger_level: 'unknown' });
  }

  const uniqueNpcs = [];
  const seenNpc = new Set();
  for (const n of npcs) {
    const key = n.name.toLowerCase();
    if (!seenNpc.has(key)) { seenNpc.add(key); uniqueNpcs.push(n); }
  }

  return {
    title: title || 'Unknown',
    summary: text.slice(0, 500),
    chapters,
    npcs: uniqueNpcs.slice(0, 100),
    locations: locations.slice(0, 50),
    monsters: [],
    items: [],
    materials: [],
  };
}

function mergeResults(base, incoming) {
  if (!incoming) return base;

  if (incoming.title) base.title = incoming.title;
  if (incoming.summary && !base.summary) base.summary = incoming.summary;

  if (Array.isArray(incoming.chapters)) {
    for (const ch of incoming.chapters) {
      const exists = base.chapters.some(c => c.title === ch.title || c.chapter_number === ch.chapter_number);
      if (!exists) base.chapters.push(ch);
    }
  }

  const dedupe = (existing, incomingItems, key) => {
    const names = new Set(existing.map(i => i.name?.toLowerCase()));
    for (const item of incomingItems) {
      if (!names.has(item.name?.toLowerCase())) {
        existing.push(item);
        names.add(item.name?.toLowerCase());
      }
    }
  };

  if (Array.isArray(incoming.npcs)) dedupe(base.npcs, incoming.npcs, 'name');
  if (Array.isArray(incoming.locations)) dedupe(base.locations, incoming.locations, 'name');
  if (Array.isArray(incoming.monsters)) dedupe(base.monsters, incoming.monsters, 'name');
  if (Array.isArray(incoming.items)) dedupe(base.items, incoming.items, 'name');
  if (Array.isArray(incoming.materials)) {
    if (!base.materials) base.materials = [];
    dedupe(base.materials, incoming.materials, 'name');
  }

  return base;
}

export async function parseCampaignText(text, title = 'Unknown Campaign', onProgress = null) {
  if (!hasAI()) return fallbackParse(text, title);

  if (text.length <= CHUNK_SIZE) {
    try {
      const raw = await callAIAPI(PARSE_PROMPT, `Campaign title: ${title}\n\nFull text:\n\n${text}`, 16000, 0.3);
      const result = parseJson(raw);
      if (onProgress) onProgress(1, 1, 'done');
      return result;
    } catch (e) {
      console.warn('AI parse failed, using fallback:', e.message);
      return fallbackParse(text, title);
    }
  }

  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    const start = i === 0 ? 0 : i - CHUNK_OVERLAP;
    chunks.push(text.slice(start, i + CHUNK_SIZE));
  }

  let merged = fallbackParse(text.slice(0, 100000), title);

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length, 'parsing');

    try {
      if (i === 0) {
        const raw = await callAIAPI(PARSE_PROMPT, `Campaign title: ${title}\n\nFull text (part 1 of ${chunks.length}):\n\n${chunks[i]}`, 16000, 0.3);
        merged = parseJson(raw);
        if (!merged || typeof merged !== 'object') merged = { title, chapters: [], npcs: [], locations: [], monsters: [], items: [], materials: [] };
      } else {
        const prevSummary = `Already extracted: ${merged.chapters.length} chapters, ${merged.npcs.length} NPCs, ${merged.locations.length} locations, ${merged.monsters.length} monsters, ${merged.items.length} items.`;
        const context = `Campaign: ${title || 'Unknown'}\n${prevSummary}\n\nAdditional text (part ${i + 1} of ${chunks.length}):\n\n${chunks[i]}`;
        const raw = await callAIAPI(CONTINUE_PROMPT, context, 8000, 0.3);
        const incoming = parseJson(raw);
        if (incoming && typeof incoming === 'object') {
          merged = mergeResults(merged, incoming);
        }
      }
    } catch (e) {
      console.warn(`AI chunk ${i + 1}/${chunks.length} failed:`, e.message);
    }
  }

  if (onProgress) onProgress(chunks.length, chunks.length, 'done');
  return merged;
}

export async function refineWithAI(chapterText, context) {
  if (!hasAI()) return null;

  try {
    const input = chapterText.length > CHUNK_SIZE ? chapterText.slice(0, CHUNK_SIZE) : chapterText;
    const userMsg = `Campaign context: ${context}\n\nChapter text:\n${input}`;
    const systemPrompt = `You are refining a chapter from a D&D campaign. Given the chapter text and the overall campaign context, extract scenes, choices, encounters, and NPCs. Return valid JSON with the same chapter/scene structure as the main parse. Preserve as much original text detail as possible.`;
    const raw = await callAIAPI(systemPrompt, userMsg, 16000, 0.3);
    return parseJson(raw);
  } catch (e) {
    console.warn('AI refine failed:', e.message);
    return null;
  }
}

export async function generateDMNarration(scene, style = 'descriptive') {
  if (!hasAI()) return scene.text;

  try {
    const systemPrompt = `You are a D&D Dungeon Master. Narrate scenes in a ${style} style. Be immersive and evocative. Keep it to 2-3 paragraphs.`;
    const userMsg = `Scene title: ${scene.title}\nScene description: ${scene.text}\nEnvironment: ${scene.environment || 'unknown'}\nMonsters present: ${(scene.monsters || []).join(', ') || 'none'}`;
    return await callAIAPI(systemPrompt, userMsg, 1000, 0.8);
  } catch (e) {
    console.warn('AI narration failed:', e.message);
    return scene.text;
  }
}
