let psjs = (function() {
    'use strict';
    /**
     * @typedef {Object} FSPath
     * @property {String} parent
     * @property {String} name
     * @property {Boolean} canRead
     * @property {Boolean} canWrite
     */

    /**
     * @typedef {Object} FSLazyFile
     * @property {String} parent
     * @property {String} name
     * @property {String} url
     * @property {Boolean} canRead
     * @property {Boolean} canWrite
     */

    /**
     * @typedef {Object} ConfigItem
     * @property {String} key
     * @property {String} value
     */

    if(!window.Worker) throw Error("This module can't be used without Worker API.");
    let PS;

    /**
     * Generate a Promise object for simple promise reponses.
     * @param {String} errorMessage Message for the Error object to be used while rejecting.
     */
    let responseFactory = (errorMessage) => {
        return new Promise( (res, rej) => {
            PS.onmessage = (e) => {
                if (e.data.success) {
                    res(e.data.payload || true);
                }

                rej(new Error(errorMessage));
            }

            PS.onerror = (e) => {
                rej(new Error(errorMessage));
            }
        });
    }

    /**
     * Sends signal to load WASM code for PS.
     */
    let initLib = () => {
        PS = new Worker('ps.worker.js');
        PS.postMessage({loadlib: true});
        return responseFactory("Can't load library");
    };

    /**
     * Loads the PS library and triggers recognizer init.
     * @param {ConfigItem} args
     */
    let init = (args) => {
        if(!PS) throw Error("Run initLib first");
        PS.postMessage({loadps: {args}});
        return responseFactory("Can't load library");
    };

    /**
     * Preloads necessary files
     * @param {FSPath} folders
     * @param {FSLazyFile} files
     */
    let lazyLoad = (folders, files) => {
        if(!PS) throw Error("Run initLib first");
        PS.postMessage({lazyload: {folders, files}});
        return responseFactory("Can't attach files to file system.");
    }

    return {
        initLib,
        init,
        lazyLoad
    }

}());