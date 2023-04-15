## Obsidian Attachment Name Formatting

This plugin will format all attachments in the format: "filename attachmentFormat indexNumber.xxx"

The attachmentFormat are image, audio, video and pdf. IndexNumber is ascending number from 1 based on the attchmentFormat.You can change the default format for different type of attachments and the connector in the setting.

**Note**: The base path of the attachments is based on the Valut setting: Files & Linsk -> Attachment folder path.

### Features

#### Core Function

-   Format attachments in active file, such as "filename image 1.png"
-   Format attachmnets in selected folder
-   Format attachments with customize subfolder for each attachment type
-   Attachment name can be customized for each type of attachment, you can use any character that allowed in a file name
-   Connector (the character between filename, attachmentFormat and indexNumber) can be customized, you can use any character that allowed in a file name
-   Add new attachment -> will rename the attachment based on type and index
-   Change order -> will rename attachments with new order
-   Delete attachment -> will rename attachments with new order

#### Other Function

-   Export attachmnets in current file and save as a zip file (can be deleted after export), only avaliable in desktop now
-   Export unused attachment in the vault and save as a zip file (can be deleted after export), only avaliable in desktop now

### Supported attachment format

1. Image files: png, webp, jpg, jpeg, gif, bmp, svg
2. Audio files: mp3, wav, m4a, ogg, 3gp, flac
3. Video files: mp4, webp, ogv, mov, mkv
4. PDF files: pdf

`webm` file type will be regard as vedieo even if it can be audio.

### Known Issues

-   When delete an attachment which is already renamed, it will not rename and will occupy the indexNmuber for this note. But will be renamed to tmp_xxx if there is a conflict later.
-   When there are two attachments have same name but in different paths, the function will not work correctly. Try to not change the setting "Files & Links -> Default location for new attachments".
-   One attachment file in different notes, it will be renamed when the note is modified.

### Roadmap

-   When deleting attachment in a file, rename it with "filename attachmentFormat unuse 1.xxx".
-   When deleting an attachment that no other file using this attachment, delete it from vault. (Could be disable)
-   Support the situation that attachments have same name but under different path.
-   When change the setting "Files & Links -> Default location for new attachments", sync all attachments' location with this setting. (Could be disable)

### LICENSE

MIT
