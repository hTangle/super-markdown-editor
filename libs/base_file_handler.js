const fs = require('fs');
const path = require('path')
const osenv = require('osenv');
const log = require('electron-log');

class BaseFileHandler {
    constructor(work_space_name, conf_local, conf_global, split_str, base_app_conf, base_image_conf) {
        this.work_space_name = work_space_name;
        this.conf_local = conf_local;
        this.conf_global = conf_global;
        this.split_str = split_str;
        this.work_space_dir = path.join(osenv.home(), work_space_name);
        this.work_conf_local = path.join(osenv.home(), work_space_name, conf_local);
        this.work_conf_global = path.join(osenv.home(), work_space_name, conf_global);
        this.image_space_dir = path.join(osenv.home(), "super-markdown-editor", "image");
        this.base_app_conf = base_app_conf;
        this.base_image_conf = base_image_conf;
    }

    GetOrCreateUserWorkSpace() {
        if (!fs.existsSync(this.work_space_dir)) {
            fs.mkdirSync(this.work_space_dir, {recursive: true}, (err) => {
                if (err) throw err;
            });
            fs.mkdirSync(path.join(this.work_space_dir, "default"), {recursive: true}, (err) => {
                if (err) throw err;
            });
        }
        if (!fs.existsSync(this.image_space_dir)) {
            fs.mkdirSync(this.image_space_dir, {recursive: true}, (err) => {
                if (err) throw err;
            });
        }
        let WorkSpaceDirs = this.ReadAllDirAndFile(this.work_space_dir);
        log.info(WorkSpaceDirs);
        return WorkSpaceDirs;
    }

    ReadAllDirAndFile(parent_path) {
        let allDirs = [];
        let files = fs.readdirSync(parent_path, {withFileTypes: true})
        for (let i in files) {
            let name = files[i].name;
            let sub_path = path.join(parent_path, name);
            let subObj = fs.statSync(sub_path);
            if (subObj.isFile() && name.endsWith(".md")) {
                allDirs.push({"type": "file", "text": name.replace(".md", "")})
            } else if (subObj.isDirectory() && !name.startsWith("image") && !name.startsWith(this.conf_local) && !name.startsWith(".")) {
                let childAllDirs = this.ReadAllDirAndFile(sub_path);
                if (childAllDirs.length > 0) {
                    allDirs.push({"type": "default", "text": name, 'children': childAllDirs});
                } else {
                    allDirs.push({"type": "default", "text": name});
                }

            }
        }
        return allDirs;
    }

    getWorkDirFullPath(p) {
        return this.work_space_dir + this.split_str + p;
    }

    CreateDir(paths) {
        let sub_path = this.getWorkDirFullPath(paths.join(this.split_str))
        fs.mkdirSync(sub_path);
        let obj = fs.statSync(sub_path);
        if (obj.isDirectory()) {
            this.base_app_conf.createDir(paths);
            return true;
        } else {
            return false;
        }
    }

    CreateFile(paths) {
        paths[paths.length - 1] = paths[paths.length - 1] + ".md";
        let sub_path = this.getWorkDirFullPath(paths.join(this.split_str));
        fs.closeSync(fs.openSync(sub_path, 'w'));
        let obj = fs.statSync(sub_path);
        if (obj.isFile()) {
            this.base_app_conf.saveArticle(paths);
            return true;
        } else {
            return false;
        }
    }

    RenameDir(paths, old_name) {
        let new_sub_path = this.getWorkDirFullPath(paths.join(this.split_str));
        paths[paths.length - 1] = old_name;
        let old_sub_path = this.getWorkDirFullPath(paths.join(this.split_str))
        fs.renameSync(old_sub_path, new_sub_path);
        this.base_app_conf.renameDir(old_name, paths);
    }

    RenameFile(paths, old_name) {
        paths[paths.length - 1] = paths[paths.length - 1] + ".md"
        let new_sub_path = this.getWorkDirFullPath(paths.join(this.split_str))
        paths[paths.length - 1] = old_name + ".md"
        let old_sub_path = this.getWorkDirFullPath(paths.join(this.split_str))
        fs.renameSync(old_sub_path, new_sub_path)
        this.base_app_conf.renameArticle(old_name, paths);
    }

    ReadMarkdownFromFile(paths) {
        paths[paths.length - 1] = paths[paths.length - 1] + ".md"
        let sub_path = this.getWorkDirFullPath(paths.join(this.split_str))
        return fs.readFileSync(sub_path, {encoding: 'utf8', flag: 'r'})
    }

    WriteMarkdownFromFile(origin_path, data) {
        let paths = origin_path.join(this.split_str) + ".md";
        let sub_path = this.getWorkDirFullPath(paths);
        fs.writeFile(sub_path, data, {encoding: 'utf8'}, (err) => {
            if (err) throw err;
            this.base_image_conf.checkImageShouldDelete(data, origin_path);
            console.log('The file has been saved!');
        });
        this.base_app_conf.saveArticle(origin_path);
    }
}

module.exports = BaseFileHandler;
