const path = require('path')
const BaseUtil = require('./base_util');
const fs = require('fs');
const log = require('electron-log');

class ShelfRedo {
    static #REDO_PATH = "redo";
    static #CHANGE_CONF = "change";

    constructor(workdir, id) {
        this.workdir = workdir;
        this.redo_path = path.join(workdir, ShelfRedo.#REDO_PATH, id);
        BaseUtil.createDirIfNotExist(this.redo_path);
        this.age = 0;
        this.#initLocalAge();
    }

    writeRedoLog(data) {
        fs.appendFile(this.age_file, JSON.stringify(data) + "\n", {encoding: 'utf8'}, (err) => {
            if (err) throw err;
        });
    }

    #initLocalAge() {
        let files = fs.readdirSync(this.redo_path, {withFileTypes: true})
        let max_age_file_name = "";
        files.forEach((value, index) => {
            let name = value.name;
            let sub_path = path.join(this.redo_path, name);
            let subObj = fs.statSync(sub_path);
            if (subObj.isFile() && name.startsWith("redo")) {
                let cur_age = name.split("-")[1];
                if (cur_age > this.age) {
                    this.age = cur_age;
                    max_age_file_name = name;
                }
            }
        });
        if (max_age_file_name !== "") {
            if (max_age_file_name.endsWith("history")) {
                this.age = this.age + 1;
            } else {
                let subObj = fs.statSync(path.join(this.redo_path, max_age_file_name));
                if (subObj.size >= 1024 * 1024) {
                    log.debug("redo log file size great than 1MB, change a new file to write");
                    this.age = this.age + 1;
                }
            }
        }
        log.debug("set current age=", this.age)
        this.age_file = path.join(this.redo_path, "redo-" + this.age);
    }
    //如果需要同步，
    getChangeLog(){

    }
}

module.exports = ShelfRedo;
