let psjs = (function() {
    if(!window.Worker) throw Error("This module can't be used without Worker API.");
    let PS;

    let initLib = () => {
        PS = new Worker('ps.worker.js');

        PS.postMessage({loadlib: true});

        return new Promise( (res, rej) => {
            PS.onmessage = (e) => {
                if (e.data.success) {
                    res(true);
                }

                rej(new Error("Can't load library"));
            }

            PS.onerror = (e) => {
                rej(new Error("Can't load library"));
            }
        });
    };

    let init = () => {
        return initLib().then(() => {
            PS.postMessage({loadps: true});

            return new Promise( (res, rej) => {
                PS.onmessage = (e) => {
                    if (e.data.success) {
                        res(true);
                    }

                    rej(new Error("Can't load library"));
                }

                PS.onerror = (e) => {
                    rej(new Error("Can't load library"));
                }
            });
        });
    };

    return {
        init
    }

}());