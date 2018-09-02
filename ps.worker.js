/**
 * @property {String} parent
 * @typedef {Object} FSPath
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

/**
 * @param {Module.Segmentation} segmentation
 */
function segToArray(segmentation) {
    var output = [];
    for (var i = 0 ; i < segmentation.size() ; i++)
        output.push({
            'word': Utf8Decode(segmentation.get(i).word),
            'start': segmentation.get(i).start,
            'end': segmentation.get(i).end
        });
    return output;
};

var Module = typeof Module !== 'undefined' ? Module : {};

var BUFFER,
    RECOGNIZER,
    SEGMENTATION;

const _grammarPointers = [];

/**
 * Incoming signal dispatcher
 * @param {Event} e
 */
self.onmessage = (e) => {
    if (e.data.loadLib) startLoading();
    else if (e.data.loadPs) loadPs(e.data.loadPs);
    else if (e.data.lazyLoad) lazyLoad(e.data.lazyLoad.folders, e.data.lazyLoad.files);
    else if (e.data.addWords) addWords(e.data.addWords);
    else if (e.data.addGrammars) addGrammars(e.data.addGrammars);
    else if (e.data.start) start(e.data.start);
    else if (e.data.stop) stop(e.data.stop);
    else if (e.data.recognize) recognize(e.data.recognize);
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
var logger = new Logger()

function dispatch(message) {
    self.postMessage(message);
}

function checkRecognizer() {
    if(!RECOGNIZER) {
        dispatch({success: false, error: "Recognizer is not initialized."});
        return false;
    }

    return true;
}

var RETURNTYPES;

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
        var SUCCESS = Module.ReturnType.SUCCESS,
            BAD_STATE = Module.ReturnType.BAD_STATE,
            BAD_ARGUMENT = Module.ReturnType.BAD_ARGUMENT,
            RUNTIME_ERROR = Module.ReturnType.RUNTIME_ERROR;
        RETURNTYPES = {
            SUCCESS : 'SUCCESS',
            BAD_STATE: 'BAD_STATE',
            BAD_ARGUMENT: 'BAD_ARGUMENT',
            RUNTIME_ERROR: 'RUNTIME_ERROR'
        }

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

    if (Array.isArray(args)) {
        args.forEach(function(arg) {
            config.push_back([arg.key, arg.value]);
        });
    }

    var code;
    if(RECOGNIZER) {
        code = RECOGNIZER.reInit(config);
        if(code == Module.ReturnType.SUCCESS) dispatch({success: true});
        else dispatch({success: false, error: `Can't init Recognizer, ${RETURNTYPES[code]}`});
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
    if(!checkRecognizer()) return;

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
    if(!checkRecognizer()) return;

    logger.debug('Adding words.');
    var wordsVector = new Module.VectorWords();
    words.forEach(function(word) {
        wordsVector.push_back([Utf8Encode(word.word), word.pronunciation]);
    });

    var code = RECOGNIZER.addWords(wordsVector);
    if(code == Module.ReturnType.SUCCESS) dispatch({success: true});
    else dispatch({success: false, error: "Can't add given words list"});
    logger.debug('Deleting wordsVector');
    wordsVector.delete();
}

/**
 * Manually add grammar to the recognizer
 * @param {Grammar[]|Grammar} grammars
 */
function addGrammars(grammars) {
    if(!checkRecognizer()) return;

    if(!Array.isArray(grammars)) grammars = [grammars];

    grammars.forEach(function(grammar) {
        var transitions = new Module.VectorTransitions();
        var idVector = new Module.Integers();

        grammar.transitions.forEach(function(transition) {
            transition.word = Utf8Encode( transition.word || '' );
            transition.logp = transition.logp || 0;
            transitions.push_back(transition);
        });
        grammar.transitions = transitions;

        logger.debug('Adding grammar', grammar);
        var code = RECOGNIZER.addGrammar(idVector, grammar);
        _grammarPointers.push(idVector.get(0));
        logger.debug('Grammar added returned pointer', idVector.get(0));
        if(code == Module.ReturnType.SUCCESS) dispatch({success: true});
        else dispatch({success: false, error: "Can't add grammar to the list"});
        transitions.delete();
        idVector.delete();
    });

    logger.debug('Finished adding grammars');
}

/**
 * Starts up listenning process of the recognizer
 * @param {Number} grammarIdx Index of the added grammar
 */
function start(grammarIdx) {
    grammarIdx = parseInt(grammarIdx || 0);
    if(!checkRecognizer()) return;

    let code = RECOGNIZER.switchSearch(_grammarPointers[grammarIdx]);
    if (code != Module.ReturnType.SUCCESS) {
        dispatch({success: false, error: "Can't switch grammar"});
        return;
    }

    code = RECOGNIZER.start();
    if (code != Module.ReturnType.SUCCESS) dispatch({success: false, error: `Can't start listenning, ${RETURNTYPES[code]}`});
    else dispatch({success: true});
}

/**
 * Stops recognizer.
 */
function stop() {
    if(!checkRecognizer()) return;

    let code = RECOGNIZER.stop();
    if (code != Module.ReturnType.SUCCESS) dispatch({success: false, error: `Can't stop recognizer, ${RETURNTYPES[code]}`});
    else dispatch({success: true});
}

function recognize(arrayBuffer) {
    let audioData = new Int16Array(arrayBuffer);
    while(BUFFER.size() < audioData.length) BUFFER.push_back(0);

    for (let i = 0; i < audioData.length; ++i) BUFFER.set(i, audioData[i]);
    let code = RECOGNIZER.process(BUFFER);
    if (code != Module.ReturnType.SUCCESS) dispatch({success: false, error: `Error processing the audio, ${RETURNTYPES[code]}`});
    else {
        RECOGNIZER.getHypseg(SEGMENTATION);
        let result = {
            hypothesis: Utf8Decode(RECOGNIZER.getHyp()),
            hypothesisSegment: segToArray(SEGMENTATION)
        }
        dispatch(result);
    }
}