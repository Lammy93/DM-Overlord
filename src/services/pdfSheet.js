import PDFDocument from 'pdfkit';
import { getCharacter } from './character.js';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SKILL_LIST = [
  { name: 'Acrobatics', stat: 'dex' },
  { name: 'Animal Handling', stat: 'wis' },
  { name: 'Arcana', stat: 'int' },
  { name: 'Athletics', stat: 'str' },
  { name: 'Deception', stat: 'cha' },
  { name: 'History', stat: 'int' },
  { name: 'Insight', stat: 'wis' },
  { name: 'Intimidation', stat: 'cha' },
  { name: 'Investigation', stat: 'int' },
  { name: 'Medicine', stat: 'wis' },
  { name: 'Nature', stat: 'int' },
  { name: 'Perception', stat: 'wis' },
  { name: 'Performance', stat: 'cha' },
  { name: 'Persuasion', stat: 'cha' },
  { name: 'Religion', stat: 'int' },
  { name: 'Sleight of Hand', stat: 'dex' },
  { name: 'Stealth', stat: 'dex' },
  { name: 'Survival', stat: 'wis' },
];

const SPELLCASTER_CLASSES = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'];
const HALF_CASTER = ['Paladin', 'Ranger'];

function mod(score) { return Math.floor((score - 10) / 2); }
function modStr(score) { const m = mod(score); return m >= 0 ? `+${m}` : `${m}`; }
function profBonus(level) { return Math.ceil(1 + level / 4); }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function spellSlots(level, className) {
  const slots = {
    1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
    3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
    4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
    5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
    7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
    8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
    9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
    10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
    11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
    18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
    20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
  };
  if (className === 'Warlock') {
    const pact = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 3, 17: 4, 18: 4, 19: 4, 20: 4 };
    const lvl = Math.min(level, 20);
    return [pact[lvl] || 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }
  if (HALF_CASTER.includes(className)) {
    const half = Math.ceil(level / 2);
    return slots[half] || [0, 0, 0, 0, 0, 0, 0, 0, 0];
  }
  return slots[Math.min(level, 20)] || [0, 0, 0, 0, 0, 0, 0, 0, 0];
}

function spellsKnown(level, className) {
  const table = {
    Bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 24],
    Cleric: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Druid: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Paladin: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Ranger: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
    Warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
    Wizard: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
  const idx = Math.min(level - 1, 19);
  return (table[className] || [])[idx] || null;
}

export function generateCharacterSheet(characterId) {
  const character = getCharacter(characterId);
  if (!character) return null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 36, bottom: 36, left: 36, right: 36 },
      info: { Title: `${character.name} - D&D Character Sheet`, Author: 'DM-Overlord' },
    });

    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = doc.page.margins.left;
    const pageW = doc.page.width - L - doc.page.margins.right;
    let T = doc.page.margins.top;

    const stats = typeof character.stats === 'object' ? character.stats : {};
    const profs = Array.isArray(character.proficiencies) ? character.proficiencies : [];
    const features = Array.isArray(character.features) ? character.features.map(f => typeof f === 'string' ? f : f.name || f) : [];
    const inv = Array.isArray(character.inventory) ? character.inventory : [];
    const skills = typeof character.skills === 'object' ? character.skills : {};
    const spells = character.spells && typeof character.spells === 'object' ? character.spells : {};
    const pb = profBonus(character.level || 1);
    const className = character.class || '';
    const isCaster = SPELLCASTER_CLASSES.includes(className);

    // === COLORS ===
    const C = {
      header: '#1a1a2e',
      accent: '#c0392b',
      light: '#f8f9fa',
      border: '#d5d5d5',
      text: '#2c2c2c',
      muted: '#7f8c8d',
      gold: '#d4a017',
      white: '#ffffff',
    };

    function sectionHeader(x, y, w, text) {
      doc.rect(x, y, w, 20).fill(C.header);
      doc.fillColor(C.gold).fontSize(8).font('Helvetica-Bold');
      doc.text(text.toUpperCase(), x + 6, y + 5, { width: w - 12 });
      return y + 24;
    }

    function labeledField(x, y, w, h, label, value, opts = {}) {
      const bg = opts.bg || C.light;
      doc.rect(x, y, w, h).fill(bg).stroke(C.border);
      doc.fillColor(C.muted).fontSize(6).font('Helvetica-Bold');
      doc.text(label.toUpperCase(), x + 4, y + 2, { width: w - 8 });
      doc.fillColor(C.text).fontSize(opts.valSize || 12).font(opts.valFont || 'Helvetica-Bold');
      doc.text(`${value ?? '?'}`, x + 4, y + (opts.valTop || 13), { width: w - 8 });
    }

    // ============ TOP BAR ============
    const barH = 64;
    doc.rect(L, T, pageW, barH).fill(C.header);

    // Character name
    doc.fillColor(C.white).fontSize(22).font('Helvetica-Bold');
    doc.text(character.name || 'Unknown', L + 14, T + 6, { width: pageW - 90 });

    // Class / Race / Level
    doc.fontSize(10).font('Helvetica');
    doc.fillColor('#b0b0b0');
    const levelLine = `${className ? `Level ${character.level || 1} ${className}` : ''}${character.race ? `  |  ${character.race}` : ''}`;
    doc.text(levelLine, L + 14, T + 32, { width: pageW - 90 });

    // Details line
    const det = [character.background, character.alignment].filter(Boolean).join('  |  ');
    if (det) {
      doc.fontSize(7).fillColor('#888888');
      doc.text(det, L + 14, T + 46, { width: pageW - 90 });
    }

    // Portrait
    if (character.image_url) {
      try { doc.image(character.image_url, L + pageW - 76, T + 4, { width: 56, height: 56 }); } catch {}
    }

    T += barH + 10;

    // ============ THREE COLUMNS ============
    const gap = 12;
    const c1w = 104;
    const c2w = pageW - c1w - gap;
    const c1x = L;
    const c2x = L + c1w + gap;

    // ===== COLUMN 1: ABILITY SCORES =====
    let y1 = sectionHeader(c1x, T, c1w, 'Ability Scores');

    for (const ab of ABILITIES) {
      const val = stats[ab] || 10;
      const svMod = mod(val);
      const svProf = profs.some(p => p.toLowerCase().includes(ab) || p.toLowerCase().includes(`saving throw: ${ab}`) || p.toLowerCase().includes(`${ab} save`));

      const by = y1;

      // Main box
      doc.rect(c1x, by, c1w, 44).fill(C.light).stroke(C.border);

      // Ability name
      doc.fillColor(C.text).fontSize(7).font('Helvetica-Bold');
      doc.text(ab.toUpperCase(), c1x + 4, by + 2, { width: c1w - 8 });

      // Large score in center
      doc.fontSize(16).font('Helvetica-Bold');
      doc.text(`${val}`, c1x + 4, by + 10, { width: c1w - 52, align: 'center' });

      // Modifier circle
      doc.circle(c1x + c1w - 27, by + 22, 12).fill(C.white).stroke(C.border);
      doc.fillColor(C.accent).fontSize(13).font('Helvetica-Bold');
      doc.text(modStr(val), c1x + c1w - 35, by + 16, { width: 16, align: 'center' });

      // Saving throw
      const svTotal = svMod + (svProf ? pb : 0);
      const svStr = `${svTotal >= 0 ? '+' : ''}${svTotal}`;
      doc.fillColor(C.muted).fontSize(6).font('Helvetica');

      const profDot = svProf ? '●' : '○';
      doc.text(`${profDot} ${svStr}`, c1x + 4, by + 33, { width: 50 });

      y1 += 48;
    }

    // Passive Perception
    const ppScore = 10 + mod(stats.wis || 10) + (profs.includes('Perception') ? pb : 0);
    labeledField(c1x, y1 + 2, c1w, 28, 'Passive Perception', ppScore);
    y1 += 34;

    // Proficiency Bonus
    labeledField(c1x, y1 + 2, c1w, 28, 'Proficiency Bonus', `+${pb}`, { valSize: 14 });
    y1 += 34;

    // Inspiration
    labeledField(c1x, y1 + 2, c1w, 28, 'Inspiration', character.inspiration ? '●' : '○', { valSize: 16 });

    // ===== COLUMN 2: COMBAT + SKILLS + FEATURES =====
    let y2 = T;

    // Combat stats row
    const combatBoxes = [
      { label: 'Armor Class', val: character.armor_class || '?', w: 70 },
      { label: 'Initiative', val: `${character.initiative_bonus >= 0 ? '+' : ''}${character.initiative_bonus || modStr(stats.dex || 10)}`, w: 60 },
      { label: 'Speed', val: character.speed ? `${character.speed}ft` : '?', w: 55 },
    ];

    let cx = c2x;
    for (const box of combatBoxes) {
      labeledField(cx, y2, box.w, 44, box.label, box.val, { valSize: 14 });
      cx += box.w + 4;
    }
    y2 += 48;

    // HP section
    labeledField(c2x, y2, pageW - c1w - gap, 36, 'Hit Points', `${character.hp_current ?? '?'} / ${character.hp_max ?? '?'}`, { valSize: 16, valTop: 14 });
    y2 += 40;

    // Temp HP row
    const hpHalf = (pageW - c1w - gap - 4) / 2;
    labeledField(c2x, y2, hpHalf, 28, 'Temp HP', character.hp_temp || '0');
    labeledField(c2x + hpHalf + 4, y2, hpHalf, 28, 'Hit Dice', `d6`);
    y2 += 32;

    // XP
    labeledField(c2x, y2, pageW - c1w - gap, 24, 'Experience Points', `${character.experience || 0} XP`, { valSize: 10, valTop: 11 });
    y2 += 30;

    // Skills section
    y2 = sectionHeader(c2x, y2, pageW - c1w - gap, 'Skills') + 2;

    const skillsPerCol = Math.ceil(SKILL_LIST.length / 2);
    let skillY1 = y2;
    let skillY2 = y2;

    for (let i = 0; i < SKILL_LIST.length; i++) {
      const skill = SKILL_LIST[i];
      const isRight = i >= skillsPerCol;
      const sx = isRight ? c2x + (pageW - c1w - gap) / 2 + 2 : c2x;
      const sy = isRight ? skillY2 : skillY1;
      const sw = (pageW - c1w - gap) / 2 - 2;

      const statVal = stats[skill.stat] || 10;
      const isProf = skills[skill.name.toLowerCase()] || profs.includes(skill.name) || profs.includes(skill.name.toLowerCase());
      const bonus = mod(statVal) + (isProf ? pb : 0);
      const bonStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;

      doc.rect(sx, sy, sw, 15.5).fill(C.light).stroke(C.border);

      const dotX = sx + 6;
      const dotY = sy + 7.5;
      doc.circle(dotX, dotY, 3.5);
      if (isProf) doc.fill(C.accent); else doc.fill(C.white).stroke(C.border);

      doc.fillColor(C.text).fontSize(6.5).font(isProf ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(skill.name, sx + 14, sy + 3.5, { width: sw - 38 });
      doc.fontSize(8).font('Helvetica-Bold').fillColor(bonus >= 0 ? C.text : C.accent);
      doc.text(bonStr, sx + sw - 22, sy + 3, { width: 20, align: 'right' });

      if (isRight) skillY2 += 16; else skillY1 += 16;
    }

    const skillsBottom = Math.max(skillY1, skillY2);

    // Features & Traits section
    const featTop = Math.max(skillsBottom + 8, y2 + SKILL_LIST.length / 2 * 16 + 30);
    y2 = featTop;
    y2 = sectionHeader(c2x, y2, pageW - c1w - gap, 'Features & Traits');

    const halfFeatW = (pageW - c1w - gap - 4) / 2;

    // Left: features
    let featY = y2;
    if (features.length > 0) {
      doc.fontSize(7).font('Helvetica').fillColor(C.text);
      doc.text(features.map(f => `• ${f}`).join('\n'), c2x + 2, featY, { width: halfFeatW, lineGap: 2 });
    } else {
      doc.fontSize(7).font('Helvetica').fillColor(C.muted);
      doc.text('None', c2x + 2, featY, { width: halfFeatW });
    }

    // Right: personality traits
    const traits = [
      character.personalityTraits ? `Personality: ${character.personalityTraits}` : null,
      character.ideals ? `Ideals: ${character.ideals}` : null,
      character.bonds ? `Bonds: ${character.bonds}` : null,
      character.flaws ? `Flaws: ${character.flaws}` : null,
    ].filter(Boolean);
    doc.fontSize(7).font('Helvetica').fillColor(C.text);
    doc.text(traits.join('\n\n'), c2x + halfFeatW + 6, featY, { width: halfFeatW, lineGap: 1 });

    // ===== SPELLCASTING (if applicable) =====
    if (isCaster) {
      const casterTop = Math.max(y2 + 70, featY + (features.length > 0 ? features.length * 12 : 20));
      let sy3 = casterTop;
      sy3 = sectionHeader(c2x, sy3, pageW - c1w - gap, 'Spellcasting');

      const slots = spellSlots(character.level || 1, className);
      const known = spellsKnown(character.level || 1, className);

      // Spell slots row
      const slotLabels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
      const activeSlots = slots.filter(s => s > 0);
      if (activeSlots.length > 0) {
        const slotW = (pageW - c1w - gap - (activeSlots.length - 1) * 2) / activeSlots.length;
        let sx = c2x;
        for (let i = 0; i < activeSlots.length; i++) {
          labeledField(sx, sy3, slotW, 26, `${slotLabels[i]} (${activeSlots[i]})`, activeSlots[i], { valSize: 10, valTop: 12 });
          sx += slotW + 2;
        }
        sy3 += 30;
      }

      // Spells known
      if (known !== null) {
        labeledField(c2x, sy3, 80, 24, 'Spells Known', known, { valSize: 10, valTop: 11 });
        sy3 += 28;
      }

      // Spell list
      const spellEntries = Object.entries(spells);
      if (spellEntries.length > 0) {
        const spellText = spellEntries.map(([k, v]) => {
          const val = Array.isArray(v) ? v.join(', ') : v;
          return `${cap(k)}: ${val}`;
        }).join('\n');
        doc.fontSize(7).font('Helvetica').fillColor(C.text);
        doc.text(spellText, c2x + 2, sy3, { width: pageW - c1w - gap - 4, lineGap: 2 });
      }
    }

    // ===== INVENTORY =====
    const invTop = Math.max(
      y1 + 8,
      isCaster ? 0 : skillsBottom + 8,
      doc.y
    );
    let iy = sectionHeader(c1x, Math.max(invTop, T + 300), c1w, 'Inventory');

    if (inv.length > 0) {
      const invText = inv.map(i => {
        if (typeof i === 'string') return `• ${i}`;
        return `• ${i.name || i.item || 'Unknown'}${i.quantity ? ` (x${i.quantity})` : ''}`;
      }).join('\n');
      doc.fontSize(7).font('Helvetica').fillColor(C.text);
      doc.text(invText, c1x + 2, iy, { width: c1w - 4, lineGap: 2 });
      iy += inv.length * 10 + 10;
    } else {
      doc.fontSize(7).font('Helvetica').fillColor(C.muted);
      doc.text('No items', c1x + 2, iy, { width: c1w - 4 });
      iy += 16;
    }

    // Currency
    const currency = [
      character.platinum ? `${character.platinum} pp` : null,
      character.gold ? `${character.gold} gp` : null,
      character.electrum ? `${character.electrum} ep` : null,
      character.silver ? `${character.silver} sp` : null,
      character.copper ? `${character.copper} cp` : null,
    ].filter(Boolean).join('  ');
    if (currency) {
      doc.fontSize(7).font('Helvetica-Bold').fillColor(C.text);
      doc.text(currency, c1x + 2, iy, { width: c1w - 4 });
    }

    doc.end();
  });
}
