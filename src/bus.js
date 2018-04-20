// Window <> childWindow messaging

// workflow:
// let bus = new WindowBus()
// bus.handlers['someEvent'] = function (data) {
//     if (data === 'hi') return Promise.resolve('hello') // return data or promise of it
// }
// bus.listen() // start listening for whatever comes our way
// and on the other side:
// let bus = new WindowBus()
// bus.setReceiver(window) // (e.g. window.top)
// bus.sendMessage('someEvent', 'hi')

// TODO:medium restrict to messages from peer

export default class WindowBus {
    constructor () {
        this.handlers = {}
        this.debug = false

        this._counter = 0
        this._sentMessages = {}
        this._receiver = null
    }
    listen () {
        this._handlers = this._onMessage.bind(this)
        window.addEventListener('message', this._handlers)
    }
    silence () {
        window.removeEventListener('message', this._handlers)
    }
    setReceiver (window) {
        if (this._receiver) throw Error('Only one receiver is allowed')
        this._log('receiver set', window)
        this._receiver = window
    }
    unsetReceiver () {
        this._log('receiver unset')
        this._receiver = null
        this._handlers = null
    }
    sendMessage (event, data) {
        this._log('=>', event, data)
        let id = ++this._counter
        return new Promise(resolve => {
            this._sentMessages[id] = [event, resolve]
            this._receiver.postMessage([event, data, id], '*')
        })
    }

    _log (...args) {
        if (this.debug) {
            let name = 'BUS:' + (window.parent === window ? 'top' : 'child')
            args.unshift(name)
            console.log.apply(console, args)
        }
    }
    _onMessage (e) {
        if (e.data.length === 3) {
            // non initiating side: received an event
            let [event, data, id] = e.data
            this._log('<=', event, data)
            let resolve = null
            let promise = new Promise(resolve => {
                if (!this.handlers[event]) throw Error('Handler not registered: ' + event)
                let ret = this.handlers[event](data)
                // TODO:high potentially infinite Promise resolution on the receiver side
                // when unintentional undefined is returned from handler
                if (ret instanceof Promise) ret.then(resolve)
                else if (ret !== undefined) resolve(ret)
            }).then(response => {
                // respond
                this._log('=>ret', event, response)
                e.source.postMessage([response, id], '*')
            })
        } else if (e.data.length === 2) {
            // initiating side: received a response to an event
            let [response, id] = e.data
            this._log('<=got', `(${this._sentMessages[id][0]})`, response)
            this._sentMessages[id][1](response) // resolve promised return (biblical)
        }
    }
}
