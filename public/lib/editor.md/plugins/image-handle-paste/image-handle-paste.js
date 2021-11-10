(function () {
    var factory = function (exports) {
        var $ = jQuery;           // if using module loader(Require.js/Sea.js).
        var pluginName = "image-handle-paste";  // 定义插件名称
        //图片粘贴上传方法
        exports.fn.imagePaste = function () {
            var _this = this;
            var cm = _this.cm;
            var settings = _this.settings;
            // var editor      = _this.editor;
            var classPrefix = _this.classPrefix;
            var id = _this.id;
            if (!settings.imageUpload || !settings.imageUploadURL) {
                console.log('你还未开启图片上传或者没有配置上传地址');
                return false;
            }
            //监听粘贴板事件
            $('#' + id).on('paste', function (e) {
                var items = (e.clipboardData || e.originalEvent.clipboardData).items;
                //判断图片类型
                if (items && items[0].type.indexOf('image') > -1) {
                    var file = items[0].getAsFile();
                    var forms = new FormData(); //Filename
                    forms.set(classPrefix + "image-file", file, "file_" + Date.parse(new Date()) + ".png"); // 文件
                    if (open_file_path) {
                        forms.append("open_file_path", JSON.stringify(open_file_path));
                    }
                    _ajax(settings.imageUploadURL, forms, function (ret) {
                        if (ret.success === 1) {
                            editor.insertValue("![](" + ret.url + ")");
                        }
                        console.log(ret.message);
                    })
                }
            })
        };
        // ajax上传图片 可自行处理
        var _ajax = function (url, data, callback) {
            $.ajax({
                "type": 'post',
                "cache": false,
                "url": url,
                "data": data,
                "dateType": "json",
                "processData": false,
                "contentType": false,
                "mimeType": "multipart/form-data",
                success: function (ret) {
                    callback(JSON.parse(ret));
                },
                error: function (err) {
                    console.log('请求失败')
                }
            })
        }
    };
    // CommonJS/Node.js
    if (typeof require === "function" && typeof exports === "object" && typeof module === "object") {
        module.exports = factory;
    } else if (typeof define === "function")  // AMD/CMD/Sea.js
    {
        if (define.amd) { // for Require.js
            define(["editormd"], function (editormd) {
                factory(editormd);
            });
        } else { // for Sea.js
            define(function (require) {
                var editormd = require("./../../editormd");
                factory(editormd);
            });
        }
    } else {
        factory(window.editormd);
    }
})();
