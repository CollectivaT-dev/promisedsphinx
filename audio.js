let AudioProcessor = (function (Context, Processor, _dispatch, _store, _dispatchingTaskId) {
    'use strict';
    if (!window.AudioContext) throw Error("This module can't be used without AudioContext API.");

    let init = function init() {
        _store = [];
        try {
            Context = new AudioContext();
            Processor = Context.createScriptProcessor(4096, 1, 1);
            Processor.onaudioprocess = function(processorEvent) {
                _store.push(processorEvent.inputBuffer.getChannelData(0));
            };
            return Promise.resolve(AudioProcessor);
        } catch (e) {
            return Promise.reject(Error("Can't initialize audio context"));
        }
    }

    /**
     * Dispatches stored audio buffers one by one
     */
    let dispatchAudio = function dispatchAudio() {
        const QUEUE_LENGTH = 10;
        if (_store.length > QUEUE_LENGTH) {
            let nextBuffer = _store.shift();
            let concated = new Float32Array(nextBuffer.length * QUEUE_LENGTH);
            for (let j = 0; j < nextBuffer.length; ++j)
                concated[j] = nextBuffer[j];
            for (let i = 1; i < QUEUE_LENGTH; ++i) {
                for (let j = 0; j < nextBuffer.length; ++j)
                    concated[j + i * nextBuffer.length] = nextBuffer[j];
            }
            _dispatch(concated);
        }

        _dispatchingTaskId = requestAnimationFrame(dispatchAudio);
    }

    /**
     * @param {Function} dispatcher Data dispatch handler that sends data to the worker and accepts Float32Array and a props object.
     */
    let mic = function mic(dispatcher) {
        return navigator.mediaDevices.getUserMedia({audio: true})
        .then(function (stream) {
            let source = Context.createMediaStreamSource(stream);
            source.connect(Processor);
            Processor.connect(Context.destination);
            _dispatch = dispatcher;
            _dispatchingTaskId = requestAnimationFrame(dispatchAudio);
            return AudioProcessor;
        });
    }

    return {
        init,
        mic
    }
})();