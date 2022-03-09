import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, Notice, parseLinktext, normalizePath, FileSystemAdapter, Modal } from 'obsidian';
const fs = require('fs');
const JSZip = require('jszip');

interface AttachmentNameFormattingSettings {
	image: string;
	audio: string;
	video: string;
	pdf: string;
	exportCurrentDeletion: boolean;
	exportUnusedDeletion: boolean;
}

interface AttachmentList {
	[key: string]: Array<TAbstractFile>
}

interface RibbonList {
	exportCurrentFile: HTMLElement;
	exportUnusesdFile: HTMLElement;
}

const DEFAULT_SETTINGS: AttachmentNameFormattingSettings = {
	image: "image",
	audio: "audio",
	video: "video",
	pdf: "pdf",
	exportCurrentDeletion: false,
	exportUnusedDeletion: false,
}

const extensions = {
	image: ["png", "jpg", "jpeg", "gif", "bmp", "svg"],
	audio: ["mp3", "wav", "m4a", "ogg", "3gp", "flac"], // "webm"
	video: ["map", "ogv"], // "webm"
	pdf: ["pdf"],
};

const ribbons: RibbonList = {
	exportCurrentFile: null,
	exportUnusesdFile: null,
}

export default class AttachmentNameFormatting extends Plugin {
	settings: AttachmentNameFormattingSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AttachmentNameFormattingSettingTab(this.app, this));

		// Export attachments in current file
		ribbons.exportCurrentFile = this.addRibbonIcon('sheets-in-box', 'Export Attachments', () => this.handleAttachmentExport());
		ribbons.exportCurrentFile.hidden = true;

		this.addCommand({
			id: 'export-attachments-command',
			name: 'Export Attachments in Current File',
			callback: () => this.handleAttachmentExport()
		});

		// Export unused attachments in all files
		ribbons.exportUnusesdFile = this.addRibbonIcon('documents', 'Export Unused Attachments', () => this.handleUnusedAttachmentExport());
		ribbons.exportUnusesdFile.hidden = true;

		this.addCommand({
			id: 'export-unused-attachments-command',
			name: 'Export All Unused Attachments in the Vault',
			callback: () => this.handleUnusedAttachmentExport()
		});

		// Format the attachments' name
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

	/*
	* Export the attachments in the active file when it has
	*/
	async handleAttachmentExport() {
		// Create new JSZip instance
		let zip = new JSZip();

		// Get the active file
		let file = this.app.workspace.getActiveFile()
		const attachments = this.app.metadataCache.getFileCache(file);
		if (attachments.hasOwnProperty("embeds")) {
			for (let item of attachments.embeds) {
				for (let [fileType, fileExtensions] of Object.entries(extensions)) {
					let attachmentExtension = item.link.split(".").pop();
					if (fileExtensions.contains(attachmentExtension)) {
						let file_path = normalizePath(this.app.vault.adapter.basePath + '\\' + parseLinktext(item.link).path);
						// Get the attachment and write into JSZip instance
						await FileSystemAdapter.readLocalFile(file_path)
							.then(data => zip.file(normalizePath(fileType + '\\' + item.link), data))
					}
				}
			}

			// Save zip file to the root folder
			zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
				.pipe(fs.createWriteStream(normalizePath(this.app.vault.adapter.basePath + '/' + file.basename + '_Attachments.zip')))
				.on('finish', function () {
					// Send the finish message
					new Notice(file.basename + ' attachments exported.');
				});

			let content = '';
			await this.app.vault.cachedRead(file).then(data => content = data);

			if (this.settings.exportCurrentDeletion) {
				for (let item of attachments.embeds) {
					let file_path = parseLinktext(item.link).path;
					let attachmentFile = this.app.vault.getAbstractFileByPath(file_path);
					if (!attachmentFile) {
						attachmentFile = this.app.metadataCache.getFirstLinkpathDest(file_path, file_path);
					}
					content = content.replace(item.original, '');
					await this.app.vault.delete(attachmentFile);
				}
				await this.app.vault.modify(file, content);
			}
		}
	};

	/*
	* Export the unused attachments in all files
	*/
	async handleUnusedAttachmentExport() {
		let files = this.app.vault.getFiles();
		let mdFiles = this.app.vault.getMarkdownFiles();
		let attachmentFiles = files.filter(file => !mdFiles.contains(file));
		// Get all extensions
		let allExtensions = Object.values(extensions).flat();
		allExtensions.push('webm');
		attachmentFiles = attachmentFiles.filter(file => allExtensions.contains(file.extension));

		// Get all Unused attachments
		for (let mdfile of mdFiles) {
			let attachments = this.app.metadataCache.getFileCache(mdfile);
			if (attachments.hasOwnProperty("embeds")) {
				for (let item of attachments.embeds) {
					let file_path = parseLinktext(item.link).path;
					let attachmentFile = this.app.metadataCache.getFirstLinkpathDest(file_path, file_path);
					if (attachmentFiles.contains(attachmentFile)) {
						attachmentFiles.remove(attachmentFile);
					}
				}
			}
		}

		// Create new JSZip instance and write the unused attachments
		let zip = new JSZip();
		for (let file of attachmentFiles) {
			let file_path = normalizePath(this.app.vault.adapter.basePath + '\\' + parseLinktext(file.path).path);
			await FileSystemAdapter.readLocalFile(file_path)
				.then(data => zip.file(normalizePath(file.name), data))
		}

		// Save zip file to the root folder
		zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
			.pipe(fs.createWriteStream(normalizePath(this.app.vault.adapter.basePath + '/Unused_Attachments.zip')))
			.on('finish', function () {
				// Send the finish message
				new Notice('Unused attachments exported.');
			});

		if (this.settings.exportCurrentDeletion) {
			for (let file of attachmentFiles) {
				await this.app.vault.delete(file);
			}
		}
	}
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

		containerEl.createEl('h1', { text: 'Attachment Name Formatting' });
		containerEl.createEl('p', { text: 'This plugin will format all attachments in the format: "filename attachmentType indexNumber.xxx".' });
		containerEl.createEl('p', { text: 'Each type of attachment will have individual index.' });
		containerEl.createEl('p', { text: 'Only recognize the file type that can be recognized by Obsidian.' });
		containerEl.createEl('p', { text: '(Do not have "webm" extension in audio and video right now)' });
		containerEl.createEl('h2', { text: 'Attachments Format Setting' });

		new Setting(containerEl)
			.setName('Format for image')
			.setDesc(
				'Set the format for image attachment.'
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
				'Set the format for audio attachment.'
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
				'Set the format for video attachment.'
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
				'Set the format for pdf attachment.'
			)
			.addText(text => text
				.setPlaceholder('pdf')
				.setValue(this.plugin.settings.pdf === "pdf" ? "" : this.plugin.settings.pdf)
				.onChange(async (value) => {
					this.plugin.settings.pdf = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h2', { text: 'Ribbons Setting (Left Sidebar)' });

		new Setting(containerEl)
			.setName('Export Attachments in Current File')
			.setDesc(
				'Toggle the display of export attachments in current file ribbon.'
			)
			.addToggle(toggle => toggle
				.onChange(async (value) => {
					ribbons.exportCurrentFile.hidden = !value;
				})
			)

		new Setting(containerEl)
			.setName('Deletion After Exporting Attachments in Current File')
			.setDesc(
				'Autodeletion after exporting attachments in current file.'
			)
			.addToggle(toggle => toggle
				.onChange(async (value) => {
					this.plugin.settings.exportCurrentDeletion = value;
					if (value) {
						new WarningModal(this.app).open();
					}
					await this.plugin.saveSettings();
				})
			)


		new Setting(containerEl)
			.setName('Export Unused Attachments in Vault')
			.setDesc(
				'Toggle the display of export unused attachments ribbon. Will take long time for a large vault.'
			)
			.addToggle(toggle => toggle
				.onChange(async (value) => {
					ribbons.exportUnusesdFile.hidden = !value;
				})
			)

		new Setting(containerEl)
			.setName('Deletion After Exporting Unused Attachments in Vault')
			.setDesc(
				'Autodeletion after exporting unused attachments in vault.'
			)
			.addToggle(toggle => toggle
				.onChange(async (value) => {
					this.plugin.settings.exportUnusedDeletion = value;
					if (value) {
						new WarningModal(this.app).open();
					}
					await this.plugin.saveSettings();
				})
			)

	}
}

class WarningModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Will delete the attachments and content after export!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}