const BaseUtil = require('./base_util');
const fs = require('fs');
const path = require('path')
const log = require('electron-log');
const readline = require('readline');
const RedoAction = require('./redo_action');

class ChangeCentury {
    constructor() {
        this.century = [];
        this.step = 0;
        this.addNewCentury();
    }

    addNewCentury() {
        this.century.push({
            delete: {},
            update: {},
            create_dir: {},
            rename_dir: {}
        });
        this.step = this.century.length - 1;
    }

    addNewAction(act) {
        switch (act.action) {
            case RedoAction.SAVE_ARTICLE:
                this.century[this.step].update[JSON.stringify(act.path)] = 1;
                break
            case RedoAction.SAVE_IMAGE:
                this.century[this.step].update[JSON.stringify(act.path)] = 1;
                break;
            case RedoAction.RENAME_DIR:
            case RedoAction.RENAME_ARTICLE:
            case RedoAction.CREATE_DIR:
        }
    }


}

class BaseRedoLog {
    static #REDO_PATH = "redo";
    static #CHANGE_CONF = "change";

    constructor(conf_global) {
        this.redo_log_path = path.join(conf_global, BaseRedoLog.#REDO_PATH);
        this.change_conf_path = path.join(conf_global, BaseRedoLog.#CHANGE_CONF);
        BaseUtil.createDirIfNotExist(this.redo_log_path);
        BaseUtil.createDirIfNotExist(this.change_conf_path);
        this.age = 0;
        this.age_file = "";
        this.#initLocalAge();
    }

    writeRedoLog(data) {
        fs.writeFile(this.age_file, JSON.stringify(data) + "\n", {encoding: 'utf8'}, (err) => {
            if (err) throw err;
        });
    }

    #initLocalAge() {
        // read age from this.redo_log_path
        let files = fs.readdirSync(this.redo_log_path, {withFileTypes: true})
        let max_age_file_name = "";
        for (let i in files) {
            let name = files[i].name;
            let sub_path = path.join(this.redo_log_path, name);
            let subObj = fs.statSync(sub_path);
            if (subObj.isFile() && name.startsWith("redo")) {
                let cur_age = name.split("-")[1];
                if (cur_age > this.age) {
                    this.age = cur_age;
                    max_age_file_name = name;
                }
            }
        }
        if (max_age_file_name !== "") {
            if (max_age_file_name.endsWith("history")) {
                this.age = this.age + 1;
            } else {
                let subObj = fs.statSync(path.join(this.redo_log_path, max_age_file_name));
                if (subObj.size >= 1024 * 1024) {
                    log.debug("redo log file size great than 1MB, change a new file to write");
                    this.age = this.age + 1;
                }
            }
        }
        log.debug("set current age=", this.age)
        this.age_file = path.join(this.redo_log_path, "redo-" + this.age);
    }

    //
    genChangeLog() {
        let files = fs.readdirSync(this.redo_log_path, {withFileTypes: true});
        let current_age_file = "redo-" + this.age;
        let from_age = this.age;
        let to_age = this.age;
        files.forEach((value, key) => {
            let name = value.name;
            if (name === current_age_file) {
                this.age += 1;
                this.age_file = path.join(this.redo_log_path, "redo-" + this.age);
            }
            let sub_path = path.join(this.redo_log_path, name);
            let subObj = fs.statSync(sub_path);
            if (subObj.isFile() && name.startsWith("redo")) {
                let cur_age = name.split("-")[1];
                if (cur_age <= this.age && from_age > cur_age) {
                    from_age = cur_age;
                }
            }
        });
        //read all the change
        // 将修改分为两部分，第一部分是文件内容的修改，这个地方只需要同步文件即可，第二部分是对文件属性的修改（重命名，删除，移动，创建目录）
        let change_century = [{
            delete: [],
            update: [],
            create_dir: [],
            rename_dir: []
        }];
        for (let age = from_age; age <= to_age; age++) {
            let current_age_file = path.join(this.redo_log_path, "redo-" + age);
            let rl = readline.createInterface({
                input: fs.createReadStream(current_age_file)
            });
            rl.on('line', (line) => {
                console.log(line);
                let act = JSON.parse(line);
                if (act) {
                    switch (act.action) {
                        case RedoAction.SAVE_ARTICLE:

                        case RedoAction.SAVE_IMAGE:
                            change_log.update.push(act.path);
                            break;
                        case RedoAction.RENAME_DIR:
                        case RedoAction.RENAME_ARTICLE:
                        case RedoAction.CREATE_DIR:
                    }
                }
            });
        }
    }
}

module.exports = BaseRedoLog;
