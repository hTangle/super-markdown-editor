const express = require('express');
const bodyParser = require('body-parser');
const formidable = require('formidable');
const log = require('electron-log');


class BaseHttpServer {
    constructor(image_space_dir, split_str, base_image_conf, base_app_conf, base_file_handler) {
        this.image_space_dir = image_space_dir;
        this.split_str = split_str;
        this.base_image_conf = base_image_conf;
        this.base_app_conf = base_app_conf;
        this.base_file_handler = base_file_handler;
        this.http_port = 3000;
        this.#init();
    }

    #init() {
        this.http_app = express();
        this.http_app.use(express.static("public"));
        this.http_app.use('/image', express.static(this.image_space_dir));
        this.http_app.use(bodyParser.json({limit: '10mb'}));
        this.http_app.use(bodyParser.urlencoded({            //此项必须在 bodyParser.json 下面,为参数编码
            extended: true
        }))
        this.http_app.post("/upload/image", (req, res) => {
            let form = new formidable.IncomingForm();   //创建上传表单
            form.keepExtensions = true;     //保留后缀
            form.maxFieldsSize = 2 * 1024 * 1024;   //文件大小
            form.uploadDir = this.image_space_dir;     //设置上传目录
            let isSuccess = false;
            let result = {
                "message": "success",
                "success": 0
            }
            form.parse(req, function (err, fields, files) {
                if (err) {
                    res.locals.error = err;
                    return;
                }

                isSuccess = true
                result["success"] = 1
                result["url"] = "/image/" + files["editormd-image-file"].newFilename;
                if (fields["open_file_path"]) {
                    let image_path = JSON.parse(fields["open_file_path"]);
                    this.base_image_conf.saveImage(files["editormd-image-file"].newFilename, image_path);
                    this.base_app_conf.uploadImage(files["editormd-image-file"].newFilename, image_path);
                }
                res.send(JSON.stringify(result));
            });
        })
        this.http_app.post('/message', (req, res) => {
            log.info(JSON.stringify(req.body));
            let result = {
                "status": "success",
                "command": req.body.command
            }
            switch (req.body.command) {
                case 'request-init-work-tree':
                    result["data"] = this.base_file_handler.GetOrCreateUserWorkSpace();
                    break
                case 'create_node.jstree':
                    log.info("create_node.jstree")
                    if (req.body.data.type === "default") {
                        result["data"] = {
                            "created": this.base_file_handler.CreateDir(req.body.data.path)
                        }
                    } else {
                        result["data"] = {
                            "created": this.base_file_handler.CreateFile(req.body.data.path)
                        }
                    }
                    break
                case 'rename_node.jstree':
                    log.info("rename_node.jstree")
                    // TODO: rename should change image save info
                    if (req.body.data.type === "default") {
                        this.base_file_handler.RenameDir(req.body.data.path, req.body.data.old)
                    } else {
                        this.base_file_handler.RenameFile(req.body.data.path, req.body.data.old)
                    }

                    break
                case 'open.jstree':
                    log.info("open.jstree")
                    if (req.body.data.type === "file") {
                        result["data"] = {
                            "text": this.base_file_handler.ReadMarkdownFromFile(req.body.data.path),
                            "read": true,
                            "path": req.body.data.path.join(this.split_str)
                        }
                    }
                    break
                case 'save_markdown.jstree':
                    log.info("save_markdown.jstree")
                    if (req.body.data.origin_path) {
                        this.base_file_handler.WriteMarkdownFromFile(req.body.data.origin_path, req.body.data.text);
                    }
                    break

            }
            res.send(JSON.stringify(result));
        })
        this.http_server = this.http_app.listen(this.http_port, () => {
            log.info(`Example app listening at http://localhost:${this.http_port}`);
        })
    }
}

module.exports = BaseHttpServer;
