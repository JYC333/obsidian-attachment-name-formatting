/* eslint-disable no-mixed-spaces-and-tabs */
import { App, PluginSettingTab, Setting } from "obsidian";
import AttachmentNameFormatting from "./main";
import {
	AttachmentExtensionModad,
	DeletionWarningModal,
	FilenameWarningModal,
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
			text: "Image files: png, jpg, jpeg, gif, bmp, svg",
		});
		containerEl.createEl("p", {
			text: "Audio files: mp3, wav, m4a, ogg, 3gp, flac",
		});
		containerEl.createEl("p", { text: "Video files: mp4, ogv, mov, mkv" });
		containerEl.createEl("p", { text: "PDF files: pdf" });
		containerEl.createEl("p", {
			text: 'Do not have "webm" extension in audio and video right now',
		});
		containerEl.createEl("h2", { text: "Attachments Format Setting" });

		new Setting(containerEl)
			.setName("Format for connector")
			.setDesc(
				"Set the format for connector between file name and attachment name."
			)
			.addText((text) =>
				text
					.setPlaceholder("_")
					.setValue(
						this.plugin.settings.connector === "_"
							? ""
							: this.plugin.settings.connector
					)
					.onChange(async (value) => {
						const fileNamepatn = /\||<|>|\?|\*|:|\/|\\|"/;
						if (fileNamepatn.test(value)) {
							new FilenameWarningModal(this.app).open();
							value = "_";
							this.display();
						}
						this.plugin.settings.connector =
							value === "" ? DEFAULT_SETTINGS.connector : value;
						await this.plugin.saveSettings();
					})
			);

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
								new FilenameWarningModal(this.app).open();
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
						new AttachmentExtensionModad(
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
						new DeletionWarningModal(this.app).open();
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
							new DeletionWarningModal(this.app).open();
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
					dropDown.addOption("Relative", "Relative");
					dropDown.addOption("Absolute", "Absolute");
					dropDown.onChange(async (value) => {
						this.plugin.settings.copyPathMode = value;
						await this.plugin.saveSettings();
					});
				});
		}

		containerEl.createEl("h2", { text: "Log Setting" });

		new Setting(containerEl)
			.setName("Logging Attahment Name Changes")
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
