const path = require('path')
const BaseUtil = require('./base_util');
const fs = require('fs');
const log = require('electron-log');
const ActionType = require('./redo_action');
const AWS = require('aws-sdk');
const {S3Client, ListObjectsV2Command, ListObjectsV2CommandInput, GetObjectCommand} = require("@aws-sdk/client-s3");

class SyncAws {
    constructor(conf) {
        this.editor_conf = conf;
        if (this.#shouldInitAws()) {
            this.#initAws();
        } else {
            this.has_aws = false;
        }
    }

    #initAws() {
        this.has_aws = true;
        AWS.config.update({
            accessKeyId: this.editor_conf.conf.cnf.sync.access_key_id,
            secretAccessKey: this.editor_conf.conf.cnf.sync.secret_access_key,
            region: this.editor_conf.conf.cnf.sync.region,
            endpoint: this.editor_conf.conf.cnf.sync.endpoint,
        });
        this.bucket = this.editor_conf.conf.cnf.sync.bucket;
        this.s3 = new AWS.S3({apiVersion: '2006-03-01'});
        this.s3Client = new S3Client({
            credentials: {
                accessKeyId: this.editor_conf.conf.cnf.sync.access_key_id,
                secretAccessKey: this.editor_conf.conf.cnf.sync.secret_access_key
            },
            accessKeyId: this.editor_conf.conf.cnf.sync.access_key_id,
            secretAccessKey: this.editor_conf.conf.cnf.sync.secret_access_key,
            region: this.editor_conf.conf.cnf.sync.region,

            endpoint: this.editor_conf.conf.cnf.sync.endpoint,
            apiVersion: '2006-03-01'
        })
    }

    #shouldInitAws() {
        return this.editor_conf.conf.cnf.access_key_id !== "" &&
            this.editor_conf.conf.cnf.secret_access_key !== "" &&
            this.editor_conf.conf.cnf.region !== "" &&
            this.editor_conf.conf.cnf.endpoint !== "" &&
            this.editor_conf.conf.cnf.bucket !== "";
    }

    uploadObjectToS3(file_path, target_path) {
        if (!this.has_aws) {
            return
        }
        let uploadParams = {
            Bucket: this.bucket,
            Key: target_path,
            Body: ''
        };
        let fileStream = fs.createReadStream(file_path);
        fileStream.on('error', function (err) {
            log.warn('File Error', err);
        });
        uploadParams.Body = fileStream;
        this.s3.upload(uploadParams, function (err, data) {
            if (err) {
                log.warn("Error", err);
            }
            if (data) {
                log.warn("Upload Success", data.Location);
            }
        });
    }

    listObjectsInS3(prefix) {
        if (this.has_aws) {
            let params = {
                Bucket: this.bucket,
                Prefix: prefix
            }
            this.s3.listObjectsV2(params, function (err, data) {
                if (err) {
                    log.error(err);
                } else {
                    data.Contents.forEach((value => {
                        log.warn("key:", value.Key, " Size:", value.Size);
                    }));
                }
            });
        } else {
            log.error("please init aws before use");
        }
    }

    // async downloadS3ObjectSync(save_full_path, key) {
    //     try {
    //         const params = {
    //             Bucket: this.bucket,
    //             Key: key
    //         }
    //         const {Body} = await this.s3.getObject(params);
    //     }
    //
    //     // try {
    //     //     const params = {
    //     //         Bucket: this.bucket,
    //     //         Key: key
    //     //     }
    //     //     const data = await this.s3.getObject(params).promise();
    //     //     return data.Body.toString();
    //     // }
    // }

    async downloadObjectSync(prefix, key, workspace) {
        if (!this.has_aws) {
            return
        }
        log.info("start to download object: ", key);
        try {
            const {Body} = await this.s3Client.send(new GetObjectCommand({
                Bucket: this.bucket,
                Key: key
            }))
            let save_full_path = path.join(workspace, prefix, key.replaceAll(prefix + "/", ""));
            log.info("save", key, "to", save_full_path);
            await Body.pipe(fs.createWriteStream(save_full_path)).on('error', err => {
                log.error(err);
            }).on('close', () => {
                log.info("close stream");
            })
            // const bodyContents = await streamToString(Body);
            // fs.writeFile(save_full_path,)
        } catch (e) {
            log.error(e)
        }
    }

    async downloadImageSync(prefix, key, workspace) {

    }

    async listObjectsInS3ToPull(prefix, workspace) {
        if (!this.has_aws || prefix === "" || prefix.endsWith("/")) {
            return
        }
        log.info("start to list object", prefix);
        try {
            let data = await this.s3Client.send(new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: prefix,
                MaxKeys: 10000
            }));
            for (const value of data.Contents) {
                log.warn("key:", value.Key, " Size:", value.Size);
                await this.downloadObjectSync(prefix, value.Key, workspace);
            }
        } catch (err) {
            log.error(err);
        }
        log.info("end to list object");
    }

    downloadObjectInS3(key, redo_point) {
        if (!this.has_aws) {
            return
        }
        let params = {
            Bucket: this.bucket,
            Key: key
        }
        this.s3.getObject(params, function (err, data) {
            if (err) {
                redo_point.setGlobalAgeFromObject(err, data);
            } else {
                log.info("data", data.Metadata)
                redo_point.setGlobalAgeFromObject(err, data);
            }
        })
    }
}

class ShelfRedo {
    static #REDO_PATH = "redo";
    static #GLOBAL_AGE_FILE = "global.age.json";
    static #GLOBAL_AGE_OBJECT_KEY = ShelfRedo.#REDO_PATH + "/" + ShelfRedo.#GLOBAL_AGE_FILE;
    static #SUB_FILE_PATH = ["book", "note", "image"];
    static #CHANGE_CONF = "change";

    constructor(workdir, conf) {
        this.workdir = workdir;
        this.editor_conf = conf;
        this.redo_path = path.join(workdir, ShelfRedo.#REDO_PATH, conf.conf.id);
        this.redo_sync_path = path.join(workdir, ShelfRedo.#REDO_PATH);
        this.global_age_file = path.join(workdir, ShelfRedo.#REDO_PATH, ShelfRedo.#GLOBAL_AGE_FILE);
        BaseUtil.createDirIfNotExist(this.redo_path);
        this.age = 0;
        this.#initLocalAge();
        this.sync_aws = new SyncAws(conf);
        this.#getGlobalAgeFromLocal();
    }

    /**
     * 初次从远程同步信息
     *      需要同步的信息：
     *          book/
     *          note/
     *          image/
     *          redo/global.age.json
     */
    async firstPullFromRemote() {
        for (const value of ShelfRedo.#SUB_FILE_PATH) {
            log.info("try to sync", value);
            await this.sync_aws.listObjectsInS3ToPull(value, this.workdir);
        }
        await this.sync_aws.downloadObjectSync("redo", "redo/global.age.json", this.workdir);
        log.info("get all message successful!");
    }

    syncObjectsWithContents(contents) {
        contents.forEach((value) => {
            log.warn("key:", value.Key, " Size:", value.Size);

        })
    }


    listObjectsInBucket() {
        this.sync_aws.listObjectsInS3ToPull("", this.workdir).then(r => {
        });
    }

    #getGlobalAgeFromLocal() {
        /**
         * global_age中的age表示同步
         *   初始值为1，如果当前的global_age=1,则表明可以同步，
         *      同步的过程为，创建一个{age}.json表示修改的文件，
         *          然后将age.json上传到云端，
         *          然后再将需要同步的内容上传到s3
         *          最后将global_age+1,并将内容上传到云端
         */
        if (fs.existsSync(this.global_age_file)) {
            this.global_age = JSON.parse(fs.readFileSync(this.global_age_file, 'utf8'));
            this.tryToSyncGlobalAgeObject().then(() => this.global_age = JSON.parse(fs.readFileSync(this.global_age_file, 'utf8')));
        } else {
            // try to sync from remote
            this.tryToSyncGlobalAgeObject().then(() => {
                log.info("sync from remote done");
                this.firstPullFromRemote().then(() => this.global_age = JSON.parse(fs.readFileSync(this.global_age_file, 'utf8')));
            })//todo
            this.global_age = {
                age: 0,
                the_client_before_last_client: "",
                last_client: ""
            }
        }

    }

    async tryToSyncGlobalAgeObject() {
        log.debug("try to sync global age object");
        await this.sync_aws.downloadObjectSync(ShelfRedo.#REDO_PATH, ShelfRedo.#GLOBAL_AGE_OBJECT_KEY, this.workdir);
    }

    tryToGetGlobalAgeObject() {

    }

    writeGlobalAgeToLocal() {
        fs.writeFileSync(this.global_age_file, JSON.stringify(this.global_age), {encoding: 'utf8'});
    }

    writeGlobalAgeToRemote() {
        // TODO: callback function handle upload failed
        this.sync_aws.uploadObjectToS3(this.global_age_file, ShelfRedo.#GLOBAL_AGE_OBJECT_KEY);
    }


    setGlobalAgeFromObject(err, data) {
        if (!err) {
            log.info("data", data.Body.toString('utf-8'));
            this.global_age = JSON.parse(data.Body.toString('utf-8'));
            this.writeGlobalAgeToLocal();
        } else if (err.statusCode === 404) {
            log.error("global age file does not exist in remote, should init first");
            this.global_age.age = 1;
            this.global_age.last_client = this.editor_conf.conf.id;
            this.writeGlobalAgeToLocal();
            this.writeGlobalAgeToRemote();
        } else {
            log.error("redo: ", err)
        }
    }

    writeRedoLog(data) {
        fs.appendFile(this.getAgeFilePath(), JSON.stringify(data) + "\n", {encoding: 'utf8'}, (err) => {
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
                let cur_age = Number(name.replaceAll(".history", "").split("-")[1]);
                if (cur_age > this.age) {
                    this.age = cur_age;
                    max_age_file_name = name;
                }
            }
        });
        if (max_age_file_name !== "") {
            if (max_age_file_name.endsWith("history")) {
                this.age = Number(this.age) + 1;
            } else {
                let subObj = fs.statSync(path.join(this.redo_path, max_age_file_name));
                if (subObj.size >= 1024 * 1024) {
                    log.debug("redo log file size great than 1MB, change a new file to write");
                    this.age = Number(this.age) + 1;
                }
            }
        }
        log.debug("set current age=", this.age)
        this.age_file = path.join(this.redo_path, "redo-" + this.age);
    }

    getAgeFilePath() {
        return this.getAgeFilePathByAge(this.age);
    }

    getAgeFilePathByAge(current_age) {
        return path.join(this.redo_path, "redo-" + current_age);
    }

    startSyncToS3() {
        this.tryToSyncGlobalAgeObject();
        let changes = this.getChangeLog();
        if (!changes.hasOwnProperty("actions")) {
            log.info("get changed log failed!", JSON.stringify(changes));
            return false;
        }
        log.info("start to save changes to age.json");
        changes["id"] = this.editor_conf.id;
        changes["time"] = Date.now();
        // write changes to file
        let save_changes_path = path.join(this.redo_sync_path, this.global_age.age + ".json");
        fs.writeFileSync(save_changes_path, JSON.stringify(changes), {encoding: 'utf8'});
        this.sync_aws.uploadObjectToS3(save_changes_path, ShelfRedo.#REDO_PATH + "/" + this.global_age.age + ".json");
        ShelfRedo.#SUB_FILE_PATH.forEach(value => {
            Object.keys(changes.actions[value]).forEach(value_ => {
                let file_path = path.join(this.workdir, value, value_);
                let target_path = value + "/" + value_;
                log.info("sync ", file_path, " to ", target_path);
                this.sync_aws.uploadObjectToS3(file_path, target_path);
            })
        });
        this.global_age.age += 1;
        this.global_age.the_client_before_last_client = this.global_age.last_client;
        this.global_age.last_client = this.editor_conf.conf.id;
        log.info("this.global_age ", JSON.stringify(this.global_age));
        this.writeGlobalAgeToLocal();
        this.writeGlobalAgeToRemote();
        // todo make local change to history
        this.setChangeLogsFinished(changes.min_age, changes.max_age);
    }

    setChangeLogsFinished(min_age, max_age) {
        for (let i = min_age; i <= max_age; i++) {
            let current_path = path.join(this.redo_path, "redo-" + i);
            if (fs.existsSync(current_path)) {
                log.info("rename ", current_path, " to  history");
                fs.renameSync(current_path, current_path + ".history");
            }
        }
        if (max_age >= this.age) {
            this.age = max_age + 1;
            log.info("set current age to", this.age);
        }
    }

    //如果需要同步，
    getChangeLog() {
        //读取所有的change
        let min_age_file_name = this.age + 1;
        fs.readdirSync(this.redo_path, {withFileTypes: true}).forEach((value => {
            let name = value.name;
            let subObj = fs.statSync(path.join(this.redo_path, name));
            if (subObj.isFile() && name.startsWith("redo") && !name.endsWith("history")) {
                min_age_file_name = Math.min(name.split("-")[1], min_age_file_name);
            }
        }));
        let max_age_file_name = this.age;
        if (max_age_file_name >= min_age_file_name) {
            // this.age++;
            log.info("try to sync from " + min_age_file_name + " to " + max_age_file_name);
            return {
                actions: this.genChangeLogs(min_age_file_name, max_age_file_name),
                max_age: max_age_file_name,
                min_age: min_age_file_name
            };
        }
        return {
            max_age: max_age_file_name,
            min_age: min_age_file_name
        }
    }

    genChangeLogs(min_age, max_age) {
        let action_arr = {
            book: {},
            note: {},
            image: {}
        }
        for (let i = min_age; i <= max_age; i++) {
            this.genChangeLog(i, action_arr);
        }
        log.warn("get change log arr: ", JSON.stringify(action_arr, null, 2));
        return action_arr;
    }

    genChangeLog(current_age, action_arr) {
        let age_file_path = this.getAgeFilePathByAge(current_age);
        if (fs.existsSync(age_file_path)) {
            let data = fs.readFileSync(age_file_path, "utf-8");
            const lines = data.split(/\r?\n/);
            lines.forEach((line) => {
                if (!line.includes("type")) {
                    return
                }
                log.debug("read line: ", line);
                let act = JSON.parse(line);
                if (act) {
                    switch (act.type) {
                        case ActionType.TYPE_BOOK:
                            action_arr.book[act.id] = {
                                action: act.action,
                                update_time: act.update_time
                            };
                            break;
                        case ActionType.TYPE_NOTE:
                            action_arr.note[act.id] = {
                                action: act.action,
                                update_time: act.update_time
                            }
                            break;
                        case ActionType.TYPE_IMAGE:
                            action_arr.image[act.id] = {
                                action: act.action,
                                update_time: act.update_time
                            }
                            break;
                    }
                }
            });
        }
    }
}

module.exports = ShelfRedo;
