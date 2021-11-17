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
const BaseHttpServer = require('./libs/base_http_server');
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
let baseHttpServer = new BaseHttpServer(imageSpaceDir, splitStr, baseImageConf, baseAppConf, baseFileHandler);

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
    baseHttpServer.http_server.close((err) => {
        log.info('server closed')
        process.exit(err ? 1 : 0)
    })
})
