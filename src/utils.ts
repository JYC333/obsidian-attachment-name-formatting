import { App, Editor, TAbstractFile, TFile, parseLinktext } from "obsidian";
import * as path from "path";
import { ANFSettings } from "src/types";
import AttachmentNameFormatting from "src/main";

/**
 * Get attachment file
 *
 * @param	{string}			attachmentName	The attachment name
 * @return	{TAbstractFile|TFile}				The attachment TAbstractFile object
 */
export function getAttachment(
	attachmentName: string,
	app: App
): TAbstractFile | TFile {
	const file_path = parseLinktext(
		attachmentName.replace(/(\.\/)|(\.\.\/)+/g, "")
	).path;

	let attachmentFile = app.vault.getAbstractFileByPath(file_path);
	if (!attachmentFile) {
		attachmentFile = app.metadataCache.getFirstLinkpathDest(
			file_path,
			file_path
		);
	}

	return attachmentFile;
}

/**
 * Check whether the attachmnet is already renamed by this plugin
 *
 * @param	{string}	name			The attachment name
 * @param	{string}	noteName		The note name
 * @param	{string}	attachmentType	The attachment type
 * @return	{boolean}					Whether the attachment is renamed by this plugin
 */
export function checkAlreadyRenamed(
	name: string,
	noteName: string,
	attachmentType: string,
	settings: ANFSettings
): boolean {
	// Get components of the renamed attachment
	let components = [];
	if (settings.connectorOption === "Multiple") {
		// Check whether the note name is included in the attachment name
		if (!settings.enableExcludeFileName) {
			const matchString = name.match(
				RegExp(
					/.*(?=xxx)/
						.toString()
						.replace(/\//g, "")
						.replace(/xxx/g, attachmentType)
				)
			);
			if (matchString) {
				if (settings.multipleConnectorsEnabled[0]) {
					components.push(
						matchString[0].replace(
							settings.multipleConnectors[0],
							""
						)
					);
				} else {
					components.push(matchString[0]);
				}
				name = name.replace(matchString[0], "");
			} else {
				return false;
			}
		}

		// Check whether the attachment type is included in the attachment name
		const matchString = name.match(
			RegExp(
				/xxx/
					.toString()
					.replace(/\//g, "")
					.replace(/xxx/g, attachmentType)
			)
		);
		if (matchString) {
			components.push(matchString[0]);
			name = name.replace(matchString[0], "");
		} else {
			return false;
		}

		components.push("indexNumberPlaceholder");

		// Check whether the attachment has timestamp
		if (settings.enableTime) {
			const matchString = name.match(
				RegExp(
					/\d{14}(?=xxx)/
						.toString()
						.replace(/\//g, "")
						.replace(/xxx/g, `\\` + path.extname(name))
				)
			);
			if (matchString) {
				components.push(matchString[0]);
				name = name.replace(matchString[0], "");
			} else {
				return false;
			}
		}

		// Check whether the attachment is end with hash
		if (settings.enablePathHash) {
			const connector =
				settings.multipleConnectors[
					settings.multipleConnectors.length - 1
				];

			const nameSplits = name.split(".");

			const hash = nameSplits[nameSplits.length - 2]
				.split(connector)
				.pop();

			if (hash.length === 8) {
				components.push(hash);
			} else {
				return false;
			}
		}
	} else {
		components = [...name.split(settings.connector)];
	}

	const dateCheck2 = new Date(
		+components[2].slice(0, 4),
		+components[2].slice(4, 6) - 1,
		+components[2].slice(6, 8),
		+components[2].slice(8, 10),
		+components[2].slice(10, 12),
		+components[2].slice(12, 14)
	);

	const dateCheck3 = new Date(
		+components[3].slice(0, 4),
		+components[3].slice(4, 6) - 1,
		+components[3].slice(6, 8),
		+components[3].slice(8, 10),
		+components[3].slice(10, 12),
		+components[3].slice(12, 14)
	);

	// Check whether the compents are followed the renaming pattern
	if (components.length === 3) {
		if (
			// format: noteName_attachmentType_indexNumber
			components[0] !== noteName &&
			components[1] === attachmentType
		) {
			return true;
		} else if (
			// format: attachmentType_indexNumber_time
			components[0] === attachmentType &&
			dateCheck2.toString() !== "Invalid Date"
		) {
			return true;
		} else if (
			// format: attachmentType_indexNumber_pathHash
			components[0] === attachmentType &&
			components[2].length === 8
		) {
			return true;
		}
	} else if (components.length === 4) {
		if (
			// format: noteName_attachmentType_indexNumber_time
			components[0] !== noteName &&
			components[1] === attachmentType &&
			dateCheck3.toString() !== "Invalid Date"
		) {
			return true;
		} else if (
			// format: noteName_attachmentType_indexNumber_pathHash
			components[0] !== noteName &&
			components[1] === attachmentType &&
			components[3].length === 8
		) {
			return true;
		} else if (
			// attachmentType_indexNumber_time_pathHash
			components[0] === attachmentType &&
			dateCheck2.toString() !== "Invalid Date" &&
			components[3].length === 8
		) {
		}
	} else if (components.length === 5) {
		if (
			components[0] !== noteName &&
			components[1] === attachmentType &&
			dateCheck3.toString() !== "Invalid Date" &&
			components[4].length === 8
		) {
			return true;
		}
	}
	return false;
}

/**
 * Copy the attachment to the new location
 *
 * @param	{Editor}	editor		Obsidian Editor object
 */
export function handleCopyAttachment(
	editor: Editor,
	renameCopyAttachment: string[]
) {
	let data = editor.getValue();
	let [originName, newName] = renameCopyAttachment;
	if (!data.contains(originName)) {
		originName = originName.replaceAll(" ", "%20");
		newName = newName.replaceAll(" ", "%20");
	}
	data = data.replace(originName, newName);
	editor.setValue(data);
}
