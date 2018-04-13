
var ScrapeMate = ScrapeMate || {};

ScrapeMate.messageBus = {
    // window <> childWindow messaging

    // workflow:
    // bus.attach(peer) // peer window (e.g. iframe.contentWindow)
    // bus.listeners['someEvent'] = function (data, respond) {
    //     if (data === 'hi') respond('hello');
    // };

    listeners: {},
    debug: false,

    _counter: 0,
    _messages: {},
    _peer: null,
    _handler: null,

    attach: function (peer) {
        if (this._peer) throw Error('Already attached');
        this._log('attach', peer);
        this._peer = peer;
        this._handler = this._onMessage.bind(this);
        window.addEventListener('message', this._handler);
    },
    detach: function () {
        this._log('detach')
        window.removeEventListener('message', this._handler);
        this._peer = null;
        this._handler = null;
    },
    sendMessage: function (event, data) {
        this._log('=>', event, data);
        let id = ++this._counter;
        return new Promise(resolve => {
            this._messages[id] = resolve;
            this._peer.postMessage([event, data, id], '*');
        });
    },

    _log: function (...args) {
        if (this.debug) {
            let name = 'BUS:' + (window.parent === window ? 'top' : 'child');
            args.unshift(name);
            console.log.apply(console, args);
        }
    },
    _onMessage: function (e) {
        // TODO:low make sure it's from peer

        if (e.data.length === 3) {
            // received an event
            let [event, data, id] = e.data;
            this._log('<=', event, data);
            let resolve = null;
            let promise = new Promise(resolve => {
                if (!this.listeners[event]) throw Error('Listener not registered: ' + event)
                this.listeners[event](data, resolve);
            }).then(response => {
                this._log('=>ret', event, response);
                this._peer.postMessage([response, id], '*');
            });
        } else if (e.data.length === 2) {
            // received a response to an event
            let [response, id] = e.data;
            this._log('<=got', response);
            this._messages[id](response); // resolve()
        }
    }
};
