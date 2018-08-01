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

var Module = typeof Module !== 'undefined' ? Module : {};

var buffer;

self.onmessage = (e) => {
    if (e.data.loadlib) {
        startLoading();
    }

    if (e.data.loadps) {
        loadPs(e.data.loadps);
    }
}

function Logger() {
    this.now = function () {
        let n = new Date();

        return `${n.getFullYear()}/${n.getMonth()}/${n.getDay()} ${n.getHours()}:${n.getMinutes()}:${n.getSeconds()}.${n.getMilliseconds()}\t`
    }

    this.debug = function () {
        let msg = [];
        msg.push(this.now());
        for(arg of arguments) msg.push(arg);

        console.log.apply(this, msg);
    }
}
const logger = new Logger()

function dispatch(message) {
    self.postMessage(message);
}

function startLoading() {
    logger.debug('Starting runtime init')

    if(!Module['preRun']) Module['preRun'] = [];

    Module['locateFile'] = () => {
        return './vendor/pocketsphinx.wasm';
    };

    Module['onRuntimeInitialized'] = () => {
        logger.debug('Runtime initialized')
        dispatch({success: true})
    };

    importScripts('./vendor/pocketsphinx.js');
}

/**
 * Initialize PS
 * @param {ConfigItem} args
 */
function loadPs(args) {
    logger.debug('Loading PS', args);
    var config = new Module.Config();
    logger.debug('Creating buffer');
    buffer = new Module.AudioBuffer();

    dispatch({success: true});
    config.delete();
    logger.debug('Config destroyed');
}

/**
 * @param {FSPath[]} folders
 * @param {FSLazyFile[]} files
 */
function lazyLoad(folders, files) {
    function preloadFiles() {
        folders.forEach(function(folder) {
            logger.debug('Lazy loading path', folder.name);
            Module['FS_createPath'](folder.parent, folder.name, folder.canRead || true, folder.canWrite || true);
        });

        files.forEach(function(file) {
            logger.debug('Lazy loading file', file.name);
            Module['FS_createLazyFile'](file.parent, file.name, file.url, file.canRead || true, file.canWrite || true);
        });
    }
    logger.debug('Lazy loading payload');
    if(Module['calledRun']) {
        preloadFiles();
    } else {
        Module['preRun'].push(preloadFiles);
    }
    logger.debug('Lazy loading ends.');
    dispatch({success: true});
}