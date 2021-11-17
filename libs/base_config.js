const BaseUtil = require('./base_util');
const uuid = require("uuid");
const log = require('electron-log');

class RedoAction {
    static SAVE_IMAGE = "save_image";
    static SAVE_ARTICLE = "save_article";
    static RENAME_ARTICLE = "rename_article";
    static RENAME_DIR = "rename_dir";
    static CREATE_DIR = "create_dir";
}

class BaseConfig {
    static #BASE_CONF_NAME = "base.conf.json";
    static #ACTION_SAVE_PATH = "action/redo.log";

    constructor(conf_local, conf_global, split_str) {
        this.conf_local = conf_local;
        this.conf_global = conf_global;
        this.split_str = split_str;
        BaseUtil.createDirIfNotExist(this.conf_local);
        BaseUtil.createDirIfNotExist(this.conf_global);
        this.#initBaseConfLocal();
    }

    #initBaseConfLocal() {
        this.local_conf_path = this.conf_local + this.split_str + BaseConfig.#BASE_CONF_NAME;
        this.conf = JSON.parse(BaseUtil.readDataFromFile(this.local_conf_path, JSON.stringify({
            age: 0,
            uid: uuid.v4(),
            init: true
        })));
        this.global_current_device_conf_path = this.conf_global + this.split_str + this.conf["uid"];
        this.logger = log.create('base-config');
        this.logger.transports.console.format = '{text}';
        this.logger.transports.file.resolvePath = () => this.conf_global + this.split_str + this.conf["uid"] + this.split_str + BaseConfig.#ACTION_SAVE_PATH;
        this.logger.transports.file.format = '{text}';
        this.logger.transports.file.maxSize = 1048576 * 20;
        if (this.conf.init) {
            // 需要将数据写入到conf_global
            BaseUtil.createDirIfNotExist(this.global_current_device_conf_path);
            this.conf.init = false;
            BaseUtil.writeDataToFile(this.local_conf_path, JSON.stringify(this.conf));
        }
    }

    // TODO: 每次保存文件的时候，需要先将当前的age+1，然后将文件内容，对应的图片内容，当前配置信息上传到服务端
    //  保存文件的正确步骤应该是：1. 拉去最新的配置 2. 将获取到的age+1，上传更新内容
    saveArticle(article_path) {
        this.logger.warn(JSON.stringify({
            action: RedoAction.SAVE_ARTICLE,
            path: article_path,
            time: Date.now()
        }));
    }

    uploadImage(imageName, paths) {
        this.logger.warn(JSON.stringify({
            action: RedoAction.SAVE_IMAGE,
            path: paths,
            image_name: imageName,
            time: Date.now()
        }));
    }

    renameArticle(old_article_name, new_article_name) {
        this.logger.warn(JSON.stringify({
            action: RedoAction.RENAME_ARTICLE,
            old_path: old_article_name,
            new_path: new_article_name,
            time: Date.now()
        }));
    }

    createDir(dir_path) {
        this.logger.warn(JSON.stringify({
            action: RedoAction.CREATE_DIR,
            path: dir_path,
            time: Date.now()
        }));
    }

    renameDir(old_dir_path, new_dir_path) {
        this.logger.warn(JSON.stringify({
            action: RedoAction.RENAME_DIR,
            old_path: old_dir_path,
            new_path: new_dir_path,
            time: Date.now()
        }));
    }

    deleteDir(dir_path) {

    }
}

module.exports = BaseConfig;
