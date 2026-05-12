import { getDb } from '../db/index.js';

export function saveSourceDocument(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO source_documents (campaign_id, title, author, source_type, raw_text, chapters, npcs, locations, encounters, items, monsters, materials, summary, parsed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const result = stmt.run(
    data.campaignId || null,
    data.title,
    data.author || null,
    data.sourceType || 'pdf',
    data.rawText || null,
    JSON.stringify(data.chapters || []),
    JSON.stringify(data.npcs || []),
    JSON.stringify(data.locations || []),
    JSON.stringify(data.encounters || []),
    JSON.stringify(data.items || []),
    JSON.stringify(data.monsters || []),
    JSON.stringify(data.materials || []),
    data.summary || null,
  );
  const docId = result.lastInsertRowid;

  if (data.chapters && data.chapters.length > 0) {
    const chapterStmt = db.prepare(`
      INSERT INTO document_chapters (document_id, title, chapter_number, content, scenes, is_dm_section, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const ch of data.chapters) {
      chapterStmt.run(
        docId,
        ch.title || `Chapter ${ch.chapter_number || 0}`,
        ch.chapter_number || null,
        ch.content || null,
        JSON.stringify(ch.scenes || []),
        ch.is_dm_section ? 1 : 0,
        JSON.stringify(ch.metadata || {}),
      );
    }
  }

  return getDocument(docId);
}

export function getDocument(id) {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM source_documents WHERE id = ?').get(id);
  if (!doc) return null;
  doc.chapters = db.prepare('SELECT * FROM document_chapters WHERE document_id = ? ORDER BY chapter_number ASC').all(id);
  return parseDocFields(doc);
}

export function listDocuments(campaignId) {
  const db = getDb();
  return db.prepare('SELECT id, title, author, source_type, summary, parsed_at, created_at FROM source_documents WHERE campaign_id = ? ORDER BY created_at DESC').all(campaignId);
}

export function searchDocuments(campaignId, query) {
  const db = getDb();
  return db.prepare(
    "SELECT id, title, summary FROM source_documents WHERE campaign_id = ? AND (title LIKE ? OR summary LIKE ?)"
  ).all(campaignId, `%${query}%`, `%${query}%`);
}

export function deleteDocument(id) {
  const db = getDb();
  db.prepare('DELETE FROM source_documents WHERE id = ?').run(id);
}

export async function convertDocumentToModule(docId, campaignId, authorDiscordId) {
  const doc = getDocument(docId);
  if (!doc) return null;

  const parsedChapters = typeof doc.chapters === 'string' ? JSON.parse(doc.chapters) : doc.chapters;
  const parsedNpcs = typeof doc.npcs === 'string' ? JSON.parse(doc.npcs) : doc.npcs;
  const parsedMonsters = typeof doc.monsters === 'string' ? JSON.parse(doc.monsters) : doc.monsters;
  const parsedItems = typeof doc.items === 'string' ? JSON.parse(doc.items) : doc.items;
  const parsedMaterials = typeof doc.materials === 'string' ? JSON.parse(doc.materials) : (doc.materials || []);
  const parsedLocations = typeof doc.locations === 'string' ? JSON.parse(doc.locations) : (doc.locations || []);

  const allScenes = [];
  for (const ch of (doc.chapters || [])) {
    const parsedScenes = typeof ch.scenes === 'string' ? JSON.parse(ch.scenes) : (ch.scenes || []);
    for (const scene of parsedScenes) {
      allScenes.push({
        ...scene,
        chapterTitle: ch.title,
        chapterNumber: ch.chapter_number,
      });
    }
  }

  const { createModule } = await import('./adventure.js');

  const moduleData = {
    campaignId,
    authorDiscordId,
    title: doc.title,
    description: doc.summary || `Campaign: ${doc.title}`,
    scenes: allScenes,
    variables: {
      campaign_title: doc.title,
      npcs: parsedNpcs || [],
      monsters: parsedMonsters || [],
      items: parsedItems || [],
      materials: parsedMaterials || [],
      locations: parsedLocations || [],
    },
  };

  return createModule(moduleData);
}

function parseDocFields(doc) {
  const parse = (field) => {
    if (!field) return [];
    if (typeof field === 'object') return field;
    try { return JSON.parse(field); } catch { return []; }
  };
  return {
    ...doc,
    chapters: doc.chapters || parse(doc.db_chapters),
    npcs: parse(doc.npcs),
    locations: parse(doc.locations),
    encounters: parse(doc.encounters),
    items: parse(doc.items),
    monsters: parse(doc.monsters),
    materials: parse(doc.materials),
  };
}
