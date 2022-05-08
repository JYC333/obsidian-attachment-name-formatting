## Obsidian Attachment Name Formatting
This plugin will format all attachments in the format: "filename attachmentFormat indexNumber.xxx"

The attachmentFormat are image, audio, video and pdf. IndexNumber is ascending number from 1 based on the attchmentFormat.

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

### Features
- Format attachments in active file, such as "filename image 1.png"
- Add new attachment -> will rename the attachment based on type and index
- Change order -> will rename attachments with new order
- Delete attachment -> will rename attachments with new order

### Known Issues
- When delete an attachment which is already renamed, it will not rename and will occupy the indexNmuber for this note.
- When there are two attachments have same name but in different paths, the function will not work correctly. Try to not change the setting "Files & Links -> Default location for new attachments".
- One attachment file in different notes, it will be renamed when the note is modified.

### Roadmap
- When deleting attachment in a file, rename it with "filename attachmentFormat unuse 1.xxx".
- When deleting an attachment that no other file using this attachment, delete it from vault. (Could be disable)
- Setting for connection character between filename, attachmentFormat and indexNumber.
- Support the situation that attachments have same name but under different path.
- When change the setting "Files & Links -> Default location for new attachments", sync all attachments' location with this setting. (Could be disable)

### LICENSE
MIT