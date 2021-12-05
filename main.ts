import { App, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

interface AttachmentNameFormattingSettings {
	imageFormat: string;
	imageExtenstions: RegExp;
}

const DEFAULT_SETTINGS: AttachmentNameFormattingSettings = {
	imageFormat: "image",
	imageExtenstions: /(.png|.jpg|.jpeg|.git|.bmp|.svg)$/,
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
	* Rename the attachments in the file when it has
	* 
	* @param	{TFile}	file	The file
	*/
	handleAttachmentNameFormatting(file: TFile) {
		// If currently opened file is not the same as the one that trigger the event,
		// skip this is to make sure other events don't trigger this plugin
		if (this.app.workspace.getActiveFile() !== file) {
			return;
		}

		// Get all files in the vault, perpare for finding the attachment
		var files = this.app.vault.getFiles();
		// Get the metadata of the active file
		var cache = this.app.metadataCache.getFileCache(file)
		// Check whether the file has attachments
		if (cache.hasOwnProperty("embeds")) {
			let num = 1;
			// Filter the specific attachment extension
			for (let item of cache.embeds.filter(d => d.link.match(this.settings.imageExtenstions))) {
				// Find the attachment file
				let attachmentFile = files.filter(d => d.name === item.link);
				// Create the new full name with path
				let path = attachmentFile[0].path.replace(item.link, "");
				let newName = [file.basename, this.settings.imageFormat, num].join(" ") + "." + attachmentFile[0].extension;
				let fullName = path + newName;
				// Check wether destination is existed
				let destinationFile = this.checkDestinationExistence(attachmentFile[0].path, fullName);
				// When change order, set the exist destination to a tmp name
				if (destinationFile) {
					this.app.fileManager.renameFile(attachmentFile[0], path + "tmp_" + newName);
				} else {
					this.app.fileManager.renameFile(attachmentFile[0], fullName);
				}
				num++;
			}
		}
	};

	/**
	* Check the existence of the destination file
	* If exist, return the file, otherwise return null
	* Ignore the file when the origin file is same as the destination file
	* 
	* @param	{String}		Origin		The file will be renamed
	* @param	{String}		Destination	The destination of the file
	* @returns	{TFile | null}	Return the existing destination file or null
	*/
	checkDestinationExistence(Origin: String, Destination: String): TFile | null {
		var files = this.app.vault.getFiles();
		// Exclude itself
		files = files.filter(d => d.path === Destination && d.path !== Origin);
		if (files.length > 0)
			return files[0]
		else
			return null
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
