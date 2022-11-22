import { App, Modal, FuzzySuggestModal, Setting } from "obsidian";
import AttachmentNameFormatting from "./main";

export class DeletionWarningModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h1", {
			text: "Will delete the attachments and content after export!",
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class FilenameWarningModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h1", {
			text: 'Invalid character for filename, will remove the character!',
		});
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
