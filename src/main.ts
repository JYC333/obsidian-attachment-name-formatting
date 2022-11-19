import {
	Plugin,
	TFile,
	TAbstractFile,
	Notice,
	parseLinktext,
	normalizePath,
	FileSystemAdapter,
	Menu,
	Editor,
} from "obsidian";
import { ANFSettings } from "./types";
import { DEFAULT_SETTINGS } from "./constants";
import { ANFSettingTab } from "./settings";

const fs = require("fs");
const JSZip = require("jszip");

let timeInterval = Date.now();

interface AttachmentList {
	[key: string]: Array<TAbstractFile>;
}

const extensions = {
	image: ["png", "jpg", "jpeg", "gif", "bmp", "svg"],
	audio: ["mp3", "wav", "m4a", "ogg", "3gp", "flac"], // "webm"
	video: ["mp4", "ogv", "mov", "mkv"], // "webm"
	pdf: ["pdf"],
};

export default class AttachmentNameFormatting extends Plugin {
	settings: ANFSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new ANFSettingTab(this.app, this));

		// Format the attachments' name
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) =>
				this.handleAttachmentNameFormatting(file)
			)
		);

		this.addCommand({
			id: "export-attachments-command",
			name: "Export Attachments in Current File",
			callback: () => this.handleAttachmentExport(),
		});

		this.addCommand({
			id: "export-unused-attachments-command",
			name: "Export All Unused Attachments in the Vault",
			callback: () => this.handleUnusedAttachmentExport(),
		});

		// Resacn the attachments command
		this.addCommand({
			id: "attachments-rescan-command",
			name: "Rescan Attachments in Current File",
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				this.handleAttachmentNameFormatting(file);
			},
		});

		// Copy the attachment's relative/absolute path
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) =>
				this.handleCopyAttachmentPath(menu, editor)
			)
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
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
		if (
			this.app.workspace.getActiveFile() !== file ||
			Date.now() - timeInterval < 2000
		) {
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
			const attachmentList: AttachmentList = {};
			for (const item of attachments.embeds) {
				for (const [fileType, fileExtensions] of Object.entries(
					extensions
				)) {
					const attachmentEnable = ("enable" +
						fileType.slice(0, 1).toUpperCase() +
						fileType.slice(1)) as keyof ANFSettings;
					const attachmentExtension = item.link.split(".").pop();
					if (
						fileExtensions.contains(attachmentExtension) &&
						this.settings[attachmentEnable]
					) {
						if (!attachmentList.hasOwnProperty(fileType)) {
							attachmentList[fileType] = [];
						}
						// Find the attachment file
						console.log(item.link);
						const file_path = parseLinktext(
							item.link.replace(/(\.\/)|(\.\.\/)+/g, "")
						).path;
						console.log(file_path);
						let attachmentFile =
							this.app.vault.getAbstractFileByPath(file_path);
						if (!attachmentFile) {
							attachmentFile =
								this.app.metadataCache.getFirstLinkpathDest(
									file_path,
									file_path
								);
						}
						console.log(attachmentFile);
						// Avoid duplication
						if (
							!attachmentList[fileType].contains(attachmentFile)
						) {
							attachmentList[fileType].push(attachmentFile);
						}
					}
				}
			}
			console.log("Attachment list:", attachmentList);
			// Rename the attachments
			console.log("Renaming attachments...");
			for (const [fileType, attachmentFiles] of Object.entries(
				attachmentList
			)) {
				let num = 1;
				for (const attachmentFile of attachmentFiles) {
					// Check if it exists and is of the correct type
					if (attachmentFile instanceof TFile) {
						// Create the new full name with path
						const parent_path = attachmentFile.path.substring(
							0,
							attachmentFile.path.length -
								attachmentFile.name.length
						);
						const newName =
							[
								file.basename,
								this.settings[fileType as keyof ANFSettings],
								num,
							].join(this.settings.connector) +
							"." +
							attachmentFile.extension;
						const fullName = parent_path + newName;

						// Check wether destination is existed, if existed,
						// rename the destination file to a tmp name
						const destinationFile =
							this.app.vault.getAbstractFileByPath(fullName);
						if (
							destinationFile &&
							destinationFile !== attachmentFile
						) {
							const destinationFile_path =
								destinationFile.path.substring(
									0,
									destinationFile.path.length -
										destinationFile.name.length
								);
							const tmpName =
								"tmp" + Date.now() + "_" + destinationFile.name;
							console.log(
								'Rename attachment "' +
									destinationFile.name +
									'" to "' +
									destinationFile_path +
									tmpName +
									'"'
							);
							await this.app.fileManager.renameFile(
								destinationFile,
								destinationFile_path + tmpName
							);
						}

						console.log(
							'Rename attachment "' +
								attachmentFile.name +
								'" to "' +
								newName +
								'"'
						);
						await this.app.fileManager.renameFile(
							attachmentFile,
							fullName
						);

						num++;
					}
				}
			}
		} else {
			console.log("No attachments found...");
		}
	}

	/*
	 * Export the attachments in the active file when it has
	 */
	async handleAttachmentExport() {
		console.log("Exporting attachments...");

		// Create new JSZip instance
		const zip = new JSZip();

		// Get the active file
		const file = this.app.workspace.getActiveFile();
		const attachments = this.app.metadataCache.getFileCache(file);
		console.log("Getting attachments list...");
		if (attachments.hasOwnProperty("embeds")) {
			for (const item of attachments.embeds) {
				for (const [fileType, fileExtensions] of Object.entries(
					extensions
				)) {
					const attachmentExtension = item.link.split(".").pop();
					console.log("Collecting attachments...");
					if (fileExtensions.contains(attachmentExtension)) {
						const file_path = normalizePath(
							this.app.vault.adapter.basePath +
								"\\" +
								parseLinktext(item.link).path
						);
						console.log("Get attachment", file_path);
						// Get the attachment and write into JSZip instance
						await FileSystemAdapter.readLocalFile(file_path).then(
							(data) =>
								zip.file(
									normalizePath(fileType + "\\" + item.link),
									data
								)
						);
					}
				}
			}

			// Save zip file to the root folder
			console.log("Saving attachemnts...");
			zip.generateNodeStream({ type: "nodebuffer", streamFiles: true })
				.pipe(
					fs.createWriteStream(
						normalizePath(
							this.app.vault.adapter.basePath +
								"/" +
								file.basename +
								"_Attachments.zip"
						)
					)
				)
				.on("finish", function () {
					// Send the finish message
					new Notice(file.basename + " attachments exported.");
				});
			console.log("Saving Done...");

			let content = "";
			await this.app.vault
				.cachedRead(file)
				.then((data) => (content = data));

			if (this.settings.exportCurrentDeletion) {
				console.log("Deleting attachments...");
				for (const item of attachments.embeds) {
					const file_path = parseLinktext(item.link).path;
					let attachmentFile =
						this.app.vault.getAbstractFileByPath(file_path);
					if (!attachmentFile) {
						attachmentFile =
							this.app.metadataCache.getFirstLinkpathDest(
								file_path,
								file_path
							);
					}
					content = content.replace(item.original, "");
					console.log("Delete attachment", attachmentFile.name);
					await this.app.vault.delete(attachmentFile);
				}
				await this.app.vault.modify(file, content);
				console.log("Deleting Done...");
			}
		} else {
			console.log("No attachments found...");
		}
	}

	/*
	 * Export the unused attachments in all files
	 */
	async handleUnusedAttachmentExport() {
		console.log("Exporting unused attachments...");

		const files = this.app.vault.getFiles();
		const mdFiles = this.app.vault.getMarkdownFiles();
		let attachmentFiles = files.filter((file) => !mdFiles.contains(file));
		// Get all extensions
		const allExtensions = Object.values(extensions).flat();
		allExtensions.push("webm");
		attachmentFiles = attachmentFiles.filter((file) =>
			allExtensions.contains(file.extension)
		);

		// Get all Unused attachments
		console.log("Getting all unused attachments...");
		for (const mdfile of mdFiles) {
			const attachments = this.app.metadataCache.getFileCache(mdfile);
			if (attachments.hasOwnProperty("embeds")) {
				for (const item of attachments.embeds) {
					const file_path = parseLinktext(item.link).path;
					const attachmentFile =
						this.app.metadataCache.getFirstLinkpathDest(
							file_path,
							file_path
						);
					if (attachmentFiles.contains(attachmentFile)) {
						attachmentFiles.remove(attachmentFile);
					}
				}
			}
		}

		// Create new JSZip instance and write the unused attachments
		const zip = new JSZip();
		for (const file of attachmentFiles) {
			const file_path = normalizePath(
				this.app.vault.adapter.basePath +
					"\\" +
					parseLinktext(file.path).path
			);
			await FileSystemAdapter.readLocalFile(file_path).then((data) =>
				zip.file(normalizePath(file.name), data)
			);
		}

		// Save zip file to the root folder
		console.log("Saving attachemnts...");
		zip.generateNodeStream({ type: "nodebuffer", streamFiles: true })
			.pipe(
				fs.createWriteStream(
					normalizePath(
						this.app.vault.adapter.basePath +
							"/Unused_Attachments.zip"
					)
				)
			)
			.on("finish", function () {
				// Send the finish message
				new Notice("Unused attachments exported.");
			});
		console.log("Saving Done...");

		if (this.settings.exportCurrentDeletion) {
			console.log("Deleting attachments...");
			for (const file of attachmentFiles) {
				console.log("Delete attachment", file.name);
				await this.app.vault.delete(file);
			}
			console.log("Deleting Done...");
		}
	}

	/*
	 * Copy the attachment's relative/absolute path
	 */
	async handleCopyAttachmentPath(menu: Menu, editor: Editor) {
		const cursorPosition = editor.getCursor();
		const content =
			this.app.workspace.containerEl.getElementsByClassName(
				"cm-active cm-line"
			)[0].childNodes;
		let linkType = "";
		let linkContent = "";
		let linkLength = 0;
		let linkStart = Infinity;
		let linkEnd = 0;
		let linkComplete = false;
		content.forEach((node) => {
			const nodeText = node.textContent;

			if (nodeText === "!" && linkLength < cursorPosition.ch) {
				linkType = "MarkdownLink";
				linkStart = linkLength;
			}
			if (nodeText === "![[" && linkLength < cursorPosition.ch) {
				linkType = "WikiLink";
				linkStart = linkLength;
			}
			if (linkLength >= linkStart && !linkComplete) {
				linkContent += nodeText;
			}
			linkLength += nodeText.length;
			if (nodeText == ")" && linkType === "MarkdownLink") {
				linkEnd = linkLength;
				linkComplete = true;
				if (linkEnd < cursorPosition.ch) {
					linkStart = Infinity;
					linkEnd = 0;
					linkContent = "";
					linkComplete = false;
				}
			}
			if (nodeText == "]]" && linkType === "WikiLink") {
				linkEnd = linkLength;
				linkComplete = true;
				if (linkEnd < cursorPosition.ch) {
					linkStart = Infinity;
					linkEnd = 0;
					linkContent = "";
					linkComplete = false;
				}
			}
		});
		// Should have a better way to get whether it is right-click on a link
		if (menu.items.length > 1 && this.settings.copyPath) {
			menu.addItem((item) => {
				item.setTitle("Copy Attachment Path")
					.setIcon("document")
					.onClick(async () => {
						const filename = linkContent
							.replace(/!|\[|\]|\(|\)/g, "")
							.replace(/%20/g, " ");
						const file_path = parseLinktext(filename).path;
						let attachmentFile =
							this.app.vault.getAbstractFileByPath(file_path);
						if (!attachmentFile) {
							attachmentFile =
								this.app.metadataCache.getFirstLinkpathDest(
									file_path,
									file_path
								);
						}
						let full_path;
						if (this.settings.copyPathMode === "Relative") {
							full_path = "./" + attachmentFile.path;
						}
						if (this.settings.copyPathMode === "Absolute") {
							full_path =
								this.app.vault.adapter.basePath.replace(
									/\\/g,
									"/"
								) +
								"/" +
								attachmentFile.path;
						}
						navigator.clipboard.writeText(full_path);
					});
			});
		}
	}
}
