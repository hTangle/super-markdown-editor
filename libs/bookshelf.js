/**
 *
 */
const fs = require('fs');
const path = require('path')
const osenv = require('osenv');
const log = require('electron-log');
const BaseUtil = require('./base_util');

class Bookshelf {
    static #NOTE_DIR = "note";
    static #BOOK_DIR = "book";

    constructor(workdir) {
        this.workdir = workdir;
        this.book_path = path.join(workdir, Bookshelf.#BOOK_DIR);
        this.note_path = path.join(workdir, Bookshelf.#NOTE_DIR);
        BaseUtil.createDirIfNotExist(this.book_path);
        BaseUtil.createDirIfNotExist(this.note_path);
        this.shelf = Map;
        this.id_name_mapping = {};
        this.id_info = {};
        this.root_node = {};
        this.#initData();
    }

    #initData() {
        // read all data in book
        let files = fs.readdirSync(this.book_path, {withFileTypes: true});
        files.forEach((value, index) => {
            let shelf_info = JSON.parse(fs.readFileSync(path.join(this.book_path, value.name), {
                encoding: 'utf8',
                flag: 'r'
            }));
            let shelf_id = value.name;
            this.id_info[shelf_id] = shelf_info;
            if (shelf_info.parent_id !== "") {
                if (!this.id_name_mapping.hasOwnProperty(shelf_info.parent_id)) {
                    this.id_name_mapping[shelf_info.parent_id] = {};
                }
                this.id_name_mapping[shelf_info.parent_id][shelf_id] = true;
            } else {
                this.root_node[shelf_id] = true;
            }

        });
        this.#initWelcomeData();
    }

    addIdNameMapping(parent_id, id) {
        if (parent_id.length > 10) {
            if (!this.id_name_mapping.hasOwnProperty(parent_id)) {
                this.id_name_mapping[parent_id] = {};
            }
            this.id_name_mapping[parent_id][id] = true;
        } else {
            this.root_node[id] = true;
        }

    }

    #initWelcomeData() {
        let welcome_data = "### 关于 Editor.md\n" +
            "### 主要特性\n" +
            "- 支持“标准”Markdown / CommonMark和Github风格的语法，也可变身为代码编辑器；\n" +
            "- 支持实时预览、图片（跨域）上传、预格式文本/代码/表格插入、代码折叠、搜索替换、只读模式、自定义样式主题和多语言语法高亮等功能；\n" +
            "- 支持ToC（Table of Contents）、Emoji表情、Task lists、@链接等Markdown扩展语法；\n" +
            "- 支持TeX科学公式（基于KaTeX）、流程图 Flowchart 和 时序图 Sequence Diagram;\n" +
            "- 支持识别和解析HTML标签，并且支持自定义过滤标签解析，具有可靠的安全性和几乎无限的扩展性；\n" +
            "- 支持 AMD / CMD 模块化加载（支持 Require.js & Sea.js），并且支持自定义扩展插件；\n" +
            "- 兼容主流的浏览器（IE8+）和Zepto.js，且支持iPad等平板设备；\n" +
            "- 支持自定义主题样式；";
        if (Object.keys(this.root_node).length === 0) {
            this.addNewBook("", "00000000-0000-0000-0000-000000000000", "default");
            this.addNewNote("00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000001", "welcome");
            this.writeNote("00000000-0000-0000-0000-000000000001", welcome_data);
            this.root_node["00000000-0000-0000-0000-000000000000"] = true;
            this.id_name_mapping["00000000-0000-0000-0000-000000000000"] = "00000000-0000-0000-0000-000000000001";
        }
    }

    generateShowTrees() {
        let trees = this.generateShowTree(this.root_node);
        log.debug("get tree:", JSON.stringify(trees));
        return trees
    }

    generateShowTree(root_nodes) {
        log.debug("get tree:", JSON.stringify(root_nodes));
        let tree = [];
        log.debug(JSON.stringify(this.id_name_mapping));
        for (let key in root_nodes) {
            log.debug("current node:", key);
            if (this.id_info[key].type === "file") {
                tree.push({"type": "file", "text": this.id_info[key].show_name, "id": key});
            } else if (this.id_name_mapping.hasOwnProperty(key)) {
                log.debug(JSON.stringify(this.id_name_mapping[key]));
                let childrenTree = this.generateShowTree(this.id_name_mapping[key]);
                if (childrenTree.length > 0) {
                    tree.push({
                        "type": "default",
                        "text": this.id_info[key].show_name,
                        "id": key,
                        'children': childrenTree
                    });
                } else {
                    tree.push({"type": "default", "text": this.id_info[key].show_name, "id": key});
                }
            } else if (this.id_info.hasOwnProperty(key)) {
                tree.push({"type": "default", "text": this.id_info[key].show_name, "id": key});
            } else {
                log.error(key, "not exit in", JSON.stringify(this.id_name_mapping));
            }
        }
        return tree;
    }

    renameBook(id, new_name) {
        this.id_info[id].show_name = new_name;
        this.id_info[id].update_time = Date.now();
        this.syncChangeToDisk(id);
    }

    addNewBook(parent_id, id, show_name) {
        this.id_info[id] = {
            parent_id: parent_id,
            show_name: show_name,
            id: id,
            type: "default",
            update_time: Date.now(),
            create_time: Date.now(),
        }
        this.syncChangeToDisk(id);
        this.addIdNameMapping(parent_id, id);
    }

    addNewNote(parent_id, id, show_name) {
        this.id_info[id] = {
            parent_id: parent_id,
            show_name: show_name,
            id: id,
            type: "file",
            update_time: Date.now(),
            create_time: Date.now(),
        }
        this.syncChangeToDisk(id);
        this.writeNote(id, "");
        this.addIdNameMapping(parent_id, id);
    }

    renameNote(id, new_name) {
        this.id_info[id].show_name = new_name;
        this.id_info[id].update_time = Date.now();
        this.syncChangeToDisk(id);
    }

    readNote(id) {
        return fs.readFileSync(this.getIdContentPath(id), {encoding: 'utf8', flag: 'r'})
    }

    writeNote(id, content) {
        // TODO: mark file changed
        fs.writeFile(this.getIdContentPath(id), content, {encoding: 'utf8'}, (err) => {
            if (err) throw err;
            // TODO: check image should delete
            console.log('The file has been saved! ' + id);
        });
    }

    syncChangeToDisk(id) {
        // TODO: mark file changed
        fs.writeFile(this.getIdSyncPath(id), JSON.stringify(this.id_info[id]), {encoding: 'utf8'}, (err) => {
            if (err) throw err;
            log.error('The file has been saved!', this.getIdSyncPath(id));
        });
    }

    getIdSyncPath(id) {
        return path.join(this.book_path, id);
    }

    getIdContentPath(id) {
        return path.join(this.note_path, id);
    }
}

module.exports = Bookshelf;
