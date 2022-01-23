import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, parseLinktext } from 'obsidian';

interface AttachmentNameFormattingSettings {
	image: string;
	audio: string;
	video: string;
	pdf: string;
}

interface AttachmentList {
	[key: string]: Array<TAbstractFile>
}

const DEFAULT_SETTINGS: AttachmentNameFormattingSettings = {
	image: "image",
	audio: "audio",
	video: "video",
	pdf: "pdf",
}

const extensions = {
	image: ["png", "jpg", "jpeg", "gif", "bmp", "svg"],
	audio: ["mp3", "wav", "m4a", "ogg", "3gp", "flac"], // "webm"
	video: ["map", "ogv"], // "webm"
	pdf: ["pdf"],
};

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
			// Create a list of attachments, classified by types
			let attachmentList: AttachmentList = {};
			for (let item of attachments.embeds) {
				for (let [fileType, fileExtensions] of Object.entries(extensions)) {
					let attachmentExtension = item.link.split(".").pop();
					if (fileExtensions.contains(attachmentExtension)) {
						if (!attachmentList.hasOwnProperty(fileType)) {
							attachmentList[fileType] = [];
						}
						// Find the attachment file
						let file_path = parseLinktext(item.link).path;
						let attachmentFile = this.app.vault.getAbstractFileByPath(file_path);
						if (!attachmentFile) {
							attachmentFile = this.app.metadataCache.getFirstLinkpathDest(file_path, file_path);
						}
						// Avoid duplication
						if (!attachmentList[fileType].contains(attachmentFile)) {
							attachmentList[fileType].push(attachmentFile);
						}
					}
				}
			}
			// Rename the attachments
			for (let [fileType, attachmentFiles] of Object.entries(attachmentList)) {
				// Check if it exists and is of the correct type
				let num = 1;
				for (let attachmentFile of attachmentFiles) {
					if (attachmentFile instanceof TFile) {
						// Create the new full name with path
						let parent_path = attachmentFile.path.substring(0, attachmentFile.path.length - attachmentFile.name.length);
						let newName = [file.basename, this.settings[fileType], num].join(" ") + "." + attachmentFile.extension;
						let fullName = parent_path + newName;
						// Check wether destination is existed
						let destinationFile = this.app.vault.getAbstractFileByPath(fullName);
						if (destinationFile && destinationFile !== attachmentFile) {
							await this.app.fileManager.renameFile(attachmentFile, parent_path + "tmp_" + newName);
						} else {
							await this.app.fileManager.renameFile(attachmentFile, fullName);
						}
						num++;
					}
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
		containerEl.createEl('p', { text: '(Do not "webm" extension in audio and video right now)' });

		new Setting(containerEl)
			.setName('Format for image')
			.setDesc(
				'Set the format for image attachment.',
			)
			.addText(text => text
				.setPlaceholder('image')
				.setValue(this.plugin.settings.image === "image" ? "" : this.plugin.settings.image)
				.onChange(async (value) => {
					this.plugin.settings.image = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Format for audio')
			.setDesc(
				'Set the format for audio attachment.',
			)
			.addText(text => text
				.setPlaceholder('audio')
				.setValue(this.plugin.settings.audio === "audio" ? "" : this.plugin.settings.audio)
				.onChange(async (value) => {
					this.plugin.settings.audio = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Format for video')
			.setDesc(
				'Set the format for video attachment.',
			)
			.addText(text => text
				.setPlaceholder('video')
				.setValue(this.plugin.settings.video === "video" ? "" : this.plugin.settings.video)
				.onChange(async (value) => {
					this.plugin.settings.video = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Format for pdf')
			.setDesc(
				'Set the format for pdf attachment.',
			)
			.addText(text => text
				.setPlaceholder('pdf')
				.setValue(this.plugin.settings.pdf === "pdf" ? "" : this.plugin.settings.pdf)
				.onChange(async (value) => {
					this.plugin.settings.pdf = value;
					await this.plugin.saveSettings();
				}));
	}
}
