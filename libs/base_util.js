const fs = require('fs');
const path = require('path');
const log = require('electron-log');

class BaseUtil {
    static APP_NAME = "super-markdown-editor";

    static createDirIfNotExist(p) {
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p, {recursive: true});
        }
    }

    static writeDataToFile(file_path, data) {
        fs.writeFile(file_path, data, {encoding: 'utf8'}, (err) => {
            if (err) throw err;
            log.error('The file has been saved!', file_path);
        })
    }

    static readDataFromFile(file_path, default_data) {
        if (fs.existsSync(file_path)) {
            return fs.readFileSync(file_path, {encoding: 'utf8', flag: 'r'});
        } else {
            return default_data;
        }
    }
}

module.exports = BaseUtil;
