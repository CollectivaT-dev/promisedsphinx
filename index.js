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

    /**
     * @typedef {Object} Word
     * @property {String} word
     * @property {String} pronunciation
     */

     /**
     * @typedef {Object} Transition
     * @property {Number} from
     * @property {Number} to
     * @property {Number} logp
     * @property {String} word
     */

    /**
     * @typedef {Object} Grammar
     * @property {Number} start
     * @property {Number} end
     * @property {Number} numStates
     * @property {Transition[]} transitions
     */

    if(!window.Worker) throw Error("This module can't be used without Worker API.");
    let PS;

    /**
     * Generate a Promise object for simple promise responses.
     * @param {String} errorMessage Message for the Error object to be used while rejecting.
     */
    let responseFactory = (errorMessage) => {
        return new Promise( (res, rej) => {
            PS.onmessage = (e) => {
                if (e.data.success) {
                    res(e.data.payload || true);
                }

                if(e.data.success === false) {
                    rej(new Error(e.data.error));
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
        PS.postMessage({loadLib: true});
        return responseFactory("Can't load library");
    };

    /**
     * Loads the PS library and triggers recognizer init.
     * @param {ConfigItem} args
     */
    let init = (args) => {
        if(!PS) throw Error("Run initLib first");
        PS.postMessage({loadPs: args || true});
        return responseFactory("Can't load library");
    };

    /**
     * Preloads necessary files
     * @param {FSPath[]} folders
     * @param {FSLazyFile[]} files
     */
    let lazyLoad = (folders, files) => {
        if(!PS) throw Error("Run initLib first");
        PS.postMessage({lazyLoad: {folders, files}});
        return responseFactory("Can't attach files to file system.");
    }

    /**
     * Manually add words and pronunciations to the recognizer.
     * @param {Word[]} words
     */
    let addWords = function(words) {
        if(!PS) throw Error("Run initLib first");
        PS.postMessage({addWords: words});
        return responseFactory("Can't add words to the recognizer.");
    }

    /**
     * Manually add grammars to the recognizer.
     * @param {Grammar[]|Grammar} grammars
     */
    let addGrammars = function(grammars) {
        if(!PS) throw Error("Run initLib first");
        PS.postMessage({addGrammars: grammars});
        return responseFactory("Can't add grammars to the recognizer.");
    }

    return {
        initLib,
        init,
        lazyLoad,
        addWords,
        addGrammars
    }

}());