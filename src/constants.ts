import { ANFSettings } from "./types";

export const DEFAULT_SETTINGS: ANFSettings = {
	enableImage: true,
	image: "image",
	enableAudio: true,
	audio: "audio",
	enableVideo: true,
	video: "video",
	enablePdf: true,
	pdf: "pdf",
	connector: "_",
	exportCurrentDeletion: false,
	exportUnusedDeletion: false,
	copyPath: false,
	copyPathMode: "Relative",
};

export const ATTACHMENT_TYPE = ["image", "audio", "video", "pdf"];
