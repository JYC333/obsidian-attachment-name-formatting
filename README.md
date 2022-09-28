## Obsidian Attachment Name Formatting
This plugin will format all attachments in the format: "filename attachmentFormat indexNumber.xxx"

The attachmentFormat are image, audio, video and pdf. IndexNumber is ascending number from 1 based on the attchmentFormat.You can change the default format for different type of attachments and the connector in the setting.

### Features
- Format attachments in active file, such as "filename image 1.png"
- Add new attachment -> will rename the attachment based on type and index
- Change order -> will rename attachments with new order
- Delete attachment -> will rename attachments with new order

### Supported attachment format
1. Image files: png, jpg, jpeg, gif, bmp, svg
2. Audio files: mp3, wav, m4a, ogg, 3gp, flac
3. Video files: mp4, ogv, mov, mkv
4. PDF files: pdf
`webm` file type doesn't support right now.

### Known Issues
- When delete an attachment which is already renamed, it will not rename and will occupy the indexNmuber for this note. But will be renamed to tmp_xxx if there is a conflict later.
- When there are two attachments have same name but in different paths, the function will not work correctly. Try to not change the setting "Files & Links -> Default location for new attachments".
- One attachment file in different notes, it will be renamed when the note is modified.


### Roadmap
- When deleting attachment in a file, rename it with "filename attachmentFormat unuse 1.xxx".
- When deleting an attachment that no other file using this attachment, delete it from vault. (Could be disable)
- Setting for connection character between filename, attachmentFormat and indexNumber.
- Support the situation that attachments have same name but under different path.
- When change the setting "Files & Links -> Default location for new attachments", sync all attachments' location with this setting. (Could be disable)

### Fix in 1.4.5
- Recognize "./" and "../" in the attachment path.

### Change in 1.4.4
- Add setting for connector, now you can customize the connector.
- Update Readme and the description in the setting.
- Update the support file type for video files (mov, mkv).

### Change in 1.4.3
- Using "_" instead of space for the attachment naming

### New in 1.4.2
- Change the renaming strategy, make the renaming process more stable
- Renaming will not trigger everytime when you change the note, it will have one second intervel after the last renaming

### New in 1.4.1
- Add some console outputs for debug.
- Add rescan command for manual rescan.

### New Features in 1.4.0
- Add copy attachment path option when right-click on the attachment link.
- Provide two options, absolute path and relative path (according to the vault path), default with relative path.

### New Features in 1.3.0
**The export function only apply on Destop side.**
- Export attachments in current files.
- Export all unused attachments in vault.
- Optional autodeletion after exporting.

### New Features in 1.2.0
- Support the same attachment embeds mutiple times in one file
- Support audio, video and pdf now
- Didn't support the extension "webm" in audio and video right now, because this extension exists in both audio and video

### LICENSE
MIT