## Obsidian Attachment Name Formatting

This plugin will format all attachments in the format: "noteName attachmentFormat indexNumber.xxx"

The attachmentFormat are image, audio, video and pdf. IndexNumber is ascending number from 1 based on the attchmentFormat.You can change the default format for different type of attachments and the connector in the setting. Basically, there are three components can be enabled or disabled in attachment name: **noteName**, **time** (format time), and **pathHash** (absolute note path hash). Therefore, there could be seven types for the attachment name format:

1. noteName attachmentFormat indexNumber.xxx
2. noteName attachmentFormat indexNumber time.xxx
3. noteName attachmentFormat indexNumber pathHash.xxx
4. noteName attachmentFormat indexNumber time pathHash.xxx
5. attachmentFormat indexNumber time.xxx
6. attachmentFormat indexNumber pathHash.xxx
7. attachmentFormat indexNumber time pathHash.xxx

The space in between can be set by your choice, even use nothing in between.

There is a one-in-many situation, which means using the same attachment in many different notes. In this plugin, it gives three options to handle this situation:

1. Default: Always rename with the note name;
2. Copy: Create a copy for the attachment and rename with the new note name;
3. NoChange: Stick to the first time that attachment is renamed, and will not occupy index number

When using "Copy" mode, it will take a bit longer time than usual renaming time, around 1-2s. For "NoChange" mode, if you want to rename the attachment after it's renamed by this plugin, you need to rename it by yourself in the valut or in the file system right now. May add a Command later to handle this.

**Note**: The base path of the attachments is based on the Valut setting: Files & Linsk -> Attachment folder path.

### Features

#### Core Function

-   Format attachments in active file, such as "noteName image 1.png". Format time and absolute note path hash can add into attachment name, such as "noteName image 1 20220101000000.png", "noteName image 1 6666cd76.png". Defualt setting is not adding time and path hash. You can also exclude the noteName in the attachment noteName, but the time suffix will be added automatically.
-   Format attachmnets in selected folder
-   Format attachments with customize subfolder for each attachment type
-   Attachment name can be customized for each type of attachment, you can use any character that allowed in a note name
-   Connector (the character between noteName, attachmentFormat, indexNumber, time and pathHash) can be customized, you can use any character that allowed in a note name. You can also customized different connectors seperately or even don't use connector.
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

### Roadmap

-   When deleting attachment in a file, rename it with "noteName attachmentFormat unuse 1.xxx".
-   When deleting an attachment that no other file using this attachment, delete it from vault. (Could be disable)

### Development Setup

1. Setup change log tool

```
npm install -g commitizen
npm install -g conventional-changelog-cli
```

2. Update change log

```
git add .
git cz
```

3. Update version

```
npm run version --new=<new_version>
```

4. Push tag

```
git push origin --tag
```

### Thanks

I develop this plugin as a hobby, spending my free time doing this. If you find it valuable, then please say THANK YOU or buy me a coffee...

<div class="ex-coffee-div" align="center">
<img src=".github/funding/QR_alipay.jpg" width="20%" height="20%">
<img src=".github/funding/QR_wechat.jpg" width="20%" height="20%">
</div>

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/G2G7RXRRO)

### LICENSE

MIT
