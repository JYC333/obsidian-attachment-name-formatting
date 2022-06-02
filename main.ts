import { App, Plugin, PluginSettingTab, Setting, TFile, TAbstractFile, Notice, parseLinktext, normalizePath, FileSystemAdapter, Modal, Menu, Editor } from 'obsidian';
const fs = require('fs');
const JSZip = require('jszip');

var timeInterval = Date.now();

interface AttachmentNameFormattingSettings {
	image: string;
	audio: string;
	video: string;
	pdf: string;
	exportCurrentDeletion: boolean;
	exportUnusedDeletion: boolean;
	copyPath: boolean;
	copyPathMode: string;
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
	copyPath: false,
	copyPathMode: "Relative",
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

		// Format the attachments' name
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => this.handleAttachmentNameFormatting(file)),
		);

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

		// Resacn the attachments command
		this.addCommand({
			id: 'attachments-rescan-command',
			name: 'Rescan Attachments in Current File',
			callback: () => {
				let file = this.app.workspace.getActiveFile();
				this.handleAttachmentNameFormatting(file);
			}
		});

		// Copy the attachment's relative/absolute path
		this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => this.handleCopyAttachmentPath(menu, editor)));
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
		if (this.app.workspace.getActiveFile() !== file || Date.now() - timeInterval < 2000) {
			return;
		}
		timeInterval = Date.now();

		console.log("Formatting attachments...");

		// Get the metadata of the active file
		const attachments = this.app.metadataCache.getFileCache(file);
		// Check whether the file has attachments
		console.log("Getting attachments list...");
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
			console.log("Attachment list:", attachmentList);
			// Rename the attachments
			console.log("Renaming attachments...");
			for (let [fileType, attachmentFiles] of Object.entries(attachmentList)) {
				let num = 1;
				for (let attachmentFile of attachmentFiles) {
					// Check if it exists and is of the correct type
					if (attachmentFile instanceof TFile) {
						// Create the new full name with path
						let parent_path = attachmentFile.path.substring(0, attachmentFile.path.length - attachmentFile.name.length);
						let newName = [file.basename, this.settings[fileType], num].join(" ") + "." + attachmentFile.extension;
						let fullName = parent_path + newName;
						
						// Check wether destination is existed, if existed, rename the destination file to a tmp name
						let destinationFile = this.app.vault.getAbstractFileByPath(fullName);
						if (destinationFile && destinationFile !== attachmentFile) {
							let destinationFile_path = destinationFile.path.substring(0, destinationFile.path.length - destinationFile.name.length);
							let tmpName = "tmp" + Date.now() + "_" + destinationFile.name;
							console.log("Rename attachment \"" + destinationFile.name + "\" to \"" + destinationFile_path + tmpName + "\"");
							await this.app.fileManager.renameFile(destinationFile, destinationFile_path + tmpName);
						}

						console.log("Rename attachment \"" + attachmentFile.name + "\" to \"" + newName + "\"");
						await this.app.fileManager.renameFile(attachmentFile, fullName);

						num++;
					}
				}
			}
		} else {
			console.log("No attachments found...");
		}
	};

	/*
	* Export the attachments in the active file when it has
	*/
	async handleAttachmentExport() {
		console.log("Exporting attachments...");

		// Create new JSZip instance
		let zip = new JSZip();

		// Get the active file
		let file = this.app.workspace.getActiveFile()
		const attachments = this.app.metadataCache.getFileCache(file);
		console.log("Getting attachments list...");
		if (attachments.hasOwnProperty("embeds")) {
			for (let item of attachments.embeds) {
				for (let [fileType, fileExtensions] of Object.entries(extensions)) {
					let attachmentExtension = item.link.split(".").pop();
					console.log("Collecting attachments...");
					if (fileExtensions.contains(attachmentExtension)) {
						let file_path = normalizePath(this.app.vault.adapter.basePath + '\\' + parseLinktext(item.link).path);
						console.log("Get attachment", file_path);
						// Get the attachment and write into JSZip instance
						await FileSystemAdapter.readLocalFile(file_path)
							.then(data => zip.file(normalizePath(fileType + '\\' + item.link), data))
					}
				}
			}

			// Save zip file to the root folder
			console.log("Saving attachemnts...");
			zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
				.pipe(fs.createWriteStream(normalizePath(this.app.vault.adapter.basePath + '/' + file.basename + '_Attachments.zip')))
				.on('finish', function () {
					// Send the finish message
					new Notice(file.basename + ' attachments exported.');
				});
			console.log("Saving Done...");

			let content = '';
			await this.app.vault.cachedRead(file).then(data => content = data);

			if (this.settings.exportCurrentDeletion) {
				console.log("Deleting attachments...");
				for (let item of attachments.embeds) {
					let file_path = parseLinktext(item.link).path;
					let attachmentFile = this.app.vault.getAbstractFileByPath(file_path);
					if (!attachmentFile) {
						attachmentFile = this.app.metadataCache.getFirstLinkpathDest(file_path, file_path);
					}
					content = content.replace(item.original, '');
					console.log("Delete attachment", attachmentFile.name);
					await this.app.vault.delete(attachmentFile);
				}
				await this.app.vault.modify(file, content);
				console.log("Deleting Done...");
			}
		} else {
			console.log("No attachments found...");
		}
	};

	/*
	* Export the unused attachments in all files
	*/
	async handleUnusedAttachmentExport() {
		console.log("Exporting unused attachments...");

		let files = this.app.vault.getFiles();
		let mdFiles = this.app.vault.getMarkdownFiles();
		let attachmentFiles = files.filter(file => !mdFiles.contains(file));
		// Get all extensions
		let allExtensions = Object.values(extensions).flat();
		allExtensions.push('webm');
		attachmentFiles = attachmentFiles.filter(file => allExtensions.contains(file.extension));

		// Get all Unused attachments
		console.log("Getting all unused attachments...");
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
		console.log("Saving attachemnts...");
		zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
			.pipe(fs.createWriteStream(normalizePath(this.app.vault.adapter.basePath + '/Unused_Attachments.zip')))
			.on('finish', function () {
				// Send the finish message
				new Notice('Unused attachments exported.');
			});
		console.log("Saving Done...");

		if (this.settings.exportCurrentDeletion) {
			console.log("Deleting attachments...");
			for (let file of attachmentFiles) {
				console.log("Delete attachment", file.name);
				await this.app.vault.delete(file);
			}
			console.log("Deleting Done...");
		}
	};

	/*
	* Copy the attachment's relative/absolute path
	*/
	async handleCopyAttachmentPath(menu: Menu, editor: Editor) {
		let cursorPosition = editor.getCursor();
		let content = this.app.workspace.containerEl.getElementsByClassName("cm-active cm-line")[0].childNodes;
		let linkType = '';
		let linkContent = '';
		let linkLength = 0;
		let linkStart = Infinity;
		let linkEnd = 0;
		let linkComplete = false;
		content.forEach(node => {
			let nodeText = node.textContent

			if (nodeText === '!' && linkLength < cursorPosition.ch) {
				linkType = 'MarkdownLink';
				linkStart = linkLength;
			}
			if (nodeText === '![[' && linkLength < cursorPosition.ch) {
				linkType = 'WikiLink'
				linkStart = linkLength;
			}
			if (linkLength >= linkStart && !linkComplete) {
				linkContent += nodeText;
			}
			linkLength += nodeText.length;
			if (nodeText == ')' && linkType === 'MarkdownLink') {
				linkEnd = linkLength;
				linkComplete = true;
				if (linkEnd < cursorPosition.ch) {
					linkStart = Infinity;
					linkEnd = 0;
					linkContent = '';
					linkComplete = false;
				}
			}
			if (nodeText == ']]' && linkType === 'WikiLink') {
				linkEnd = linkLength;
				linkComplete = true;
				if (linkEnd < cursorPosition.ch) {
					linkStart = Infinity;
					linkEnd = 0;
					linkContent = '';
					linkComplete = false;
				}
			}
		})
		// Should have a better way to get whether it is right-click on a link
		if (menu.items.length > 1 && this.settings.copyPath) {
			menu.addItem((item) => {
				item
					.setTitle("Copy Attachment Path")
					.setIcon("document")
					.onClick(async () => {
						let filename = linkContent.replace(/!|\[|\]|\(|\)/g, '').replace(/%20/g, ' ');
						let file_path = parseLinktext(filename).path;
						let attachmentFile = this.app.vault.getAbstractFileByPath(file_path);
						if (!attachmentFile) {
							attachmentFile = this.app.metadataCache.getFirstLinkpathDest(file_path, file_path);
						}
						let full_path;
						if (this.settings.copyPathMode === 'Relative') {
							full_path = './' + attachmentFile.path
						}
						if (this.settings.copyPathMode === 'Absolute') {
							full_path = this.app.vault.adapter.basePath.replace(/\\/g, '/') + '/' + attachmentFile.path;
						}
						navigator.clipboard.writeText(full_path);
					})
			})
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
				.setValue(!ribbons.exportCurrentFile.hidden)
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
				.setValue(this.plugin.settings.exportCurrentDeletion)
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
				.setValue(!ribbons.exportUnusesdFile.hidden)
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
				.setValue(this.plugin.settings.exportUnusedDeletion)
				.onChange(async (value) => {
					this.plugin.settings.exportUnusedDeletion = value;
					if (value) {
						new WarningModal(this.app).open();
					}
					await this.plugin.saveSettings();
				})
			)

		containerEl.createEl('h2', { text: 'Right-Click Menu Setting' });

		new Setting(containerEl)
			.setName('Copy attachment link')
			.setDesc(
				'Enable copy attachment link item in right-click menu.'
			)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.copyPath)
				.onChange(async (value) => {
					this.plugin.settings.copyPath = value;
					await this.plugin.saveSettings();
				})
			)

		new Setting(containerEl)
			.setName('Copy attachment link')
			.setDesc(
				'Autodeletion after exporting unused attachments in vault.'
			)
			.addDropdown(dropDown => {
				dropDown.addOption('Relative', 'Relative');
				dropDown.addOption('Absolute', 'Absolute');
				dropDown.onChange(async (value) => {
					this.plugin.settings.copyPathMode = value;
					await this.plugin.saveSettings();
				});
			})
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