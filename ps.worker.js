var Module;
if (typeof Module === 'undefined') Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');

var buffer;

self.onmessage = (e) => {
    if (e.data.loadlib) {
        startLoading();
    }

    if (e.data.loadps) {
        loadPs();
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

    Module.locateFile = () => {
        return './vendor/pocketsphinx.wasm';
    };

    Module.onRuntimeInitialized = () => {
        logger.debug('Runtime initialized')
        dispatch({success: true})
    };

    importScripts('./vendor/pocketsphinx.js');
}

function loadPs() {
    logger.debug('Loading PS');
    var config = new Module.Config();
    logger.debug('Creating buffer');
    buffer = new Module.AudioBuffer();

    dispatch({success: true});
    config.delete();
    logger.debug('Config destroyed');
}

function lazyLoad(folders, files) {
    function preloadFiles() {

    }
}