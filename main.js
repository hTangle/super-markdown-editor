const {app, BrowserWindow, Menu, MenuItem} = require('electron')
const path = require('path')
const log = require('electron-log');
const fs = require('fs');
const {v4: uuidv4} = require('uuid');
const osenv = require('osenv');
const BaseImage = require('./libs/base_image');
const BaseSync = require('./libs/base_sync');

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

// 使用 fs.readdir 来获取文件列表
function getFilesInFolder(folderPath, cb) {
    fs.readdir(folderPath, cb);
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

function ReadAllDirAndFile(parent_path) {
    var allDirs = [];
    var files = fs.readdirSync(parent_path, {withFileTypes: true})
    for (var i in files) {
        var name = files[i].name;
        var sub_path = path.join(parent_path, name);
        subObj = fs.statSync(sub_path);
        if (subObj.isFile() && name.endsWith(".md")) {
            allDirs.push({"type": "file", "text": name.replace(".md", "")})
        } else if (subObj.isDirectory() && !name.startsWith("image") && !name.startsWith(workSpaceConfLocalName)) {
            var childAllDirs = ReadAllDirAndFile(sub_path);
            if (childAllDirs.length > 0) {
                allDirs.push({"type": "default", "text": name, 'children': childAllDirs});
            } else {
                allDirs.push({"type": "default", "text": name});
            }

        }
    }
    return allDirs;
}

function getWorkDirFullPath(p) {
    return workspaceDir + splitStr + p;
}

function CreateDir(pathes) {
    sub_path = getWorkDirFullPath(pathes.join(splitStr))
    fs.mkdirSync(sub_path);
    obj = fs.statSync(sub_path);
    return obj.isDirectory();
}

function CreateFile(pathes) {
    pathes[pathes.length - 1] = pathes[pathes.length - 1] + ".md"
    sub_path = getWorkDirFullPath(pathes.join(splitStr))
    fs.closeSync(fs.openSync(sub_path, 'w'));
    obj = fs.statSync(sub_path);
    return obj.isFile();
}

function RenameDir(pathes, new_name) {
    new_sub_path = getWorkDirFullPath(pathes.join(splitStr))
    pathes[pathes.length - 1] = new_name
    old_sub_path = getWorkDirFullPath(pathes.join(splitStr))
    fs.renameSync(old_sub_path, new_sub_path)
}

function RenameFile(pathes, new_name) {
    pathes[pathes.length - 1] = pathes[pathes.length - 1] + ".md"
    new_sub_path = getWorkDirFullPath(pathes.join(splitStr))
    pathes[pathes.length - 1] = new_name + ".md"
    old_sub_path = getWorkDirFullPath(pathes.join(splitStr))
    fs.renameSync(old_sub_path, new_sub_path)
}

function ReadMarkdownFromFile(pathes) {
    pathes[pathes.length - 1] = pathes[pathes.length - 1] + ".md"
    sub_path = getWorkDirFullPath(pathes.join(splitStr))
    tmpData = fs.readFileSync(sub_path, {encoding: 'utf8', flag: 'r'})
    return tmpData
}

function WriteMarkdownFromFile(origin_path, data) {
    pathes = origin_path.join(splitStr) + ".md";
    sub_path = getWorkDirFullPath(pathes)
    fs.writeFile(sub_path, data, {encoding: 'utf8'}, (err) => {
        if (err) throw err;
        baseImageConf.checkImageShouldDelete(data, origin_path);
        console.log('The file has been saved!');
    });
    return tmpData
}


const express = require('express')
var bodyParser = require('body-parser');
var formidable = require('formidable')
const httpApp = express()
const port = 3000
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
    var form = new formidable.IncomingForm();   //创建上传表单
    form.keepExtensions = true;     //保留后缀
    form.maxFieldsSize = 2 * 1024 * 1024;   //文件大小
    form.uploadDir = imageSpaceDir;     //设置上传目录
    isSuccess = false;
    result = {
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
    result = {
        "status": "success",
        "command": req.body.command
    }
    switch (req.body.command) {
        case 'request-init-work-tree':
            GetOrCreateUserWorkSpace();
            result["data"] = WorkSpaceDirs;
            break
        case 'create_node.jstree':
            log.info("create_node.jstree")
            if (req.body.data.type === "default") {
                result["data"] = {
                    "created": CreateDir(req.body.data.path)
                }
            } else {
                result["data"] = {
                    "created": CreateFile(req.body.data.path)
                }
            }
            break
        case 'rename_node.jstree':
            log.info("rename_node.jstree")
            // TODO: rename should change image save info
            if (req.body.data.type === "default") {
                RenameDir(req.body.data.path, req.body.data.old)
            } else {
                RenameFile(req.body.data.path, req.body.data.old)
            }

            break
        case 'open.jstree':
            log.info("open.jstree")
            if (req.body.data.type === "file") {
                result["data"] = {
                    "text": ReadMarkdownFromFile(req.body.data.path),
                    "read": true,
                    "path": req.body.data.path.join(splitStr)
                }
            }
            break
        case 'save_markdown.jstree':
            log.info("save_markdown.jstree")
            if (req.body.data.origin_path) {
                WriteMarkdownFromFile(req.body.data.origin_path, req.body.data.text);
            }
            break

    }
    res.send(JSON.stringify(result));
})

const httpServer = httpApp.listen(port, () => {
    log.info(`Example app listening at http://localhost:${port}`)
})


function GetOrCreateUserWorkSpace() {
    if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, {recursive: true}, (err) => {
            if (err) throw err;
        });
        fs.mkdirSync(path.join(workspaceDir, "default"), {recursive: true}, (err) => {
            if (err) throw err;
        });
    }
    if (!fs.existsSync(imageSpaceDir)) {
        fs.mkdirSync(imageSpaceDir, {recursive: true}, (err) => {
            if (err) throw err;
        });
    }
    WorkSpaceDirs = ReadAllDirAndFile(workspaceDir);
    log.info(WorkSpaceDirs);
}

var appMenuTemplate = [
    {
        label: 'File',
        submenu: []
    },
    {
        label: 'Edit',
        submenu: [
            {
                role: 'undo'
            },
            {
                role: 'redo'
            },
            {
                type: 'separator'
            },
            {
                role: 'cut'
            },
            {
                role: 'copy'
            },
            {
                role: 'paste'
            },
            {
                role: 'pasteandmatchstyle'
            },
            {
                role: 'delete'
            },
            {
                role: 'selectall'
            }
        ]
    },
    {
        label: 'View',
        submenu: [
            {
                role: 'reload'
            },
            {
                role: 'forcereload'
            },
            {
                role: 'toggledevtools'
            },
            {
                type: 'separator'
            },
            {
                role: 'resetzoom'
            },
            {
                role: 'zoomin'
            },
            {
                role: 'zoomout'
            },
            {
                type: 'separator'
            },
            {
                role: 'togglefullscreen'
            }
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'Home Page'
            }
        ]
    }
];


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
    const menu = Menu.buildFromTemplate(appMenuTemplate); //从模板创建主菜单
    menu.items[0].submenu.append(new MenuItem({ //menu.items获取是的主菜单一级菜单的菜单数组，menu.items[0]在这里就是第1个File菜单对象，在其子菜单submenu中添加新的子菜单
        label: "New",
        click() {
            mainWindow.webContents.send('action', 'new'); //点击后向主页渲染进程发送“新建文件”的命令
        },
        accelerator: 'CmdOrCtrl+N' //快捷键：Ctrl+N
    }));
    //在New菜单后面添加名为Open的同级菜单
    menu.items[0].submenu.append(new MenuItem({
        label: "Open",
        click() {
            mainWindow.webContents.send('action', 'open'); //点击后向主页渲染进程发送“打开文件”的命令
        },
        accelerator: 'CmdOrCtrl+O' //快捷键：Ctrl+O
    }));
    //再添加一个名为Save的同级菜单
    menu.items[0].submenu.append(new MenuItem({
        label: "Save",
        click() {
            mainWindow.webContents.send('action', 'save'); //点击后向主页渲染进程发送“保存文件”的命令
        },
        accelerator: 'CmdOrCtrl+S' //快捷键：Ctrl+S
    }));
    //添加一个分隔符
    menu.items[0].submenu.append(new MenuItem({
        type: 'separator'
    }));
    //再添加一个名为Exit的同级菜单
    menu.items[0].submenu.append(new MenuItem({
        role: 'quit'
    }));
    Menu.setApplicationMenu(menu); //注意：这个代码要放到菜单添加完成之后，否则会造成新增菜单的快捷键无效
    // GetOrCreateUserWorkSpace();
    // mainWindow.webContents.send('action', {'command': 'init-work-tree', 'data': WorkSpaceDirs});

}

// 这段程序将会在 Electron 结束初始化
// 和创建浏览器窗口的时候调用
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        // 通常在 macOS 上，当点击 dock 中的应用程序图标时，如果没有其他
        // 打开的窗口，那么程序会重新创建一个窗口。
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
