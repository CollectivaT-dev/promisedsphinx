let AudioProcessor = (function (Context, Processor, _dispatch) {
    'use strict';
    if (!window.AudioContext) throw Error("This module can't be used without AudioContext API.");

    let init = function init(psWorker) {
        try {
            Context = new AudioContext();
            Processor = Context.createScriptProcessor(4096, 1, 1);
            Processor.onaudioprocess = function(processorEvent) {
                _dispatch(processorEvent.inputBuffer.getChannelData(0));
            }
            return Promise.resolve(AudioProcessor);
        } catch (e) {
            return Promise.reject(Error("Can't initialize audio context"));
        }
    }

    /**
     * @param {Function} dispatcher Data dispatch handler that sends data to the worker accepts Float32Array.
     */
    let mic = function mic(dispatcher) {
        return navigator.mediaDevices.getUserMedia({audio: true})
        .then(function (stream) {
            let source = Context.createMediaStreamSource(stream);
            source.connect(Processor);
            Processor.connect(Context.destination);
            _dispatch = dispatcher;
            return AudioProcessor;
        });
    }

    return {
        init,
        mic
    }
})();