(function () {

if (!window.ScrapeMate) window.ScrapeMate = {};

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

        let subsels = this._unaugmentCss(sel);
        let normalUnionCss = subsels.map(ss => ss[0]).join(',');
        let els = this._asArray(parent.querySelectorAll(normalUnionCss));

        if (!subsels.every(ss => !ss[1])) {
            // simple sel -> no modifiers
            return els;
        }

        // TODO:low, the bellow is pretty crazy, what we actually need is a reliable css->xpath transpiler

        let newEls = new Set();
        for (let el of els) {
            let modded = false;
            for (let [sel,mod] of subsels) {
                if (!mod) continue;
                if (!el.matches(sel)) continue;

                modded = true;
                // TODO:low perhaps if it doesn't include first it doesn't include any further
                // which means I should break at that point
                this.xpath(mod, el).forEach(e => newEls.add(e));
            }
            if (!modded) newEls.add(el);
        }

        // TODO:low get terminology straight els/elements are for Node.ELEMENT_TYPE
        // nodes for mix of els/texts/attrs

        return Array.from(newEls).sort((a,b) => {
            if (a.nodeType !== Node.TEXT_NODE) a = this.asElementNode(a);
            if (b.nodeType !== Node.TEXT_NODE) b = this.asElementNode(b);
            let aPath = this._getElPath(a), bPath = this._getElPath(b);
            for (let i = 0; i < Math.min(aPath.length, bPath.length); i++) {
                let aa = aPath[i], bb = bPath[i];
                if (aa === bb) continue;
                let commonParent = aPath[i-1];
                let childNodes = this._asArray(commonParent.childNodes);
                return childNodes.indexOf(bb) - childNodes.indexOf(aa);
            }
        }).reverse();
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
    },

    _getElPath: function (el) {
        // -> [parent, parent, ..., el]

        let path = [el];
        while (true) {
            let parent = path[0].parentElement;
            if (!parent) break;
            path.unshift(parent);
        }
        return path;
    },

    _unaugmentCss: function (sel) {
        // 'div a::text, b' => [['div a', './text()'], ['b', null]]

        return this._parseCsvLike(sel).map(s => {
            let m = this._augmentedCssRx.exec(s);
            if (!m) {
                return [s, null];
            } else {
                let sel = m[1], mod = m[2];
                let path = './';

                if (sel.endsWith(' *')) {
                    sel = sel.slice(0, -2);
                    path = './/';
                }

                if (mod === 'text') mod = path + 'text()'
                else {
                    let attr = mod.slice(5, -1).replace(/^[\s'"]+|[\s'"]+$/g, '');
                    mod = path + '@' + attr;
                }

                return [sel, mod];
            }
        });
    },

    _parseCsvLike: function (str) {
        // 'div a[name="te,st"], b' => ['div a[name="te,st"]', ' b']

        // simple cases
        if (!str.includes(',')) {
            return [str];
        } else if (!/['"]/.test(str)) {
            return str.split(',');
        }

        // difficult case
        let inQuotes = false; // will hold either false, ' or "
        let justEscaped = false;
        let result = [];
        let lastSplitIdx = 0;
        for (let i = 0; i < str.length; i++) {
            let c = str[i];
            if (c === ',' && !inQuotes) {
                result.push(str.slice(lastSplitIdx, i));
                lastSplitIdx = i+1;
            } else if (justEscaped) {
                justEscaped = false;
            } else if (c === '\\') {
                justEscaped = true;
            } else if (inQuotes && inQuotes === c) {
                inQuotes = false;
            } else if (!inQuotes && c === "'" || c === '"') {
                inQuotes = c;
            }
        }
        result.push(str.slice(lastSplitIdx));
        return result;
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
        // TODO:medium make sure it's from peer

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

})();
