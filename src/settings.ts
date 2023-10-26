/* eslint-disable no-mixed-spaces-and-tabs */
import { App, PluginSettingTab, Setting } from "obsidian";
import AttachmentNameFormatting from "./main";
import {
	ExcludedFoldersModal,
	MultiConnectorModal,
	SuboldersModal,
	AttachmentExtensionModal,
	WarningModal,
} from "./modals";
import { ANFSettings } from "./types";
import { DEFAULT_SETTINGS, ATTACHMENT_TYPE } from "./constants";

interface RibbonList {
	exportCurrentFile: HTMLElement;
	exportUnusesdFile: HTMLElement;
}

export const ribbons: RibbonList = {
	exportCurrentFile: null,
	exportUnusesdFile: null,
};

export class ANFSettingTab extends PluginSettingTab {
	plugin: AttachmentNameFormatting;

	constructor(app: App, plugin: AttachmentNameFormatting) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h1", { text: "Attachment Name Formatting" });
		containerEl.createEl("p", {
			text: 'This plugin will format all attachments in the format: "filename attachmentType indexNumber.xxx".',
		});
		containerEl.createEl("p", {
			text: "Each type of attachment will have individual index.",
		});
		containerEl.createEl("p", {
			text: "Only recognize the file type that can be recognized by Obsidian.",
		});
		containerEl.createEl("h3", { text: "Supported file formats" });
		containerEl.createEl("p", {
			text: "Image files: png, webp, jpg, jpeg, gif, bmp, svg",
		});
		containerEl.createEl("p", {
			text: "Audio files: mp3, wav, m4a, ogg, 3gp, flac",
		});
		containerEl.createEl("p", {
			text: "Video files: mp4, webm, ogv, mov, mkv",
		});
		containerEl.createEl("p", { text: "PDF files: pdf" });
		containerEl.createEl("p", {
			text: '"webm" extension will be regard as video even if it can also be audio',
		});
		containerEl.createEl("h2", { text: "Attachments Format Setting" });

		const connectorSetting = new Setting(containerEl)
			.setName("Format for connector")
			.setDesc(
				"Set the format for connector between file name and attachment name, you can also set multiple connectors seperately."
			);

		if (this.plugin.settings.connectorOption === "Multiple") {
			connectorSetting
				.addExtraButton((extraButton) => {
					extraButton.onClick(() => {
						new MultiConnectorModal(app, this.plugin).open();
					});
				})
				.addDropdown((dropDown) => {
					dropDown
						.addOption("Single", "Single")
						.addOption("Multiple", "Multiple")
						.setValue("Multiple")
						.onChange(async (value) => {
							this.plugin.settings.connectorOption = value;
							await this.plugin.saveSettings();
							this.display();
						});
				});
		} else if (this.plugin.settings.connectorOption === "Single") {
			connectorSetting
				.addText((text) =>
					text
						.setPlaceholder("_")
						.setValue(
							this.plugin.settings.connector === "_"
								? ""
								: this.plugin.settings.connector
						)
						.onChange(async (value) => {
							const fileNamepatn =
								/\||<|>|\?|\*|:|\/|\\|#|\^|\[|\]"/;
							if (fileNamepatn.test(value)) {
								new WarningModal(
									this.app,
									"Invalid character for filename, will remove the character!"
								).open();
								value = value.replace(fileNamepatn, "");
								this.plugin.settings.connector = value;
								this.display();
							}
							this.plugin.settings.connector =
								value === ""
									? DEFAULT_SETTINGS.connector
									: value;

							await this.plugin.saveSettings();
						})
				)
				.addDropdown((dropDown) => {
					dropDown
						.addOption("Single", "Single")
						.addOption("Multiple", "Multiple")
						.setValue("Single")
						.onChange(async (value) => {
							this.plugin.settings.connectorOption = value;
							await this.plugin.saveSettings();
							this.display();
						});
				});
		}

		for (const item of ATTACHMENT_TYPE) {
			const attachmentType = item as keyof ANFSettings;
			const typeSetting = new Setting(containerEl)
				.setName(`Format for ${attachmentType}`)
				.setDesc(`Set the format for ${attachmentType} attachment.`);
			const attachmentEnable = ("enable" +
				attachmentType.slice(0, 1).toUpperCase() +
				attachmentType.slice(1)) as keyof ANFSettings;
			if (this.plugin.settings[attachmentEnable]) {
				typeSetting.addText((text) =>
					text
						.setPlaceholder(attachmentType)
						.setValue(
							this.plugin.settings[attachmentType] ===
								attachmentType
								? ""
								: (this.plugin.settings[
										attachmentType
								  ] as string)
						)
						.onChange(async (value) => {
							const fileNamepatn = /\||<|>|\?|\*|:|\/|\\|"/;
							if (fileNamepatn.test(value)) {
								new WarningModal(
									this.app,
									"Invalid character for filename, will remove the character!"
								).open();
								value = value.replace(fileNamepatn, "");
								this.display();
							}
							this.plugin.settings[attachmentType] = (
								value === ""
									? DEFAULT_SETTINGS[attachmentType]
									: value
							) as never;
							await this.plugin.saveSettings();
						})
				);

				typeSetting.addExtraButton((extraButton) => {
					extraButton.onClick(() => {
						new AttachmentExtensionModal(
							app,
							attachmentType,
							this.plugin
						).open();
					});
				});
			}
			typeSetting.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings[attachmentEnable] as boolean)
					.onChange(async (value) => {
						this.plugin.settings[attachmentEnable] = value as never;
						this.typeAvaliablility(value, typeSetting);
						await this.plugin.saveSettings();
						this.display();
					});
			});
		}

		new Setting(containerEl)
			.setName("Handle same attachment used in different notes")
			.setDesc(
				"Choose to how to handle the same attachment used in different notes." +
					"There are three options: " +
					"1. Default: Always rename with the note name; " +
					"2. Copy: Create a copy for the attachment; " +
					"3. NoChange: Stick to the first time that attachment is renamed, and will not occupy index number;"
			)
			.addDropdown((dropDown) => {
				dropDown
					.addOption("Default", "Default")
					.addOption("Copy", "Copy")
					.addOption("NoChange", "NoChange")
					.setValue(this.plugin.settings.oneInMany)
					.setDisabled(this.plugin.settings.enableExcludeFileName)
					.onChange(async (value) => {
						this.plugin.settings.oneInMany = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Automatic formatting")
			.setDesc(
				"Automatic formatting the attachments' name when changing note content"
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableAuto)
					.onChange(async (value) => {
						this.plugin.settings.enableAuto = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Add modify time after index")
			.setDesc(
				"Add modify time after index to track the change time in file name"
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableTime)
					.onChange(async (value) => {
						if (this.plugin.settings.enableExcludeFileName) {
							new WarningModal(
								app,
								"Cannot exclude time suffix when enable exclude the note name!"
							).open();
							this.plugin.settings.enableTime = true;
						} else {
							this.plugin.settings.enableTime = value;
						}
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Exclude the note name in the attachment name")
			.setDesc(
				"Exclude the note name when rename the attachment name, will enable time suffix and disable one attachment in many notes setting automically."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableExcludeFileName)
					.onChange(async (value) => {
						this.plugin.settings.enableExcludeFileName = value;
						this.plugin.settings.enableTime = value;
						this.plugin.settings.multipleConnectorsEnabled[0] =
							!value;
						this.plugin.settings.oneInMany = "Default";
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc(
				"The notes under these folders will not reformat auto format the attachment name"
			)
			.addExtraButton((extraButton) => {
				extraButton.onClick(() => {
					new ExcludedFoldersModal(app, this.plugin).open();
				});
			});

		new Setting(containerEl)
			.setName("Subfolders for attachments")
			.setDesc(
				"You can add subfolders for each attachment type under the attachment folder you set"
			)
			.addExtraButton((extraButton) => {
				extraButton.onClick(() => {
					new SuboldersModal(app, this.plugin).open();
				});
			});

		containerEl.createEl("h2", { text: "Export Setting" });

		new Setting(containerEl)
			.setName("Ribbon: Export Attachments in Current File")
			.setDesc(
				"Toggle the display of export attachments in current file ribbon."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.exportCurrentRiboon)
					.onChange(async (value) => {
						this.plugin.settings.exportCurrentRiboon = value;
						if (value) {
							ribbons.exportCurrentFile =
								this.plugin.addRibbonIcon(
									"sheets-in-box",
									"Export Attachments",
									() => this.plugin.handleAttachmentExport()
								);
						} else {
							this.plugin.app.workspace.containerEl.childNodes[0].childNodes[1].removeChild(
								ribbons.exportCurrentFile
							);
							ribbons.exportCurrentFile = null;
						}
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ribbon: Export Unused Attachments in Vault")
			.setDesc(
				"Toggle the display of export unused attachments ribbon. Will take long time for a large vault."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.exportUnusedRiboon)
					.onChange(async (value) => {
						this.plugin.settings.exportUnusedRiboon = value;
						if (value) {
							ribbons.exportUnusesdFile =
								this.plugin.addRibbonIcon(
									"documents",
									"Export Unused Attachments",
									() =>
										this.plugin.handleUnusedAttachmentExport()
								);
						} else {
							this.plugin.app.workspace.containerEl.childNodes[0].childNodes[1].removeChild(
								ribbons.exportUnusesdFile
							);
							ribbons.exportUnusesdFile = null;
						}
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Deletion After Exporting Attachments in Current File")
			.setDesc(
				"Autodeletion after exporting attachments in current file."
			)
			.addToggle((toggle) =>
				toggle.onChange(async (value) => {
					this.plugin.settings.exportCurrentDeletion = value;
					if (value) {
						new WarningModal(
							this.app,
							"Will delete the attachments and content after export!"
						).open();
					}
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Deletion After Exporting Unused Attachments in Vault")
			.setDesc(
				"Autodeletion after exporting unused attachments in vault."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.exportUnusedDeletion)
					.onChange(async (value) => {
						this.plugin.settings.exportUnusedDeletion = value;
						if (value) {
							new WarningModal(
								this.app,
								"Will delete the attachments and content after export!"
							).open();
						}
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h2", { text: "Right-Click Menu Setting" });

		new Setting(containerEl)
			.setName("Copy Attachment Link")
			.setDesc("Enable copy attachment link item in right-click menu.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.copyPath)
					.onChange(async (value) => {
						this.plugin.settings.copyPath = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (this.plugin.settings.copyPath) {
			new Setting(containerEl)
				.setName("Set Copy Link Type")
				.setDesc("Choose to use relative path or absolute path.")
				.addDropdown((dropDown) => {
					dropDown
						.addOption("Relative", "Relative")
						.addOption("Absolute", "Absolute")
						.onChange(async (value) => {
							this.plugin.settings.copyPathMode = value;
							await this.plugin.saveSettings();
						});
				});
		}

		containerEl.createEl("h2", { text: "Log Setting" });

		new Setting(containerEl)
			.setName("Logging Attachment Name Changes")
			.setDesc("Logging the attachmnet name changes into file.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.usingLog)
					.onChange(async (value) => {
						this.plugin.settings.usingLog = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (this.plugin.settings.usingLog) {
			new Setting(containerEl)
				.setName("Log File Path")
				.setDesc(
					"Set where the log file saved. Note: change path will not move the old log."
				)
				.addDropdown((drop) => {
					drop.setValue(this.plugin.settings.logPath)
						.addOptions(
							this.plugin.allFolders.reduce(
								(a, v) => ({ ...a, [v]: v }),
								{}
							)
						)
						.onChange(async (value) => {
							this.plugin.settings.logPath = value;
							await this.plugin.saveSettings();
						});
				});
		}
	}

	typeAvaliablility(available: boolean, attachmentType: Setting) {
		const attachmentTypeName = attachmentType.nameEl.textContent
			.split(" ")
			.pop() as keyof ANFSettings;

		if (available) {
			attachmentType.addText((text) =>
				text
					.setPlaceholder(attachmentTypeName)
					.setValue(
						this.plugin.settings[attachmentTypeName] as string
					)
					.onChange(async (value) => {
						this.plugin.settings[attachmentTypeName] = (
							value === ""
								? DEFAULT_SETTINGS[attachmentTypeName]
								: value
						) as never;
						await this.plugin.saveSettings();
					})
			);
		} else {
			attachmentType.components.pop();
		}
	}
}
