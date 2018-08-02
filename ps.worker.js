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
 * We can not interact with emscripten using unicide strings
 * so we need to manually encode and decode them.
 * Thanks to:
 * https://gist.github.com/chrisveness/bcb00eb717e6382c5608
 *
 */

function Utf8Encode(strUni) {
    var strUtf = strUni.replace(
        /[\u0080-\u07ff]/g,  // U+0080 - U+07FF => 2 bytes 110yyyyy, 10zzzzzz
        function(c) {
            var cc = c.charCodeAt(0);
            return String.fromCharCode(0xc0 | cc>>6, 0x80 | cc&0x3f); }
    );
    strUtf = strUtf.replace(
        /[\u0800-\uffff]/g,  // U+0800 - U+FFFF => 3 bytes 1110xxxx, 10yyyyyy, 10zzzzzz
        function(c) {
            var cc = c.charCodeAt(0);
            return String.fromCharCode(0xe0 | cc>>12, 0x80 | cc>>6&0x3F, 0x80 | cc&0x3f); }
    );
    return strUtf;
}

function Utf8Decode(strUtf) {
    // note: decode 3-byte chars first as decoded 2-byte strings could appear to be 3-byte char!
    var strUni = strUtf.replace(
        /[\u00e0-\u00ef][\u0080-\u00bf][\u0080-\u00bf]/g,  // 3-byte chars
        function(c) {  // (note parentheses for precedence)
            var cc = ((c.charCodeAt(0)&0x0f)<<12) | ((c.charCodeAt(1)&0x3f)<<6) | ( c.charCodeAt(2)&0x3f);
            return String.fromCharCode(cc); }
    );
    strUni = strUni.replace(
        /[\u00c0-\u00df][\u0080-\u00bf]/g,                 // 2-byte chars
        function(c) {  // (note parentheses for precedence)
            var cc = (c.charCodeAt(0)&0x1f)<<6 | c.charCodeAt(1)&0x3f;
            return String.fromCharCode(cc); }
    );
    return strUni;
}

var Module = typeof Module !== 'undefined' ? Module : {};

var BUFFER,
    RECOGNIZER,
    SEGMENTATION;

/**
 * Incoming signal dispatcher
 * @param {Event} e
 */
self.onmessage = (e) => {
    if (e.data.loadLib) startLoading();
    else if (e.data.loadPs) loadPs(e.data.loadPs);
    else if (e.data.lazyLoad) lazyLoad(e.data.lazyLoad.folders, e.data.lazyLoad.files);
    else if (e.data.addWords) addWords(e.data.addWords);
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

/**
 * Loads PS and WASM code for PS
 */
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
 * @param {ConfigItem[]} args
 */
function loadPs(args) {
    logger.debug('Loading PS');
    var config = new Module.Config();
    logger.debug('Creating buffer');
    BUFFER = new Module.AudioBuffer();

    if (args) {
        args.forEach(function(arg) {
            config.push_back([arg.key, arg.value]);
        });
    }

    var code;
    if(RECOGNIZER) {
        code = RECOGNIZER.reInit(config);
        if (code == RECOGNIZER.ReturnType.BAD_STATE) dispatch({success: false, error: "Can't init Recognizer, BAD_STATE"});
        else if (code == RECOGNIZER.ReturnType.BAD_ARGUMENT) dispatch({success: false, error: "Can't init Recognizer, BAD_ARGUMENT"});
        else if (code == RECOGNIZER.ReturnType.RUNTIME_ERROR) dispatch({success: false, error: "Can't init Recognizer, RUNTIME_ERROR"});
        else dispatch({success: true});
    } else {
        logger.debug('Creating Recognizer');
        RECOGNIZER = new Module.Recognizer(config);
        logger.debug('Creating Segmentation');
        SEGMENTATION = new Module.Segmentation();

        if(RECOGNIZER === undefined) dispatch({success: false, error: "Can't init Recognizer, RUNTIME_ERROR"});
        else dispatch({success: true});
    }

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

/**
 * Manually add pronunciations to the recognizer
 * @param {Word[]} words
 */
function addWords(words) {
    if(!RECOGNIZER) {
        dispatch({success: false, error: "Recognizer is not initialized."});
        return;
    }

    logger.debug('Adding words.');
    var wordsVector = new Module.VectorWords();
    words.forEach(function(word) {
        wordsVector.push_back([Utf8Encode(word.word), word.pronunciation]);
    });

    var code = RECOGNIZER.addWords(wordsVector);
    if(code == RECOGNIZER.ReturnType.SUCCESS) dispatch({success: true});
    else dispatch({success: false, error: "Can't add given words list"});
    logger.debug('Deleting wordsVector');
    wordsVector.delete();
}