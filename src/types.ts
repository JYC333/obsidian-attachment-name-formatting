// export interface ANFSettings {
// 	[key: string]: unknown;
// }

export interface ANFSettings {
	enableImage: boolean;
	imageExtensions: boolean[];
	image: string;
	enableAudio: boolean;
	audioExtensions: boolean[];
	audio: string;
	enableVideo: boolean;
	videoExtensions: boolean[];
	video: string;
	enablePdf: boolean;
	pdfExtensions: boolean[];
	pdf: string;
	connector: string;
	exportCurrentRiboon: boolean;
	exportUnusedRiboon: boolean;
	exportCurrentDeletion: boolean;
	exportUnusedDeletion: boolean;
	copyPath: boolean;
	copyPathMode: string;
	usingLog: boolean;
	logPath: string;
}

export interface ExtensionList {
	[key: string]: string[];
}
