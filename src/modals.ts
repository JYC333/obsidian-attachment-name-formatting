import { App, Modal, FuzzySuggestModal, Setting } from "obsidian";
import AttachmentNameFormatting from "./main";
import { extensions, DEFAULT_SETTINGS, ATTACHMENT_TYPE } from "./constants";

export class ExcludedFoldersModal extends Modal {
	plugin: AttachmentNameFormatting;
	noneExcludedFolders: Record<string, string> = {};

	constructor(app: App, plugin: AttachmentNameFormatting) {
		super(app);
		this.plugin = plugin;
		this.reloadFolders();
	}

	reloadFolders() {
		this.noneExcludedFolders = {};
		this.plugin.allFolders.map((d) => {
			if (!this.plugin.settings.excludedFolders.includes(d)) {
				this.noneExcludedFolders[d] = d;
			}
		});
		delete this.noneExcludedFolders["/"];
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", {
			text: `Excluded Folders`,
		});

		for (const folder of this.plugin.settings.excludedFolders) {
			let oldValue = folder;
			new Setting(contentEl)
				.addDropdown((drop) => {
					drop.setValue(folder)
						.addOption(folder, folder)
						.addOptions(this.noneExcludedFolders)
						.onChange((value) => {
							const ind =
								this.plugin.settings.excludedFolders.indexOf(
									oldValue
								);
							this.noneExcludedFolders[oldValue] = oldValue;
							this.plugin.settings.excludedFolders[ind] = value;
							delete this.noneExcludedFolders[value];
							oldValue = value;
							this.plugin.saveSettings();
							this.reloadFolders();
							this.close();
							this.open();
						});
				})
				.addExtraButton((extraButton) => {
					extraButton.setIcon("x-circle").onClick(() => {
						this.plugin.settings.excludedFolders.remove(folder);
						this.noneExcludedFolders[folder] = folder;
						this.plugin.saveSettings();
						this.reloadFolders();
						this.close();
						this.open();
					});
				});
		}

		new Setting(contentEl).addButton((button) => {
			button.setButtonText("Add").onClick(() => {
				this.plugin.settings.excludedFolders.push(
					"Select excluded folder"
				);
				this.plugin.saveSettings();
				this.close();
				this.open();
			});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class MultiConnectorModal extends Modal {
	plugin: AttachmentNameFormatting;

	constructor(app: App, plugin: AttachmentNameFormatting) {
		super(app);
		this.plugin = plugin;
	}

	checkValidity(value: string) {
		const fileNamepatn = /\||<|>|\?|\*|:|\/|\\|#|\^|\[|\]"|%/;
		if (fileNamepatn.test(value)) {
			new WarningModal(
				this.app,
				"Invalid character for filename, will remove the character!"
			).open();
			value = value.replace(fileNamepatn, "");
			this.onClose();
			this.onOpen();
		}
		return value;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", {
			text: `Connectors`,
		});

		const optionNames = [
			"Connector before attachment type",
			"Connector before index number",
			"Connector before time suffix",
			"Connector before path hash",
		];

		let optionIndex: number[] = [1];

		if (
			this.plugin.settings.enableTime &&
			!this.plugin.settings.enablePathHash
		) {
			optionIndex.push(2);
		} else if (
			!this.plugin.settings.enableTime &&
			this.plugin.settings.enablePathHash
		) {
			optionIndex.push(3);
		} else if (
			this.plugin.settings.enableTime &&
			this.plugin.settings.enablePathHash
		) {
			optionIndex.push(2, 3);
		}

		if (!this.plugin.settings.enableExcludeFileName) {
			optionIndex.unshift(0);
		}

		for (let i of optionIndex) {
			const connectorSetting = new Setting(contentEl).setName(
				optionNames[i]
			);
			if (this.plugin.settings.multipleConnectorsEnabled[i]) {
				connectorSetting.addText((text) =>
					text
						.setPlaceholder("_")
						.setValue(
							this.plugin.settings.multipleConnectors[i] === "_"
								? ""
								: this.plugin.settings.multipleConnectors[i]
						)
						.onChange(async (value) => {
							value = this.checkValidity(value);
							this.plugin.settings.multipleConnectors[i] =
								value === ""
									? DEFAULT_SETTINGS.multipleConnectors[i]
									: value;
							await this.plugin.saveSettings();
						})
				);
			}
			connectorSetting.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.multipleConnectorsEnabled[i])
					.onChange(async (value) => {
						this.plugin.settings.multipleConnectorsEnabled[i] =
							value;
						await this.plugin.saveSettings();
						this.onClose();
						this.onOpen();
					});
			});
		}

		new Setting(contentEl).addButton((button) =>
			button.setButtonText("Reset").onClick(async () => {
				this.plugin.settings.multipleConnectors = [
					...DEFAULT_SETTINGS.multipleConnectors,
				];
				this.plugin.settings.multipleConnectorsEnabled = [
					...DEFAULT_SETTINGS.multipleConnectorsEnabled,
				];
				await this.plugin.saveSettings();
				this.onClose();
				this.onOpen();
			})
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class SuboldersModal extends Modal {
	plugin: AttachmentNameFormatting;

	constructor(app: App, plugin: AttachmentNameFormatting) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", {
			text: `Subfolders for attachments`,
		});

		for (const i in ATTACHMENT_TYPE) {
			new Setting(contentEl)
				.setName("Subfolder name for " + ATTACHMENT_TYPE[i])
				.addText((text) =>
					text
						.setPlaceholder(ATTACHMENT_TYPE[i])
						.setValue(
							this.plugin.settings.subfolders[i] === ""
								? ""
								: this.plugin.settings.subfolders[i]
						)
						.onChange(async (value) => {
							const fileNamepatn = /\||<|>|\?|\*|:|\/|\\|"/;
							if (fileNamepatn.test(value)) {
								new WarningModal(
									this.app,
									"Invalid character for filename, will remove the character!"
								).open();
								value = "";
								this.onClose();
								this.onOpen();
							}
							this.plugin.settings.subfolders[i] = value;
							await this.plugin.saveSettings();
						})
				);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class AttachmentExtensionModal extends Modal {
	attachmentType: string;
	plugin: AttachmentNameFormatting;

	constructor(
		app: App,
		attachmentType: string,
		plugin: AttachmentNameFormatting
	) {
		super(app);
		this.attachmentType = attachmentType;
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", {
			text: `Enable/Disable the ${this.attachmentType} extenstions.`,
		});

		for (const indStr in extensions[this.attachmentType]) {
			const ind = parseInt(indStr);
			const extensionSettingName = this.attachmentType + "Extensions";
			new Setting(contentEl)
				.setName(extensions[this.attachmentType][ind])
				.addToggle((toggle) => {
					toggle
						.setValue(
							// @ts-ignore
							this.plugin.settings[extensionSettingName][ind]
						)
						.onChange(async (value) => {
							// @ts-ignore
							this.plugin.settings[extensionSettingName][ind] =
								value;
							await this.plugin.saveSettings();
						});
				});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class WarningModal extends Modal {
	text: string;

	constructor(app: App, text: string) {
		super(app);
		this.text = text;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h1", {
			text: this.text,
		});

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText("OK")
				.setCta()
				.onClick(() => this.close())
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class FolderScanModal extends FuzzySuggestModal<string> {
	plugin: AttachmentNameFormatting;
	returnSelect: (result: string) => void;

	constructor(
		app: App,
		plugin: AttachmentNameFormatting,
		returnSelect: (result: string) => void
	) {
		super(app);
		this.plugin = plugin;
		this.returnSelect = returnSelect;
	}

	// Returns all available suggestions.
	getItems(): string[] {
		return this.plugin.allFolders;
	}

	// Renders each suggestion item.
	getItemText(folder: string) {
		return folder;
	}

	// Perform action on the selected suggestion.
	onChooseItem(folder: string, evt: MouseEvent | KeyboardEvent) {
		this.returnSelect(folder);
	}
}

export class FolderRenameWarningModal extends Modal {
	result: boolean;
	onSubmit: (result: boolean) => void;

	constructor(app: App, onSubmit: (result: boolean) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}
	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h3", {
			text: "This operation will scan all files in the foler and rename the attachments in them.",
		});
		contentEl.createEl("h3", {
			text: "This operation can not be revoked, are you sure to keep doing this?",
		});
		contentEl.createEl("p", {
			text: "Note: this operation will take some time, depends on the number of files.",
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Continue")
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit(true);
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Cancel")
					.setWarning()
					.onClick(() => {
						this.close();
						this.onSubmit(false);
					})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
