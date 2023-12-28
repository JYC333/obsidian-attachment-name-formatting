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
} from "obsidian";
import { ANFSettings } from "src/types";
import { DEFAULT_SETTINGS, extensions, ATTACHMENT_TYPE } from "src/constants";
import { ANFSettingTab, ribbons } from "src/settings";
import { FolderScanModal, FolderRenameWarningModal } from "src/modals";
import {
	getAttachment,
	checkAlreadyRenamed,
	handleCopyAttachment,
} from "src/utils";

import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
const crypto = require("crypto");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const JSZip = require("jszip");

let timeInterval = new Date();

interface AttachmentList {
	[key: string]: Array<TAbstractFile>;
}

export default class AttachmentNameFormatting extends Plugin {
	settings: ANFSettings;
	vaultAttachmentFolderPath: string;
	allFolders: string[];
	renaming = false;
	renameCopyAttachment: Record<string, string> = {};

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

		// Copy attachment to the new path
		// this.registerEvent(
		// 	this.app.workspace.on("editor-change", async (editor) => {
		// 		await this.handleCopyAttachment(editor);
		// 	})
		// );

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
			this.app.vault.on("rename", (folderOrFile, oldPath) => {
				if (folderOrFile instanceof TFolder) {
					this.allFolders.remove(oldPath);
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
					console.log(`Will scan the folder: ${folder}`);
					this.handleLog(`Will scan the folder: ${folder}`);
					new FolderRenameWarningModal(this.app, async (result) => {
						if (result) {
							const fileList = this.app.vault
								.getFiles()
								.filter((file) => file.path.includes(folder));

							const progress = this.addStatusBarItem();
							for (const fileIndex in fileList) {
								progress.empty();
								progress.createEl("span", {
									text: `Attachment renaming: ${fileIndex + 1
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
		// @ts-ignore
		for (const fileOrFolder in this.app.vault.adapter.files) {
			// @ts-ignore
			if (this.app.vault.adapter.files[fileOrFolder].type === "folder") {
				this.allFolders.push(
					// @ts-ignore
					this.app.vault.adapter.files[fileOrFolder].realpath
				);
			}
		}
	}

	async getVaultAttachmentFolderPath() {
		await this.app.vault.adapter
			.read(this.app.vault.configDir + "/app.json")
			.then((config) => {
				this.vaultAttachmentFolderPath =
					JSON.parse(config).attachmentFolderPath;
			});
	}

	/**
	 * Rename the attachments in the active file when it has
	 *
	 * @param	{TFile}		file	The active file
	 * @param	{boolean}	check	Whether checking its active file
	 */
	async handleAttachmentNameFormatting(file: TFile, check: boolean = false) {
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

		let editor;
		try {
			editor = this.app.workspace.activeEditor.editor;
		} catch {
			console.log("No active editor.");
		}

		await this.getVaultAttachmentFolderPath();

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
						const attachmentFile = getAttachment(
							item.link,
							this.app
						);

						// Check whether the attachment is already renamed by this plugin
						// and the attachment is not associated with this note
						if (
							checkAlreadyRenamed(
								item.link,
								file.basename,
								this.settings[
								fileType as keyof ANFSettings
								] as string,
								this.settings
							) &&
							!this.settings.enableExcludeFileName
						) {
							if (this.settings.oneInMany === "NoChange") {
								console.log(
									`NoChange option enable, skip renaming ${item.link}`
								);
								await this.handleLog(
									`NoChange option enable, skip renaming ${item.link}`
								);
								continue;
							} else if (this.settings.oneInMany === "Copy") {
								console.log(
									`Copy option enable, will copy ${item.link}`
								);
								await this.handleLog(
									`Copy option enable, will copy ${item.link}`
								);

								const copiedAttachmentPath =
									attachmentFile.path.replace(
										path.extname(attachmentFile.path),
										"_copy" +
										path.extname(attachmentFile.path)
									);

								await this.app.vault.adapter.copy(
									attachmentFile.path,
									copiedAttachmentPath
								);

								this.renameCopyAttachment[
									path.basename(copiedAttachmentPath)
								] = item.link;

								// Add to renaming list
								const copiedAttachmentFile = getAttachment(
									copiedAttachmentPath,
									this.app
								);
								if (
									!attachmentList[fileType].contains(
										copiedAttachmentFile
									)
								) {
									attachmentList[fileType].push(
										copiedAttachmentFile
									);
								}

								continue;
							}
						}

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
						// Fetch attachment folder path setting
						let parent_path = this.vaultAttachmentFolderPath;

						if (parent_path === undefined) {
							parent_path = '/'
						}

						if (parent_path.startsWith("./")) {
							parent_path = path.join(
								file.parent.path,
								parent_path
							);
						}

						// Fetch subfolder setting
						const subfolder =
							this.settings.subfolders[
							ATTACHMENT_TYPE.indexOf(fileType)
							];

						const baseNameComponent = [
							file.basename,
							this.settings[fileType as keyof ANFSettings],
							num,
						];

						if (this.settings.enableExcludeFileName) {
							baseNameComponent.shift();
						}

						// Fetch add time in name setting
						if (this.settings.enableTime) {
							const date_String =
								"" +
								timeInterval.getFullYear() +
								("0" + (timeInterval.getMonth() + 1)).slice(
									-2
								) +
								("0" + timeInterval.getDate()).slice(-2) +
								("0" + timeInterval.getHours()).slice(-2) +
								("0" + timeInterval.getMinutes()).slice(-2) +
								("0" + timeInterval.getSeconds()).slice(-2);
							baseNameComponent.push(date_String);
						}

						if (this.settings.enablePathHash) {
							const appendPathHashValue = crypto
								.createHash("md5")
								.update(file.parent.path)
								.digest("hex")
								.slice(0, 8);

							baseNameComponent.push(appendPathHashValue);
						}

						// Generater full new name without path
						let newName = "";
						if (this.settings.connectorOption === "Multiple") {
							newName += baseNameComponent[0];

							let optionIndex: number[] = [1];

							if (
								this.settings.enableTime &&
								!this.settings.enablePathHash
							) {
								optionIndex.push(2);
							} else if (
								!this.settings.enableTime &&
								this.settings.enablePathHash
							) {
								optionIndex.push(3);
							} else if (
								this.settings.enableTime &&
								this.settings.enablePathHash
							) {
								optionIndex.push(2, 3);
							}

							if (!this.settings.enableExcludeFileName) {
								optionIndex.unshift(0);
							}

							let connectors = [];
							for (let i of optionIndex) {
								connectors.push(
									this.settings.multipleConnectors[i]
								);
							}

							for (let i = 1; i < baseNameComponent.length; i++) {
								newName += connectors[i - 1];
								newName += baseNameComponent[i];
							}
							newName += "." + attachmentFile.extension;
						} else if (this.settings.connectorOption === "Single") {
							newName =
								baseNameComponent.join(
									this.settings.connector
								) +
								"." +
								attachmentFile.extension;
						}

						// Create folder is not exist
						await this.app.vault.adapter
							.exists(path.join(parent_path, subfolder))
							.then(async (value) => {
								if (!value) {
									await this.app.vault.createFolder(
										path.join(parent_path, subfolder)
									);
								}
							});

						// Full name including path
						let fullName = path
							.join(parent_path, subfolder, newName)
							.replaceAll("\\", "/");
						if (fullName.startsWith("/")) {
							fullName = fullName.slice(1);
						}

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
							`Rename attachment ${attachmentFile.path} to ${fullName}\n`
						);
						console.log(
							'Rename attachment "' +
							attachmentFile.path +
							'" to "' +
							fullName +
							'"'
						);

						const oldName = attachmentFile.name;

						await this.app.fileManager.renameFile(
							attachmentFile,
							fullName
						);

						if (this.renameCopyAttachment.hasOwnProperty(oldName)) {
							handleCopyAttachment(editor, [
								this.renameCopyAttachment[oldName],
								path.basename(fullName),
							]);
							delete this.renameCopyAttachment[oldName];
						}

						num++;
					}
				}
			}
		} else {
			console.log("No attachments found...");
		}
		setTimeout(() => (this.renaming = false), 3000);
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
						const attachement = getAttachment(item.link, this.app);

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
					const attachmentFile = getAttachment(item.link, this.app);
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
					const attachmentFile = getAttachment(
						item.link,
						this.app
					) as TFile;
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
			if (nodeText === ")" && linkType === "MarkdownLink") {
				linkEnd = linkLength;
				linkComplete = true;
				if (linkEnd < cursorPosition.ch) {
					linkStart = Infinity;
					linkEnd = 0;
					linkContent = "";
					linkComplete = false;
				}
			}
			if (nodeText === "]]" && linkType === "WikiLink") {
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
		// @ts-ignore
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
								// @ts-ignore
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

		let file;
		try {
			file = this.app.vault.getAbstractFileByPath(logName);
		} catch (error) {
			new Notice(`Error when open log file: ${error}`);
			console.error("Error when open log file:", error);
			return;
		}

		if (!file) {
			await this.app.vault.create(
				logName,
				"# Attachment Name Formatting Log\n" + message
			);
		}

		if (file instanceof TFile) {
			await this.app.vault.process(file, (data) => {
				return data + message;
			});
		}
	}
}
