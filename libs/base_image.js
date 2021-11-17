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
        let full_path = this.config_base_path + this.split_str + paths.join(this.split_str)
        if (fs.existsSync(full_path)) {
            log.debug("image conf dir exists:", full_path);
            let tmpData = fs.readFileSync(full_path, {encoding: 'utf8', flag: 'r'});
            if (tmpData) {
                let cnf = JSON.parse(tmpData);
                let changed = false;
                for (let k in cnf) {
                    if (!content.includes("![](/image/" + k + ")")) {
                        log.debug("![](/image/" + k + ") should be deleted");
                        cnf[k] = 0;
                        changed = true;
                    }
                }
                if (changed) {
                    fs.writeFile(full_path, JSON.stringify(cnf), {encoding: 'utf8'}, (err) => {
                        if (err) throw err;
                        console.log('The file has been saved!', full_path);
                    })
                }
            }
            return true
        } else {
            log.debug("image conf dir not exists:", full_path);
            return false
        }
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
        let full_path = this.config_base_path + this.split_str + paths.join(this.split_str)
        if (fs.existsSync(full_path)) {
            log.debug("image conf dir exists:", full_path);
            let tmpData = fs.readFileSync(full_path, {encoding: 'utf8', flag: 'r'});
            if (tmpData) {
                let cnf = JSON.parse(tmpData);
                cnf[imageName] = 1;
                fs.writeFile(full_path, JSON.stringify(cnf), {encoding: 'utf8'}, (err) => {
                    if (err) throw err;
                    console.log('The file has been saved!', full_path);
                })
            }
        } else {
            log.debug("image conf dir not exists:", full_path," try to create a new one");
            if (paths.length > 1) {
                let dir_path = this.config_base_path + this.split_str + paths.slice(0, paths.length - 1).join(this.split_str);
                if (!fs.existsSync(dir_path)) {
                    fs.mkdirSync(dir_path, {recursive: true})
                }
            }
            fs.writeFile(full_path, JSON.stringify({[imageName]: 1}), {encoding: 'utf8'}, (err) => {
                if (err) throw err;
                console.log('The file has been saved!', full_path);
            });

        }
    }
}
module.exports = BaseImage;
