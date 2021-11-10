/**
 * 需要存储图片，而且需要在保存的时候，清理图片
 * 存储图片的配置在{workspace}/.config_local/.image/config.json
 * 为了防止需要加载的json字符串太大，我们只对每个次级顶级命名空间下的文件保存到一个json中
 *
 */
const fs = require('fs');
const path = require('path');
const log = require('electron-log');
class BaseImage {
    constructor(save_path, config_base_path, split_str) {
        this.save_path = save_path;
        this.split_str = split_str;
        this.config_base_path = config_base_path + split_str + ".image";
        if (!fs.existsSync(this.config_base_path)) {
            log.debug("should create image config base dir:", this.config_base_path);
            fs.mkdirSync(this.config_base_path, {recursive: true});
        }
        this.full_info = {};
    }

    /**
     * 检查需要保存的note中有没有图片不需要保存，如果不需要保存则将其标记为0
     * @param content
     * @param paths
     */
    checkImageShouldDelete(content, paths) {
        if (!paths) {
            return false
        }
        let key = "";
        let index = 0;
        if (paths.length === 2) {
            key = paths[0];
            index = 1;
        } else if (paths.length > 2) {
            key = paths[0] + "##" + paths[1];
            index = 2;
        } else {
            return false;
        }
        if (this.readConfigFromFile(key)) {
            let ck = paths.slice(index).join("##");
            let shouldSave = false;
            if (ck in this.full_info[key]) {
                for (var k in this.full_info[key][ck]) {
                    if (!content.includes("![](/image/" + k + ")")) {
                        log.debug("![](/image/" + k + ") should be deleted");
                        this.full_info[key][ck][k] = 0;
                        shouldSave = true;
                    }
                }
            }
            if (shouldSave) {
                log.debug("try to sync [" + key + "] to disk");
                this.syncConfigToDisk(key);
            }
        } else {
            return false;
        }
    }

    readConfigFromFile(config_key) {
        if (!(config_key in this.full_info)) {
            let config_key_full_path = this.config_base_path + this.split_str + config_key + ".json";
            log.debug("config full path", config_key_full_path);
            if (!fs.existsSync(config_key_full_path)) {
                log.debug("create config file of", config_key_full_path);
                fs.writeFileSync(config_key_full_path, JSON.stringify({}), {encoding: 'utf8'});
                this.full_info[config_key] = {};
                return true
            }
            // path should exist, or some error should happened before
            let tmpData = fs.readFileSync(config_key_full_path, {encoding: 'utf8', flag: 'r'})
            if (tmpData) {
                this.full_info[config_key] = JSON.parse(tmpData);
            } else {
                this.full_info[config_key] = {};
            }
        }
        log.debug("[" + config_key + "] already in mem");
        return true;
    }

    syncConfigToDisk(config_key) {
        fs.writeFile(this.config_base_path + this.split_str + config_key + ".json", JSON.stringify(this.full_info[config_key]), {encoding: 'utf8'}, (err) => {
            if (err) throw err;
            console.log('The file has been saved!', config_key);
        });
    }

    /**
     * 保存图片的时候调用该函数
     * @param imageName
     * @param paths
     * @returns {boolean}
     */
    saveImage(imageName, paths) {
        //check paths
        if (!paths) {
            return false
        }
        let key = "";
        let index = 0;
        if (paths.length === 2) {
            key = paths[0];
            index = 1;
        } else if (paths.length > 2) {
            key = paths[0] + "##" + paths[1];
            index = 2;
        } else {
            return false;
        }
        if (this.readConfigFromFile(key)) {
            let ck = paths.slice(index).join("##");
            if (!(ck in this.full_info[key])) {
                this.full_info[key][ck] = {}
            }
            this.full_info[key][ck][imageName] = 1;
            this.syncConfigToDisk(key);
        } else {
            return false;
        }
    }
}
module.exports = BaseImage;
