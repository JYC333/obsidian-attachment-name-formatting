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

### LICENSE
MIT