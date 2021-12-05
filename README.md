## Obsidian Attachment Name Formatting
This plugin will format all attachments in the format: "filename attachmentFormat indexNumber.xxx"

The attachmentFormat are image, audio, video and pdf. IndexNumber is ascending number from 1 based on the attchmentFormat.

### Features
- Format attachments in active file, such as "filename image 1.png"
- Add new attachment -> will rename the attachment based on type and index
- Change order -> will rename attachments with new order
- Delete attachment -> will rename attachments with new order

### Known Issues
- **Do not support two exactly same attachment in one note, it will crush!**
- When delete an attachment which is already renamed, it will not rename and will occupy the indexNmuber for this note.
- When there are two attachments have same name but in different paths, the function will not work correctly. Try to not change the setting "Files & Links -> Default location for new attachments".
- Only support image attachment.
- One attachment file in different notes, it will be renamed when the note is modified.

### Roadmap
- When deleting attachment in a file, rename it with "filename attachmentFormat unuse 1.xxx".
- When deleting an attachment that no other file using this attachment, delete it from vault. (Could be disable)
- Support all types of attachment that supported by Obsidian.
- Setting for connection character between filename, attachmentFormat and indexNumber.
- Support the situation that attachments have same name but under different path.
- When change the setting "Files & Links -> Default location for new attachments", sync all attachments' location with this setting. (Could be disable)

### LICENSE
MIT