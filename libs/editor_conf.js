const BaseUtil = require('./base_util');
const fs = require('fs');
const path = require('path');
const {v4: uuidv4} = require('uuid');

class EditorConf {
    static CONF_FILE_NAME = "editor.json";
    static CONF_ID_NAME = "id.json";

    constructor(conf_dir) {
        this.conf_dir = conf_dir;
        BaseUtil.createDirIfNotExist(this.conf_dir);
        this.conf_path = path.join(this.conf_dir, EditorConf.CONF_FILE_NAME);
        this.id_path = path.join(this.conf_dir, EditorConf.CONF_ID_NAME);
        this.#initConf();
    }

    #initConf() {
        this.conf = {
            id: "",
            cnf: {}
        };
        if (fs.existsSync(this.id_path)) {
            this.conf.id = fs.readFileSync(this.id_path, {encoding: 'utf8', flag: 'r'})
        } else {
            this.conf.id = uuidv4();
            fs.writeFile(this.id_path, this.conf.id, {encoding: 'utf8'}, (err) => {
                if (err) throw err;
            })
        }
        if (fs.existsSync(this.conf_path)) {
            this.conf.cnf = JSON.parse(fs.readFileSync(this.conf_path, {encoding: 'utf8', flag: 'r'}))
        } else {
            this.conf.cnf = {
                sync: {
                    access_key_id: "",
                    secret_access_key: "",
                    region: "",
                    endpoint: "",
                    bucket: ""
                }
            }
            fs.writeFile(this.conf_path, JSON.stringify(this.conf.cnf), {encoding: 'utf8'}, (err) => {
                if (err) throw err;
            })
        }
    }

    getCnf() {
        return JSON.stringify(this.conf.cnf, null, 4);
    }

    setCnf(cnf) {
        this.conf.cnf = JSON.parse(cnf);
        this.saveConf();
    }

    saveConf() {
        fs.writeFile(this.conf_path, JSON.stringify(this.conf.cnf, null, 4), {encoding: 'utf8'}, (err) => {
            if (err) throw err;
        })
    }
}

module.exports = EditorConf
