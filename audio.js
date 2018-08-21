let audio = (function (Context, Recorder) {
    'use strict';
    if (!window.AudioContext) throw Error("This module can't be used without AudioContext API.");

    let init = function() {
        try {
            Context = new AudioContext();
            return Promise.resolve(true);
        } catch (e) {
            return Promise.reject(Error("Can't initialize audio context"));
        }
    }

    let startRecording = function () {
        return navigator.mediaDevices.getUserMedia({audio: true})
        .then(function (stream) {
            Recorder = new MediaRecorder(stream);
            return Recorder;
        });
    }

    return {
        init,
        startRecording
    }
})();