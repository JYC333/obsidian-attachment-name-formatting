import { ANFSettings, ExtensionList } from "./types";

export const extensions: ExtensionList = {
	image: ["png", "webp", "jpg", "jpeg", "gif", "bmp", "svg"],
	audio: ["mp3", "wav", "m4a", "ogg", "3gp", "flac"], // "webm"
	video: ["mp4", "webm", "ogv", "mov", "mkv"], // "webm"
	pdf: ["pdf"],
};

export const DEFAULT_SETTINGS: ANFSettings = {
	enableAuto: true,
	excludedFolders: [],
	enableImage: true,
	imageExtensions: [true, true, true, true, true, true, true], // same amout with image extensions
	image: "image",
	enableAudio: true,
	audioExtensions: [true, true, true, true, true, true], // same amout with audio extensions
	audio: "audio",
	enableVideo: true,
	videoExtensions: [true, true, true, true, true], // same amout with video extensions
	video: "video",
	enablePdf: true,
	pdfExtensions: [true], // same amout with pdf extensions
	pdf: "pdf",
	subfolders: ["", "", "", ""],
	connector: "_",
	exportCurrentRiboon: false,
	exportUnusedRiboon: false,
	exportCurrentDeletion: false,
	exportUnusedDeletion: false,
	copyPath: false,
	copyPathMode: "Relative",
	usingLog: false,
	logPath: "/",
};

export const ATTACHMENT_TYPE = ["image", "audio", "video", "pdf"];
