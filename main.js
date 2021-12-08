const {app, BrowserWindow, Menu, MenuItem} = require('electron')
const path = require('path')
const log = require('electron-log');
const fs = require('fs');
const {v4: uuidv4} = require('uuid');
const osenv = require('osenv');
const BaseImage = require('./libs/base_image');
const BaseSync = require('./libs/base_sync');
const BaseConfig = require('./libs/base_config');
const BaseFileHandler = require('./libs/base_file_handler');
const Bookshelf = require('./libs/bookshelf');
let WorkSpaceDirs = [];
let mainWindow;
log.info(process.platform);
let splitStr = "/";
if (process.platform === 'win32') {
    splitStr = "\\";
}

function getUsersHomeFolder() {
    return osenv.home();
}

const workSpaceName = "super-markdown-editor";
const workSpaceConfLocalName = ".conf_local";
const workSpaceConfGlobalName = ".conf_global";
const workspaceDir = path.join(getUsersHomeFolder(), workSpaceName);
const workConfLocal = path.join(getUsersHomeFolder(), workSpaceName, workSpaceConfLocalName);
const workConfGlobal = path.join(getUsersHomeFolder(), workSpaceName, workSpaceConfGlobalName);
const imageSpaceDir = path.join(getUsersHomeFolder(), "super-markdown-editor", "image");
let baseImageConf = new BaseImage(imageSpaceDir, workConfLocal, splitStr);
let baseSyncConf = new BaseSync(workConfLocal, workConfGlobal, splitStr);
let baseAppConf = new BaseConfig(workConfLocal, workConfGlobal, splitStr);
let baseFileHandler = new BaseFileHandler(workSpaceName, workSpaceConfLocalName, workSpaceConfGlobalName, splitStr, baseAppConf, baseImageConf);
let bookshelf = new Bookshelf(workspaceDir);


const express = require('express')
const bodyParser = require('body-parser');
const formidable = require('formidable')
const httpApp = express();
const port = 3000;
const editAccess = {};
const editWindows = {};

httpApp.use(express.static("public"));
httpApp.use('/image', express.static(imageSpaceDir));
httpApp.use(bodyParser.json({limit: '10mb'}));
httpApp.use(bodyParser.urlencoded({            //此项必须在 bodyParser.json 下面,为参数编码
    extended: true
}))
httpApp.get('/message', (req, res) => {
    res.send('Hello World!')
})

httpApp.post("/upload/image", (req, res) => {
    let form = new formidable.IncomingForm();   //创建上传表单
    form.keepExtensions = true;     //保留后缀
    form.maxFieldsSize = 2 * 1024 * 1024;   //文件大小
    form.uploadDir = imageSpaceDir;     //设置上传目录
    let isSuccess = false;
    let result = {
        "message": "success",
        "success": 0
    }
    form.parse(req, function (err, fields, files) {
        if (err) {
            res.locals.error = err;
            return;
        }

        isSuccess = true
        result["success"] = 1
        result["url"] = "/image/" + files["editormd-image-file"].newFilename;
        if (fields["open_file_path"]) {
            baseImageConf.saveImage(files["editormd-image-file"].newFilename, JSON.parse(fields["open_file_path"]));
        }
        res.send(JSON.stringify(result));
    });
})

httpApp.post('/message', (req, res) => {
    log.info(JSON.stringify(req.body));
    let result = {
        "status": "success",
        "command": req.body.command
    }
    switch (req.body.command) {
        case 'request-init-work-tree':
            WorkSpaceDirs = bookshelf.generateShowTrees();
            result["data"] = WorkSpaceDirs;
            break
        case 'create_node.jstree':
            log.info("create_node.jstree")
            if (req.body.data.type === "default") {
                result["data"] = {
                    // "created": baseFileHandler.CreateDir(req.body.data.path)
                    "created": bookshelf.addNewBook(req.body.data.parent_id, req.body.data.id, req.body.data.text),
                }
            } else {
                result["data"] = {
                    // "created": baseFileHandler.CreateFile(req.body.data.path)
                    "created": bookshelf.addNewNote(req.body.data.parent_id, req.body.data.id, req.body.data.text)
                }
            }
            break
        case 'rename_node.jstree':
            log.info("rename_node.jstree")
            // TODO: rename should change image save info
            if (req.body.data.type === "default") {
                bookshelf.renameBook(req.body.data.id, req.body.data.text);
                // baseFileHandler.RenameDir(req.body.data.path, req.body.data.old)
            } else {
                // baseFileHandler.RenameFile(req.body.data.path, req.body.data.old)
                bookshelf.renameNote(req.body.data.id, req.body.data.text);
            }

            break
        case 'open.jstree':
            log.info("open.jstree")
            if (req.body.data.type === "file") {
                result["data"] = {
                    // "text": baseFileHandler.ReadMarkdownFromFile(req.body.data.path),
                    "text": bookshelf.readNote(req.body.data.id),
                    "read": true,
                    "name": bookshelf.getShowName(req.body.data.id)
                }
            }
            break
        case 'save_markdown.jstree':
            log.info("save_markdown.jstree")
            if (req.body.data.id) {
                if (!editAccess.hasOwnProperty(req.body.data.id) || (req.body.data.hasOwnProperty("edit_id")) && req.body.data.edit_id === editAccess[req.body.data.id]) {
                    bookshelf.writeNote(req.body.data.id, req.body.data.text);
                } else {
                    result.status = "failed"
                    result.reason = "file edit in new open windows, so current editor cannot save this change"
                }
            }
            break
        case 'open_new_windows.jstree':
            if (editAccess.hasOwnProperty(req.body.data.id) && editWindows.hasOwnProperty(req.body.data.id)) {
                result.status = "failed"
                result.reason = "file edit in one open windows, so current editor cannot open new windows to edit";
                editWindows[req.body.data.id].show();
            } else {
                createEditWindow(req.body.data.id);
            }

            break

    }
    res.send(JSON.stringify(result));
})

const httpServer = httpApp.listen(port, () => {
    log.info(`Example app listening at http://localhost:${port}`)
})

function createEditWindow(id) {
    let editWindow = new BrowserWindow({
        width: 1800,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
        }
    });
    let editWinId = uuidv4();
    log.debug("edit win id:", editWinId, "markdown id:", id);
    editWindow.loadURL('http://127.0.0.1:3000/edit.html?id=' + id + "&edit=" + editWinId);
    editWindow.webContents.openDevTools()
    editWindow.on('closed', () => {
        delete editAccess[id];
        delete editWindows[id];
        log.debug(editWinId, "closed, editAccess=", JSON.stringify(editAccess));
        editWindow = null;
    });
    editAccess[id] = editWinId;
    editWindows[id] = editWindow;
}

function createWindow() {
    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
        width: 1800,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
        }
    })

    // 加载 index.html
    mainWindow.loadURL('http://127.0.0.1:3000')

    // 打开开发工具
    mainWindow.webContents.openDevTools()
}

// 这段程序将会在 Electron 结束初始化
// 和创建浏览器窗口的时候调用
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        // 通常在 macOS 上，当点击 dock 中的应用程序图标时，如果没有其他
        // 打开的窗口，那么程序会重新创建一个窗口。
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    })
})

// 除了 macOS 外，当所有窗口都被关闭的时候退出程序。 因此，通常对程序和它们在
// 任务栏上的图标来说，应当保持活跃状态，直到用户使用 Cmd + Q 退出。
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
    httpServer.close((err) => {
        log.info('server closed')
        process.exit(err ? 1 : 0)
    })
})
