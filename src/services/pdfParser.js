import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import config from '../config.js';

let pdfParse;

async function loadPdfParse() {
  if (!pdfParse) {
    pdfParse = (await import('pdf-parse')).default;
  }
  return pdfParse;
}

export async function extractTextFromPdf(filePath) {
  if (!existsSync(filePath)) {
    throw new Error('File not found');
  }

  const parser = await loadPdfParse();
  const dataBuffer = await readFile(filePath);
  const data = await parser(dataBuffer);

  return {
    text: data.text,
    pages: data.numpages,
    title: path.basename(filePath, '.pdf'),
    metadata: data.metadata || {},
  };
}

export function chunkText(text, maxChunkSize = 8000) {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let current = [];

  for (const para of paragraphs) {
    const size = current.join('\n\n').length + para.length + 2;
    if (size > maxChunkSize && current.length > 0) {
      chunks.push(current.join('\n\n'));
      current = [para];
    } else {
      current.push(para);
    }
  }
  if (current.length > 0) chunks.push(current.join('\n\n'));
  return chunks;
}

export function extractTableOfContents(text) {
  const lines = text.split('\n');
  const tocLines = [];
  let inToc = false;

  const tocPatterns = [
    /^table\s+of\s+contents$/i,
    /^contents$/i,
    /^chapter\s+\d+/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (tocPatterns.some(p => p.test(trimmed))) {
      inToc = true;
      continue;
    }
    if (inToc && /^chapter\s+\d+/i.test(trimmed)) {
      tocLines.push(trimmed);
      continue;
    }
    if (inToc && /^\d+$/.test(trimmed)) continue;
    if (inToc && /^introduction/i.test(trimmed)) {
      tocLines.push(trimmed);
      continue;
    }
    if (inToc && trimmed.length > 0 && /^[A-Z]/.test(trimmed)) {
      tocLines.push(trimmed);
      continue;
    }
    if (inToc && /^appendix/i.test(trimmed)) {
      tocLines.push(trimmed);
      break;
    }
    if (inToc && trimmed === '') {
      if (tocLines.length > 0) break;
    }
  }

  return tocLines.map(line => line.replace(/\s+\d+$/, '').trim()).filter(Boolean);
}
