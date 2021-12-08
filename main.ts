import { App, Plugin, PluginSettingTab, Setting, TFile, parseLinktext } from 'obsidian';

interface AttachmentNameFormattingSettings {
	imageFormat: string;
	imageExtenstions: string;
}

const DEFAULT_SETTINGS: AttachmentNameFormattingSettings = {
	imageFormat: "image",
	imageExtenstions: "/(.png|.jpg|.jpeg|.gif|.bmp|.svg)$/",
}

export default class AttachmentNameFormatting extends Plugin {
	settings: AttachmentNameFormattingSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AttachmentNameFormattingSettingTab(this.app, this));

		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => this.handleAttachmentNameFormatting(file)),
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	* Rename the attachments in the active file when it has
	* 
	* @param	{TFile}	file	The active file
	*/
	async handleAttachmentNameFormatting(file: TFile) {
		// If currently opened file is not the same as the one that trigger the event,
		// skip this is to make sure other events don't trigger this plugin
		if (this.app.workspace.getActiveFile() !== file) {
			return;
		}

		// Get the metadata of the active file
		const attachments = this.app.metadataCache.getFileCache(file);
		// Check whether the file has attachments
		if (attachments.hasOwnProperty("embeds")) {
			let num = 1;
			// Filter the specific attachment extension
			for (let item of attachments.embeds.filter(d => d.link.match(new RegExp(this.settings.imageExtenstions)))) {
				// Find the attachment file
				let file_path = parseLinktext(item.link).path;
				let attachmentFile = this.app.vault.getAbstractFileByPath(file_path);
				// let attachmentFile = this.app.vault.getAbstractFileByPath(parseLinktext(item.link).path);
				if (!attachmentFile) {
					attachmentFile = this.app.metadataCache.getFirstLinkpathDest(file_path, file_path);
				}
				// Check if it exists and is of the correct type
				if (attachmentFile instanceof TFile) {
					// Create the new full name with path
					let parent_path = attachmentFile.path.substring(0, attachmentFile.path.length - attachmentFile.name.length);
					// let path = attachmentFile.path.replace(item.link, "");
					let newName = [file.basename, this.settings.imageFormat, num].join(" ") + "." + attachmentFile.extension;
					let fullName = parent_path + newName;
					// Check wether destination is existed
					let destinationFile = this.app.vault.getAbstractFileByPath(fullName);
					if (destinationFile && destinationFile !== attachmentFile) {
						await this.app.fileManager.renameFile(attachmentFile, parent_path + "tmp_" + newName);
					} else {
						await this.app.fileManager.renameFile(attachmentFile, fullName);
					}
					// console.log(uniqueList)
					num++;
				}
			}
		}
	};
}

class AttachmentNameFormattingSettingTab extends PluginSettingTab {
	plugin: AttachmentNameFormatting;

	constructor(app: App, plugin: AttachmentNameFormatting) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Attachment Name Formatting' });
		containerEl.createEl('p', { text: 'This plugin will format all attachments in the format: "filename attachmentType indexNumber.xxx".' });
		containerEl.createEl('p', { text: 'Each type of attachment will have individual index.' });
		containerEl.createEl('p', { text: 'Only recognize the file type that can be recognized by Obsidian.' });
		containerEl.createEl('p', { text: '(Only support image right now)' });

		new Setting(containerEl)
			.setName('Format for image')
			.setDesc(
				'Set the format for image attachment.',
			)
			.addText(text => text
				.setPlaceholder('image')
				.setValue(this.plugin.settings.imageFormat === "image" ? "" : this.plugin.settings.imageFormat)
				.onChange(async (value) => {
					this.plugin.settings.imageFormat = value;
					await this.plugin.saveSettings();
				}));
	}
}
