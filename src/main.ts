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
	TFolder,
	EmbedCache,
} from "obsidian";
import { ANFSettings } from "./types";
import { DEFAULT_SETTINGS, extensions } from "./constants";
import { ANFSettingTab, ribbons } from "./settings";
import { FolderScanModal, FolderRenameWarningModal } from "./modals";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const JSZip = require("jszip");

let timeInterval = new Date();

interface AttachmentList {
	[key: string]: Array<TAbstractFile>;
}

export default class AttachmentNameFormatting extends Plugin {
	settings: ANFSettings;
	allFolders: string[];
	renaming: boolean;

	async onload() {
		await this.loadSettings();

		this.loadFolders();

		this.addSettingTab(new ANFSettingTab(this.app, this));

		// Format the attachments' name
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.settings.enableAuto) {
					let parentFolder = file.parent;
					let excluded = false;
					while (parentFolder.path !== "/") {
						if (
							!this.settings.excludedFolders.includes(
								parentFolder.path
							)
						) {
							parentFolder = parentFolder.parent;
						} else {
							excluded = true;
							break;
						}
					}

					if (!excluded) {
						this.handleAttachmentNameFormatting(file);
					}
				}
			})
		);

		// ---------- Functions for rename files within one folder ----------
		// Update all folder list when create new folder
		this.registerEvent(
			this.app.vault.on("create", (folderOrFile) => {
				if (folderOrFile instanceof TFolder) {
					if (!this.allFolders.includes(folderOrFile.path)) {
						this.allFolders.push(folderOrFile.path);
					}
				}
			})
		);

		// Update all folder list when rename exist folder
		this.registerEvent(
			this.app.vault.on("rename", (folderOrFile) => {
				if (folderOrFile instanceof TFolder) {
					const possibleOriginFolders = this.allFolders.filter(
						(folder) => folder.includes(folderOrFile.name)
					);
					for (const folder of possibleOriginFolders) {
						if (!this.app.vault.getAbstractFileByPath(folder)) {
							this.allFolders.remove(folder);
						}
					}
					if (!this.allFolders.includes(folderOrFile.path)) {
						this.allFolders.push(folderOrFile.path);
					}
				}
			})
		);

		// Update all folder list when delete folder
		this.registerEvent(
			this.app.vault.on("delete", (folderOrFile) => {
				if (folderOrFile instanceof TFolder) {
					if (this.allFolders.includes(folderOrFile.path)) {
						this.allFolders.remove(folderOrFile.path);
					}
				}
			})
		);

		// ---------- Commands and ribbons ----------
		this.addCommand({
			id: "export-attachments-command",
			name: "Export Attachments in Current File",
			callback: () => this.handleAttachmentExport(),
		});

		if (this.settings.exportCurrentRiboon) {
			ribbons.exportCurrentFile = this.addRibbonIcon(
				"sheets-in-box",
				"Export Attachments",
				() => this.handleAttachmentExport()
			);
		}

		this.addCommand({
			id: "export-unused-attachments-command",
			name: "Export All Unused Attachments in the Vault",
			callback: () => this.handleUnusedAttachmentExport(),
		});

		if (this.settings.exportUnusedRiboon) {
			ribbons.exportUnusesdFile = this.addRibbonIcon(
				"documents",
				"Export Unused Attachments",
				() => this.handleUnusedAttachmentExport()
			);
		}

		// Resacn the attachments command
		this.addCommand({
			id: "attachments-rescan-command",
			name: "Rescan Attachments in Current File",
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				this.handleAttachmentNameFormatting(file);
			},
		});

		this.addCommand({
			id: "scan-folder-command",
			name: "Scan Files in the Folder",
			callback: () => {
				new FolderScanModal(this.app, this, (folder) => {
					console.log(folder);
					new FolderRenameWarningModal(this.app, async (result) => {
						if (result) {
							const fileList = this.app.vault
								.getFiles()
								.filter((file) => file.path.includes(folder));

							const progress = this.addStatusBarItem();
							for (const fileIndex in fileList) {
								progress.empty();
								progress.createEl("span", {
									text: `Attachment renaming: ${
										fileIndex + 1
									}/${fileList.length}`,
								});

								await this.handleAttachmentNameFormatting(
									fileList[fileIndex],
									true
								);
							}
							progress.empty();
						}
					}).open();
				}).open();
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

	loadFolders() {
		this.allFolders = [];
		for (const fileOrFolder in this.app.vault.adapter.files) {
			if (this.app.vault.adapter.files[fileOrFolder].type === "folder") {
				this.allFolders.push(
					this.app.vault.adapter.files[fileOrFolder].realpath
				);
			}
		}
	}

	/**
	 * Rename the attachments in the active file when it has
	 *
	 * @param	{TFile}		file	The active file
	 * @param	{boolean}	check	Whether checking its active file
	 */
	async handleAttachmentNameFormatting(file: TFile, check = false) {
		// If currently opened file is not the same as the one that trigger the event,
		// skip this is to make sure other events don't trigger this plugin
		// timeInterval make sure the update not too frequent
		if (
			(this.app.workspace.getActiveFile() !== file && !check) ||
			this.renaming
		) {
			return;
		}
		this.renaming = true;
		timeInterval = new Date();

		console.log("Formatting attachments...");

		// Get the metadata of the active file
		const attachments = this.app.metadataCache.getFileCache(file);
		// Check whether the file has attachments
		console.log("Getting attachments list...");
		if (attachments.hasOwnProperty("embeds")) {
			await this.handleLog(
				`## ${file.path} [${timeInterval.toLocaleString()}]\n`
			);
			// Create a list of attachments, classified by types
			const attachmentList: AttachmentList = {};
			for (const item of attachments.embeds) {
				for (const [fileType, fileExtensions] of Object.entries(
					extensions
				)) {
					const attachmentEnable = ("enable" +
						fileType.slice(0, 1).toUpperCase() +
						fileType.slice(1)) as keyof ANFSettings;
					const extensionEnable = (fileType +
						"Extensions") as keyof ANFSettings;
					// Check whether the attachment is already renamed by this plugin
					if (
						item.link
							.split(this.settings.connector)
							.slice(-2, -1)[0] === fileType
					) {
						const attachmentName = item.link.split(".")[0];
					}
					const attachmentExtension = item.link.split(".").pop();
					const attachmentExtensionInd =
						extensions[fileType].indexOf(attachmentExtension);
					if (
						fileExtensions.contains(attachmentExtension) &&
						this.settings[attachmentEnable] &&
						// @ts-ignore
						this.settings[extensionEnable][attachmentExtensionInd]
					) {
						if (!attachmentList.hasOwnProperty(fileType)) {
							attachmentList[fileType] = [];
						}
						// Find the attachment file
						const attachmentFile = this.getAttachment(item);
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
							await this.handleLog(
								`Rename attachment ${destinationFile.name} to ${destinationFile_path} ${tmpName}\n`
							);
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

						await this.handleLog(
							`Rename attachment ${attachmentFile.name} to ${newName}\n`
						);
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
		this.renaming = false;
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
						const attachement = this.getAttachment(item);

						const file_path = normalizePath(
							// @ts-ignore
							this.app.vault.adapter.basePath +
								"\\" +
								attachement.path
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
							// @ts-ignore
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
					const attachmentFile = this.getAttachment(item);
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
					const attachmentFile = this.getAttachment(item) as TFile;
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
				// @ts-ignore
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
						// @ts-ignore
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

	/**
	 * Get attachment file
	 *
	 * @param	{EmbedCache}			item	The attachment item
	 * @return	{TAbstractFile|TFile}			The attachment TAbstractFile object
	 */
	getAttachment(item: EmbedCache): TAbstractFile | TFile {
		const file_path = parseLinktext(
			item.link.replace(/(\.\/)|(\.\.\/)+/g, "")
		).path;

		let attachmentFile = this.app.vault.getAbstractFileByPath(
			parseLinktext(item.link.replace(/(\.\/)|(\.\.\/)+/g, "")).path
		);
		if (!attachmentFile) {
			attachmentFile = this.app.metadataCache.getFirstLinkpathDest(
				file_path,
				file_path
			);
		}

		return attachmentFile;
	}

	/**
	 * Logging message into file
	 *
	 * @param	{string}	message		The log message
	 */
	async handleLog(message: string) {
		if (!this.settings.usingLog) {
			return;
		}

		const logName =
			this.settings.logPath === "/"
				? "/Attachment Name Formatting Log.md"
				: this.settings.logPath + "/Attachment Name Formatting Log.md";

		if (!this.app.vault.getAbstractFileByPath(logName)) {
			await this.app.vault.create(
				logName,
				"# Attachment Name Formatting Log\n"
			);
		}

		await this.app.vault.adapter.read(logName).then(async (value) => {
			await this.app.vault.adapter.write(logName, value + message);
		});
	}
}
