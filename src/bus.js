// Window <> childWindow messaging

// workflow:
// let bus = new WindowBus()
// bus.attach(peer) // peer window (e.g. iframe.contentWindow)
// bus.listeners['someEvent'] = function (data) {
//     if (data === 'hi') return Promise.resolve('hello') // return data or promise of it
// }
// and on the other side:
// bus.sendMessage('someEvent', 'hi')

let WindowBus = function () {}

export default WindowBus

// TODO:low make it fancy pants async somewhat?

WindowBus.prototype = {
    listeners: {},
    debug: false,

    _counter: 0,
    _sentMessages: {},
    _peer: null,
    _handler: null,

    attach: function (peer) {
        if (this._peer) throw Error('Already attached')
        this._log('attach', peer)
        this._peer = peer
        this._handler = this._onMessage.bind(this)
        window.addEventListener('message', this._handler)
    },
    detach: function () {
        this._log('detach')
        window.removeEventListener('message', this._handler)
        this._peer = null
        this._handler = null
    },
    sendMessage: function (event, data) {
        this._log('=>', event, data)
        let id = ++this._counter
        return new Promise(resolve => {
            this._sentMessages[id] = [event, resolve]
            this._peer.postMessage([event, data, id], '*')
        })
    },

    _log: function (...args) {
        if (this.debug) {
            let name = 'BUS:' + (window.parent === window ? 'top' : 'child')
            args.unshift(name)
            console.log.apply(console, args)
        }
    },
    _onMessage: function (e) {
        // TODO:medium make sure it's from peer

        if (e.data.length === 3) {
            // non initiating side: received an event
            let [event, data, id] = e.data
            this._log('<=', event, data)
            let resolve = null
            let promise = new Promise(resolve => {
                if (!this.listeners[event]) throw Error('Listener not registered: ' + event)
                let ret = this.listeners[event](data)
                // TODO:high potentially infinite Promise resolution on the receiver side
                // when unintentional undefined is returned from listener
                if (ret instanceof Promise) ret.then(resolve)
                else if (ret !== undefined) resolve(ret)
            }).then(response => {
                this._log('=>ret', event, response)
                this._peer.postMessage([response, id], '*')
            })
        } else if (e.data.length === 2) {
            // initiating side: received a response to an event
            let [response, id] = e.data
            this._log('<=got', `(${this._sentMessages[id][0]})`, response)
            this._sentMessages[id][1](response) // resolve promised return (biblical)
        }
    }
}
