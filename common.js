
var ScrapeMate = ScrapeMate || {};

// Selectors
////////////////////////////////////////////////////////////////////////////////

ScrapeMate.selector = {

    _dummy: document.createElement('a'),
    _augmentedCssRx: /(.*)::(attr\([^\)]+\)|text\b)/,
    _asArray: (arrayLike) => Array.prototype.slice.call(arrayLike),
    _concatAll: (arrays) => Array.prototype.concat.apply([], arrays),

    xpath: function (expr, parent) {
        let iter = document.evaluate(expr, parent || document, null, XPathResult.ANY_TYPE, null);
        let node = iter.iterateNext();
        let nodes = [];

        while (node) {
            nodes.push(node);
            node = iter.iterateNext();
        }

        return nodes;
    },

    css: function (sel, parent) {
        if (!parent) parent = document;

        let m = this._augmentedCssRx.exec(sel);

        if (!m) {
            return this._asArray(parent.querySelectorAll(sel));
        } else {
            sel = m[1];
            let mod = m[2];
            let path = './';

            if (sel.endsWith(' *')) {
                sel = sel.slice(0, -2);
                path = './/';
            }

            let nodes = this._asArray(parent.querySelectorAll(sel));

            if (mod === 'text') {
                return this._concatAll(
                            nodes.map(node => this.xpath(path + 'text()', node))
                        );
            } else {
                let attr = mod.slice(5, -1).replace(/^[\s'"]+|[\s'"]+$/g, '');
                path += '@' + attr;
                return this._concatAll(
                    nodes.map(node => this.xpath(path, node))
                );
            }
        }
    },

    select: function (sel, parent) {
        try {
            return ['css', this.css(sel, parent)];
        } catch (e) {}
        try {
            return ['xpath', this.xpath(sel, parent)];
        } catch (e) {}

        return [null, []];
    },

    getType: function (sel) {
        try {
            _dummy.querySelector(sel);
            return 'css'
        } catch (e) {}
        try {
            document.createExpression(sel);
            return 'xpath'
        } catch (e) {}

        return null;
    },

    asElementNode: function (el) {
        if (el.nodeType === Node.ELEMENT_NODE)
            return el;
        else
            return el.ownerElement || el.parentElement || el.parentNode;
    }
}

// Window <> childWindow messaging
////////////////////////////////////////////////////////////////////////////////

ScrapeMate.Bus = function () {};
ScrapeMate.Bus.prototype = {
    // workflow:
    // let bus = new Bus();
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
