import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromPdf, chunkText, extractTableOfContents } from '../services/pdfParser.js';
import { parseCampaignText, refineWithAI } from '../services/aiParser.js';
import { saveSourceDocument, getDocument, listDocuments, searchDocuments, deleteDocument, convertDocumentToModule } from '../services/sourceDocs.js';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embeds.js';
import { getCampaign } from '../services/campaign.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOAD_DIR = join(__dirname, '..', '..', 'data', 'uploads');

export default {
  data: new SlashCommandBuilder()
    .setName('import')
    .setDescription('Import campaign content from PDF or text')
    .addSubcommand(sub =>
      sub.setName('pdf')
        .setDescription('Import a PDF campaign book (max 10 MB via Discord)')
        .addAttachmentOption(opt =>
          opt.setName('file').setDescription('PDF file to import').setRequired(true))
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID to link this source to').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('url')
        .setDescription('Import a PDF from a direct download URL (bypasses Discord 10 MB limit)')
        .addStringOption(opt =>
          opt.setName('url').setDescription('Direct download URL to the PDF file').setRequired(true))
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID to link this source to').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List imported source documents'))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View details of an imported document')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Document ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete an imported document')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Document ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('convert')
        .setDescription('Convert a parsed document into an adventure module')
        .addStringOption(opt =>
          opt.setName('document-id').setDescription('Source document ID').setRequired(true))
        .addStringOption(opt =>
          opt.setName('campaign-id').setDescription('Campaign ID to attach the module to').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'pdf') {
      await interaction.deferReply();

      const file = interaction.options.getAttachment('file');
      const campaignId = interaction.options.getString('campaign-id')
        ? parseInt(interaction.options.getString('campaign-id')) : null;

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        return interaction.editReply({ embeds: [errorEmbed('Invalid File', 'Only PDF files are accepted.')] });
      }

      if (!existsSync(UPLOAD_DIR)) {
        mkdirSync(UPLOAD_DIR, { recursive: true });
      }

      const filePath = join(UPLOAD_DIR, `import_${Date.now()}_${file.name}`);
      const parsed = { title: file.name.replace('.pdf', ''), chapters: [], npcs: [], locations: [], monsters: [], items: [] };

      try {
        await interaction.editReply({ embeds: [infoEmbed('Downloading...', 'Fetching your PDF file...')] });

        const response = await fetch(file.url);
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(filePath, buffer);

        await interaction.editReply({ embeds: [infoEmbed('Extracting Text...', 'Reading PDF content... This may take a minute for large books.')] });

        const pdfData = await extractTextFromPdf(filePath);
        parsed.title = pdfData.title;

        const toc = extractTableOfContents(pdfData.text);
        const progressEmbed = infoEmbed('Parsing with AI...',
          `Extracted ${pdfData.pages} pages, ${pdfData.text.length} characters.\n` +
          `Sending to AI for structural analysis...\n` +
          (toc.length > 0 ? `Detected ${toc.length} chapters in table of contents.` : '')
        );
        await interaction.editReply({ embeds: [progressEmbed] });

        const aiResult = await parseCampaignText(pdfData.text, parsed.title);

        parsed.title = aiResult.title || parsed.title;
        parsed.summary = aiResult.summary || '';
        parsed.chapters = aiResult.chapters || [];
        parsed.npcs = aiResult.npcs || [];
        parsed.locations = aiResult.locations || [];
        parsed.monsters = aiResult.monsters || [];
        parsed.items = aiResult.items || [];

        const doc = saveSourceDocument({
          campaignId,
          title: parsed.title,
          author: pdfData.metadata?.author || null,
          sourceType: 'pdf',
          rawText: pdfData.text.slice(0, 50000),
          chapters: parsed.chapters,
          npcs: parsed.npcs,
          locations: parsed.locations,
          encounters: [],
          items: parsed.items,
          monsters: parsed.monsters,
          summary: parsed.summary,
        });

        const embed = successEmbed('Campaign Imported!',
          `**${doc.title}** has been parsed and stored.`
        );
        embed.addFields(
          { name: 'Document ID', value: `\`${doc.id}\``, inline: true },
          { name: 'Pages', value: `${pdfData.pages}`, inline: true },
          { name: 'Chapters', value: `${parsed.chapters.length}`, inline: true },
          { name: 'NPCs', value: `${parsed.npcs.length}`, inline: true },
          { name: 'Locations', value: `${parsed.locations.length}`, inline: true },
          { name: 'Monsters', value: `${parsed.monsters.length}`, inline: true },
          { name: 'Items', value: `${parsed.items.length}`, inline: true },
          { name: 'Next Step', value: 'Use `/import convert` to turn this into a playable adventure module.', inline: false },
        );
        await interaction.editReply({ embeds: [embed] });

      } catch (err) {
        await interaction.editReply({
          embeds: [errorEmbed('Import Failed', `Error: ${err.message}`)],
        });
      } finally {
        if (existsSync(filePath)) unlinkSync(filePath);
      }
      return;
    }

    if (sub === 'url') {
      await interaction.deferReply();

      let url = interaction.options.getString('url');
      const campaignId = interaction.options.getString('campaign-id')
        ? parseInt(interaction.options.getString('campaign-id')) : null;

      url = resolveDownloadUrl(url);

      if (!url.toLowerCase().match(/\.pdf($|\?|#)/) && !url.toLowerCase().includes('pdf')) {
        return interaction.editReply({ embeds: [errorEmbed('Invalid URL', 'URL must point to a PDF file.')] });
      }

      if (!existsSync(UPLOAD_DIR)) {
        mkdirSync(UPLOAD_DIR, { recursive: true });
      }

      const filename = url.split('/').pop()?.split('?')[0] || `import_${Date.now()}.pdf`;
      const filePath = join(UPLOAD_DIR, `url_${Date.now()}_${filename}`);
      const parsed = { title: filename.replace('.pdf', ''), chapters: [], npcs: [], locations: [], monsters: [], items: [] };

      try {
        await interaction.editReply({ embeds: [infoEmbed('Downloading...', `Fetching PDF from URL...\n${url}`)] });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);
        const response = await fetch(url, {
          headers: { 'User-Agent': 'DM-Overlord/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
          throw new Error(`Download failed with HTTP ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(filePath, buffer);

        const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
        await interaction.editReply({ embeds: [infoEmbed('Extracting Text...', `Downloaded ${fileSizeMB} MB. Reading PDF content... This may take a minute for large books.`)] });

        const pdfData = await extractTextFromPdf(filePath);
        parsed.title = pdfData.title || parsed.title;

        const toc = extractTableOfContents(pdfData.text);
        const progressEmbed = infoEmbed('Parsing with AI...',
          `Extracted ${pdfData.pages} pages, ${pdfData.text.length} characters.\n` +
          `Sending to AI for structural analysis...\n` +
          (toc.length > 0 ? `Detected ${toc.length} chapters in table of contents.` : '')
        );
        await interaction.editReply({ embeds: [progressEmbed] });

        const aiResult = await parseCampaignText(pdfData.text, parsed.title);

        parsed.title = aiResult.title || parsed.title;
        parsed.summary = aiResult.summary || '';
        parsed.chapters = aiResult.chapters || [];
        parsed.npcs = aiResult.npcs || [];
        parsed.locations = aiResult.locations || [];
        parsed.monsters = aiResult.monsters || [];
        parsed.items = aiResult.items || [];

        const doc = saveSourceDocument({
          campaignId,
          title: parsed.title,
          author: pdfData.metadata?.author || null,
          sourceType: 'pdf',
          rawText: pdfData.text.slice(0, 50000),
          chapters: parsed.chapters,
          npcs: parsed.npcs,
          locations: parsed.locations,
          encounters: [],
          items: parsed.items,
          monsters: parsed.monsters,
          summary: parsed.summary,
        });

        const embed = successEmbed('Campaign Imported from URL!',
          `**${doc.title}** has been parsed and stored.`
        );
        embed.addFields(
          { name: 'Document ID', value: `\`${doc.id}\``, inline: true },
          { name: 'Pages', value: `${pdfData.pages}`, inline: true },
          { name: 'Chapters', value: `${parsed.chapters.length}`, inline: true },
          { name: 'NPCs', value: `${parsed.npcs.length}`, inline: true },
          { name: 'Locations', value: `${parsed.locations.length}`, inline: true },
          { name: 'Monsters', value: `${parsed.monsters.length}`, inline: true },
          { name: 'Items', value: `${parsed.items.length}`, inline: true },
          { name: 'Next Step', value: 'Use `/import convert` to turn this into a playable adventure module.', inline: false },
        );
        await interaction.editReply({ embeds: [embed] });

      } catch (err) {
        await interaction.editReply({
          embeds: [errorEmbed('Import Failed', `Error: ${err.message}`)],
        });
      } finally {
        if (existsSync(filePath)) unlinkSync(filePath);
      }
      return;
    }

    if (sub === 'list') {
      const docs = listDocuments(null);
      if (docs.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('No Documents', 'No imported documents yet. Use `/import pdf` to import a campaign book.')], ephemeral: true });
      }
      const list = docs.map(d =>
        `**${d.title}** (ID: \`${d.id}\`) — ${d.source_type} — ${d.chapters?.length || 0} chapters — ${new Date(d.created_at).toLocaleDateString()}`
      ).join('\n');
      return interaction.reply({ embeds: [infoEmbed('Imported Documents', list)] });
    }

    if (sub === 'view') {
      const id = parseInt(interaction.options.getString('id'));
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
      const doc = getDocument(id);
      if (!doc) return interaction.reply({ embeds: [errorEmbed('Not Found', 'Document not found.')], ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(doc.title)
        .setColor(Colors.Gold)
        .setDescription(doc.summary || 'No summary')
        .addFields(
          { name: 'ID', value: `\`${doc.id}\``, inline: true },
          { name: 'Type', value: doc.source_type, inline: true },
          { name: 'Chapters', value: `${doc.chapters?.length || 0}`, inline: true },
          { name: 'NPCs', value: `${doc.npcs?.length || 0}`, inline: true },
          { name: 'Locations', value: `${doc.locations?.length || 0}`, inline: true },
          { name: 'Monsters', value: `${doc.monsters?.length || 0}`, inline: true },
        );

      if (doc.chapters?.length > 0) {
        const chapterList = doc.chapters.slice(0, 10).map(c =>
          `${c.chapter_number ? `**${c.chapter_number}.** ` : ''}${c.title}${c.scenes?.length > 0 ? ` (${c.scenes.length} scenes)` : ''}`
        ).join('\n');
        embed.addFields({ name: 'Chapters', value: chapterList + (doc.chapters.length > 10 ? `\n*+${doc.chapters.length - 10} more*` : ''), inline: false });
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'delete') {
      const id = parseInt(interaction.options.getString('id'));
      if (isNaN(id)) return interaction.reply({ embeds: [errorEmbed('Invalid ID')], ephemeral: true });
      const doc = getDocument(id);
      if (!doc) return interaction.reply({ embeds: [errorEmbed('Not Found')], ephemeral: true });
      deleteDocument(id);
      return interaction.reply({ embeds: [successEmbed('Deleted', `**${doc.title}** removed.`)] });
    }

    if (sub === 'convert') {
      await interaction.deferReply();

      const docId = parseInt(interaction.options.getString('document-id'));
      const campaignId = parseInt(interaction.options.getString('campaign-id'));

      if (isNaN(docId) || isNaN(campaignId)) {
        return interaction.editReply({ embeds: [errorEmbed('Invalid ID', 'Both document ID and campaign ID are required.')] });
      }

      const campaign = getCampaign(campaignId);
      if (!campaign) {
        return interaction.editReply({ embeds: [errorEmbed('Not Found', 'Campaign not found.')] });
      }

      const doc = getDocument(docId);
      if (!doc) {
        return interaction.editReply({ embeds: [errorEmbed('Not Found', 'Source document not found.')] });
      }

      try {
        const module = await convertDocumentToModule(docId, campaignId, interaction.user.id);

        if (!module) {
          return interaction.editReply({ embeds: [errorEmbed('Convert Failed', 'Could not convert document to module.')] });
        }

        const embed = successEmbed('Adventure Module Created!',
          `**${module.title}** is now ready for **${campaign.name}**`
        );
        embed.addFields(
          { name: 'Module ID', value: `\`${module.id}\``, inline: true },
          { name: 'Scenes', value: `${module.scenes?.length || 0}`, inline: true },
          { name: 'Next Step', value: 'Use `/adventure start` to begin running this adventure!', inline: false },
        );
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed('Convert Failed', err.message)] });
      }
    }
  },
};

function resolveDownloadUrl(url) {
  const trimmed = url.trim();

  // Google Drive: /file/d/ID/view -> uc?export=download&id=ID
  const gDriveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/?#&]+)/);
  if (gDriveMatch) {
    return `https://drive.google.com/uc?export=download&id=${gDriveMatch[1]}`;
  }

  // Google Drive: open?id=ID
  const gDriveIdMatch = trimmed.match(/drive\.google\.com\/open\?id=([^/?#&]+)/);
  if (gDriveIdMatch) {
    return `https://drive.google.com/uc?export=download&id=${gDriveIdMatch[1]}`;
  }

  // Dropbox: ensure ?dl=1 for direct download
  if (trimmed.includes('dropbox.com')) {
    const u = new URL(trimmed);
    u.searchParams.set('dl', '1');
    return u.toString();
  }

  // MediaFire: direct download
  if (trimmed.includes('mediafire.com')) {
    return trimmed;
  }

  return trimmed;
}
