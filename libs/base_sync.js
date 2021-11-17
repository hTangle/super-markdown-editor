/**
 * 记录那些文件被修改了
 * 包括：
 *      文档
 *      图片
 * 我们标记每次修改为一次age，则修改记录就是一个数组
 * [
 * {
 * "age":11,
 * "changed":{
 *     "text":{
 *         "hello":1,
 *         "hello-delete":0
 *     },
 *     "image":{}
 * }
 * }
 * ]
 */
const fs = require('fs');
const path = require('path');
const log = require('electron-log');
const BaseUtil = require('./base_util');
const AWS = require('aws-sdk');

class BaseSync {
    static #SYNC_CONF_NAME = "sync.conf.json";

    constructor(conf_local, conf_global, split_str) {
        this.conf_local = conf_local;
        this.conf_global = conf_global;
        this.split_str = split_str;
        BaseUtil.createDirIfNotExist(this.conf_local);
        BaseUtil.createDirIfNotExist(this.conf_global);
        this.#initLocalConf();
        this.#initGlobalConf();
    }

    /**
     * read age from conf_local
     */
    #initLocalConf() {
        this.local_conf_path = this.conf_local + this.split_str + BaseSync.#SYNC_CONF_NAME;
        this.conf = BaseUtil.readDataFromFile(this.local_conf_path, {
            age: 0,
            access_key_id: "",
            secret_access_key: "",
            bucket: "",
            region: "",
            endpoint: ""
        })
        if (this.conf.access_key_id !== "" && this.conf.secret_access_key !== "") {
            AWS.config.update({
                accessKeyId: this.conf.access_key_id,
                secretAccessKey: this.conf.secret_access_key,
                region: this.conf.region,
                endpoint: this.conf.endpoint,
            });
            this.bucket = this.conf.bucket;
            this.s3 = new AWS.S3({apiVersion: '2006-03-01'});
        }
    }

    #initGlobalConf() {
        this.global_conf_path = this.conf_global + this.split_str + BaseSync.#SYNC_CONF_NAME;
        // TODO: first should sync from remote
        // if read default global_conf, then the remote global_conf does not exist
        // which means that all the local change should sync to remote
        // we should set the age=0
        this.global_conf = BaseUtil.readDataFromFile(this.global_conf_path, {
            age: 0
        })
    }

    uploadFile() {
        let uploadParams = {Bucket: this.bucket, Key: '', Body: ''};
        let file = this.conf_local + this.split_str + "test.txt";
        let fileStream = fs.createReadStream(file);
        fileStream.on('error', function (err) {
            log.warn('File Error', err);
        });
        uploadParams.Body = fileStream;
        uploadParams.Key = path.basename(file);
        this.s3.upload(uploadParams, function (err, data) {
            if (err) {
                log.warn("Error", err);
            }
            if (data) {
                log.warn("Upload Success", data.Location);
            }
        });
    }
}

module.exports = BaseSync;
