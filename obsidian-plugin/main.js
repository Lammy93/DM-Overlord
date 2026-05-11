const { Plugin, Notice, TFile, TFolder } = require('obsidian');

const DEFAULT_SETTINGS = {
  subfolder: 'DM-Overlord',
  autoSync: false,
};

export default class DMOverlordSyncPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'open-dm-overlord-folder',
      name: 'Open DM-Overlord vault folder',
      callback: () => this.openVaultFolder(),
    });

    this.addCommand({
      id: 'create-character-from-template',
      name: 'Create new character from template',
      callback: () => this.createCharacter(),
    });

    this.addCommand({
      id: 'create-session-note',
      name: 'Create new session note',
      callback: () => this.createSessionNote(),
    });

    this.addSettingTab(new DMOverlordSettingTab(this.app, this));

    new Notice('DM Overlord Sync loaded!');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async ensureSubfolder() {
    const folderPath = this.settings.subfolder;
    let folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
      folder = this.app.vault.getAbstractFileByPath(folderPath);
    }
    const subfolders = ['Campaigns', 'Characters', 'Sessions', 'Encounters', 'Locations'];
    for (const sub of subfolders) {
      const subPath = `${folderPath}/${sub}`;
      if (!this.app.vault.getAbstractFileByPath(subPath)) {
        await this.app.vault.createFolder(subPath);
      }
    }
    return folderPath;
  }

  async openVaultFolder() {
    const path = await this.ensureSubfolder();
    new Notice(`DM-Overlord folder is at: ${path}`);
  }

  async createCharacter() {
    const path = await this.ensureSubfolder();
    const template = `# {{name}}
- **Race:** | **Class:** | **Level:** 1
- **Background:** | **Alignment:**
- **Player:**

## Core Stats
| STR | DEX | CON | INT | WIS | CHA |
|:---:|:---:|:---:|:---:|:---:|:---:|
| 10 | 10 | 10 | 10 | 10 | 10 |
| +0 | +0 | +0 | +0 | +0 | +0 |

**HP:** / | **AC:** 10 | **Speed:** 30ft

## Skills
- 

## Features & Traits
- 

## Equipment
- 

## Backstory
`;

    const fileName = `New Character ${Date.now()}.md`;
    const filePath = `${path}/Characters/${fileName}`;
    await this.app.vault.create(filePath, template);
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file) {
      await this.app.workspace.activeLeaf.openFile(file);
      new Notice('Character sheet created!');
    }
  }

  async createSessionNote() {
    const path = await this.ensureSubfolder();
    const date = new Date().toLocaleDateString();
    const template = `# Session : 
**Date:** ${date}
**Campaign:**
**Location:**

## Summary

## Highlights

## Combat Encounters

## Loot & Rewards

## XP Gained:

## Notes
`;

    const fileName = `Session ${date.replace(/\//g, '-')}.md`;
    const filePath = `${path}/Sessions/${fileName}`;
    await this.app.vault.create(filePath, template);
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file) {
      await this.app.workspace.activeLeaf.openFile(file);
      new Notice('Session note created!');
    }
  }
}

class DMOverlordSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'DM Overlord Sync Settings' });

    new Setting(containerEl)
      .setName('Subfolder name')
      .setDesc('Folder name inside your vault where DM-Overlord data is stored')
      .addText(text => text
        .setPlaceholder('DM-Overlord')
        .setValue(this.plugin.settings.subfolder)
        .onChange(async (value) => {
          this.plugin.settings.subfolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Auto-sync')
      .setDesc('Automatically sync new data from the bot (requires bot integration)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSync)
        .onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
        }));
  }
}
