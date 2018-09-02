Promise based interface around [pocketsphinx.js](https://github.com/syl22-00/pocketsphinx.js)

Still in dev

# TODO
* ~~Recorder interface~~
* ~~Recognizer function~~
* Handle silence gracefully
* Tests

# Roadmap
* Wrap `Promise` around async calls to pocketsphinx.js `Worker`
* Modify and recompile pocketsphinx.js from pocketsphinx based on usage needs
* Wrap Pocketsphix into a node library with `node-gyp` instead of `emscripten`
