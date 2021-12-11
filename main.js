const {electron, app, BrowserWindow, Menu, MenuItem} = require('electron')
const path = require('path')
const log = require('electron-log');
const fs = require('fs');
const {v4: uuidv4} = require('uuid');
const osenv = require('osenv');
const Bookshelf = require('./libs/bookshelf');
const ShelfRedo = require('./libs/shelf_redo');
const EditorConf = require('./libs/editor_conf');
let WorkSpaceDirs = [];
let mainWindow;
log.info(process.platform);
let splitStr = "/";
if (process.platform === 'win32') {
    splitStr = "\\";
}

let template = [{
    label: '编辑',
    submenu: [{
        label: '撤销',
        accelerator: 'CmdOrCtrl+Z',
        role: 'undo'
    }, {
        label: '重做',
        accelerator: 'Shift+CmdOrCtrl+Z',
        role: 'redo'
    }, {
        type: 'separator'
    }, {
        label: '剪切',
        accelerator: 'CmdOrCtrl+X',
        role: 'cut'
    }, {
        label: '复制',
        accelerator: 'CmdOrCtrl+C',
        role: 'copy'
    }, {
        label: '粘贴',
        accelerator: 'CmdOrCtrl+V',
        role: 'paste'
    }, {
        label: '全选',
        accelerator: 'CmdOrCtrl+A',
        role: 'selectall'
    }]
}, {
    label: '查看',
    submenu: [{
        label: '重载',
        accelerator: 'CmdOrCtrl+R',
        click: function (item, focusedWindow) {
            if (focusedWindow) {
                // 重载之后, 刷新并关闭所有的次要窗体
                if (focusedWindow.id === 1) {
                    BrowserWindow.getAllWindows().forEach(function (win) {
                        if (win.id > 1) {
                            win.close()
                        }
                    })
                }
                focusedWindow.reload()
            }
        }
    }, {
        label: '切换全屏',
        accelerator: (function () {
            if (process.platform === 'darwin') {
                return 'Ctrl+Command+F'
            } else {
                return 'F11'
            }
        })(),
        click: function (item, focusedWindow) {
            if (focusedWindow) {
                focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
            }
        }
    }, {
        label: '切换开发者工具',
        accelerator: (function () {
            if (process.platform === 'darwin') {
                return 'Alt+Command+I'
            } else {
                return 'Ctrl+Shift+I'
            }
        })(),
        click: function (item, focusedWindow) {
            if (focusedWindow) {
                focusedWindow.toggleDevTools()
            }
        }
    }, {
        type: 'separator'
    }, {
        label: '应用程序菜单演示',
        click: function (item, focusedWindow) {
            if (focusedWindow) {
                const options = {
                    type: 'info',
                    title: '应用程序菜单演示',
                    buttons: ['好的'],
                    message: '此演示用于 "菜单" 部分, 展示如何在应用程序菜单中创建可点击的菜单项.'
                }
                electron.dialog.showMessageBox(focusedWindow, options, function () {
                })
            }
        }
    }]
}, {
    label: '窗口',
    role: 'window',
    submenu: [{
        label: '最小化',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize'
    }, {
        label: '关闭',
        accelerator: 'CmdOrCtrl+W',
        role: 'close'
    }, {
        type: 'separator'
    }, {
        label: '重新打开窗口',
        accelerator: 'CmdOrCtrl+Shift+T',
        enabled: false,
        key: 'reopenMenuItem',
        click: function () {
            app.emit('activate')
        }
    }, {
        label: '修改配置',
        click: function () {
            app.emit('edit_config')
        }
    }]
}, {
    label: '帮助',
    role: 'help',
    submenu: [{
        label: '学习更多',
        click: function () {
            electron.shell.openExternal('http://electron.atom.io')
        }
    }]
}]

function addUpdateMenuItems(items, position) {
    if (process.mas) return

    const version = app.getVersion()
    let updateItems = [{
        label: `Version ${version}`,
        enabled: false
    }, {
        label: '正在检查更新',
        enabled: false,
        key: 'checkingForUpdate'
    }, {
        label: '检查更新',
        visible: false,
        key: 'checkForUpdate',
        click: function () {
            require('electron').autoUpdater.checkForUpdates()
        }
    }, {
        label: '重启并安装更新',
        enabled: true,
        visible: false,
        key: 'restartToUpdate',
        click: function () {
            require('electron').autoUpdater.quitAndInstall()
        }
    }]

    items.splice.apply(items, [position, 0].concat(updateItems))
}

function findReopenMenuItem() {
    const menu = Menu.getApplicationMenu()
    if (!menu) return

    let reopenMenuItem
    menu.items.forEach(function (item) {
        if (item.submenu) {
            item.submenu.items.forEach(function (item) {
                if (item.key === 'reopenMenuItem') {
                    reopenMenuItem = item
                }
            })
        }
    })
    return reopenMenuItem
}

if (process.platform === 'darwin') {
    const name = electron.app.getName()
    template.unshift({
        label: name,
        submenu: [{
            label: `关于 ${name}`,
            role: 'about'
        }, {
            type: 'separator'
        }, {
            label: '服务',
            role: 'services',
            submenu: []
        }, {
            type: 'separator'
        }, {
            label: `隐藏 ${name}`,
            accelerator: 'Command+H',
            role: 'hide'
        }, {
            label: '隐藏其它',
            accelerator: 'Command+Alt+H',
            role: 'hideothers'
        }, {
            label: '显示全部',
            role: 'unhide'
        }, {
            type: 'separator'
        }, {
            label: '退出',
            accelerator: 'Command+Q',
            click: function () {
                app.quit()
            }
        }]
    })

    // 窗口菜单.
    template[3].submenu.push({
        type: 'separator'
    }, {
        label: '前置所有',
        role: 'front'
    })

    addUpdateMenuItems(template[0].submenu, 1)
}

if (process.platform === 'win32') {
    const helpMenu = template[template.length - 1].submenu
    addUpdateMenuItems(helpMenu, 0)
}

function getUsersHomeFolder() {
    return osenv.home();
}

const workSpaceName = "super-markdown-editor";
const localConfDir = path.join(getUsersHomeFolder(), workSpaceName, ".local")
const workspaceDir = path.join(getUsersHomeFolder(), workSpaceName);
const imageSpaceDir = path.join(getUsersHomeFolder(), "super-markdown-editor", "image");
let editorConf = new EditorConf(localConfDir);
let shelfRedo = new ShelfRedo(workspaceDir, editorConf.conf.id);
let bookshelf = new Bookshelf(workspaceDir, shelfRedo);


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
        case 'config.editor.open':
            createConfigWindow();
            break
        case 'config.editor':
            result["data"] = {
                text: editorConf.getCnf(),
                name: "conf"
            }
            break
        case 'save_config.editor':
            editorConf.setCnf(req.body.data.text);
            break
    }
    res.send(JSON.stringify(result));
})

const httpServer = httpApp.listen(port, () => {
    log.info(`Example app listening at http://localhost:${port}`)
})

function createConfigWindow() {
    if (editWindows.hasOwnProperty("config")) {
        editWindows["config"].show();
    } else {
        let configWindow = new BrowserWindow({
            width: 1800,
            height: 900,
            webPreferences: {
                nodeIntegration: false,
            }
        });
        configWindow.loadURL('http://127.0.0.1:3000/config.html');
        configWindow.webContents.openDevTools()
        configWindow.on('closed', () => {
            delete editWindows["config"];
            log.debug(configWindow, "closed");
            configWindow = null;
        });
        editWindows["config"] = configWindow;
    }
}

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

});
app.on('edit_config', function () {
    createConfigWindow();
})
app.on('ready', function () {
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
})
app.on('browser-window-created', function () {
    let reopenMenuItem = findReopenMenuItem()
    if (reopenMenuItem) reopenMenuItem.enabled = false
})
// 除了 macOS 外，当所有窗口都被关闭的时候退出程序。 因此，通常对程序和它们在
// 任务栏上的图标来说，应当保持活跃状态，直到用户使用 Cmd + Q 退出。
app.on('window-all-closed', function () {
    let reopenMenuItem = findReopenMenuItem()
    if (reopenMenuItem) reopenMenuItem.enabled = true
    if (process.platform !== 'darwin') {
        app.quit()
    }
    httpServer.close((err) => {
        log.info('server closed')
        process.exit(err ? 1 : 0)
    })
})
