import OpenAI from 'openai';
import config from '../config.js';

let openai;

function getClient() {
  if (!openai) {
    if (!config.ai.openaiKey) {
      throw new Error('OPENAI_API_KEY not set in .env');
    }
    openai = new OpenAI({ apiKey: config.ai.openaiKey });
  }
  return openai;
}

const PARSE_PROMPT = `You are a D&D campaign parser. Given raw text extracted from a D&D campaign book PDF, extract structured data.

Return valid JSON with this structure:
{
  "title": "Campaign title",
  "summary": "Brief 2-3 sentence summary",
  "chapters": [
    {
      "title": "Chapter title",
      "chapter_number": 1,
      "content": "Condensed chapter content",
      "is_dm_section": false,
      "scenes": [
        {
          "id": "unique_scene_id",
          "title": "Scene title",
          "type": "narrative|combat|roleplay|exploration",
          "text": "Scene description text for players",
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
    { "name": "NPC name", "role": "quest_giver|villain|ally", "description": "Appearance and personality", "location": "Where found", "secrets": "Hidden info" }
  ],
  "locations": [
    { "name": "Location name", "type": "town|dungeon|wilderness", "description": "Location description", "notable_features": ["feature1"], "danger_level": "low|medium|high" }
  ],
  "monsters": [
    { "name": "Monster name", "count": 2, "tactics": "How they fight" }
  ],
  "items": [
    { "name": "Item name", "type": "weapon|armor|potion|magic", "description": "Item description" }
  ]
}

IMPORTANT: Extract as much structured content as possible. If unsure about a field, use empty array or null. Keep scene text concise but evocative.`;

export async function parseCampaignText(text, title = 'Unknown Campaign') {
  const client = getClient();
  const chunks = text.length > 12000 ? [text.slice(0, 12000)] : [text];

  const response = await client.chat.completions.create({
    model: config.ai.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: PARSE_PROMPT },
      { role: 'user', content: `Campaign title: ${title}\n\nRaw text:\n\n${chunks[0]}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('AI returned empty response');

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse AI response as JSON');
  }
}

export async function refineWithAI(chapterText, context) {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: config.ai.model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are refining a chapter from a D&D campaign. Given the chapter text and the overall campaign context, extract scenes, choices, encounters, and NPCs. Return valid JSON with the same chapter/scene structure as the main parse.`,
      },
      {
        role: 'user',
        content: `Campaign context: ${context}\n\nChapter text:\n${chapterText}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

export async function generateDMNarration(scene, style = 'descriptive') {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: config.ai.model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a D&D Dungeon Master. Narrate scenes in a ${style} style. Be immersive and evocative. Keep it to 2-3 paragraphs.`,
      },
      {
        role: 'user',
        content: `Scene title: ${scene.title}\nScene description: ${scene.text}\nEnvironment: ${scene.environment || 'unknown'}\nMonsters present: ${(scene.monsters || []).join(', ') || 'none'}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || scene.text;
}
