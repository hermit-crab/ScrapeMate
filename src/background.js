import browser from '../vendor/browser-polyfill.js'


const SCRIPTS = ['vendor/selectorgadget_combined.min.js', 'content.js']

const injected = new Set() // tabs that have our content script running
const active = {} // tab extension ui status (bool)

window.injected = injected
window.browser = browser
window.active = active


function inject (tab) {
    // handle exceptions? Pop an alert maybe?

    SCRIPTS.forEach(f => browser.tabs.executeScript(tab.id, {file: f, runAt: 'document_end'})
        .then(r => console.log(f, r)))
    // might want to do that only if confirmed by the content script
    injected.add(tab.id)
    active[tab.id] = true
}

function addHeaders (e) {
    let k = 'content-security-policy', v = "script-src 'none'"
    let h = e.responseHeaders.find(h => h.name.toLowerCase() === k)
    if (h && h.value.includes('script-src')) h.value = h.value.replace(/script-src [^;]*/, v)
    else if (h) h.value += ';' + v
    else e.responseHeaders.push({name: k, value: v})

    return {responseHeaders: e.responseHeaders}
}

const nojs = {
    _listeners: {},
    _jsDisabled: new Set(),
    block (tabId) {
        if (this._listeners[tabId]) return
        this._listeners[tabId] = e => addHeaders(e)
        browser.webRequest.onHeadersReceived.addListener(
            this._listeners[tabId],
            {types: ['main_frame', 'sub_frame'], tabId: tabId, urls: ['<all_urls>']},
            ['blocking', 'responseHeaders'])
        },
    unblock (tabId) {
        if (!this._listeners[tabId]) return
        browser.webRequest.onHeadersReceived.removeListener(this._listeners[tabId])
        delete this._listeners[tabId]
    },
    blocked (tabId) {
        return this._listeners(tabId)
    },

    isJsDisabled (tabId) {
        return this._jsDisabled.has(tabId.toString())
    },
    onPageRefresh (tabId) {
        this._jsDisabled = new Set(Object.keys(this._listeners))
    }
}

window.nojs = nojs

// Main
////////////////////////////////////////////////////////////////////////////////

// on main button clicked
browser.browserAction.onClicked.addListener(async tab => {
    if (injected.has(tab.id)) {
        browser.tabs.sendMessage(tab.id, ['onClicked'])
        active[tab.id] = !active[tab.id]
    } else {
        // turn on nojs and refresh page if conditions are met

        let options = (await browser.storage.sync.get('options')).options || {}
        if (options.autonojs && !active[tab.id]) {
            active[tab.id] = true
            nojs.block(tab.id)
            browser.tabs.reload(tab.id)
        } else {
            inject(tab)
        }
    }
})

// talking with our content script
browser.runtime.onMessage.addListener(function(request, sender) {
    let [method, argument] = request
    let tab = sender.tab

    if (method === 'toggleJs') {
        if (nojs.isJsDisabled(tab.id)) nojs.unblock(tab.id)
        else nojs.block(tab.id)
        // TODO:low might be affected by this, not sure if care tho
        // https://code.google.com/p/chromium/issues/detail?id=494501
        browser.tabs.reload(tab.id)
    } else if (method === 'onClosed') {
        nojs.unblock(tab.id)
        active[tab.id] = false
    } else if (method === 'isJsDisabled') {
        return Promise.resolve(nojs.isJsDisabled(tab.id))
    }

    return false
})

browser.tabs.onUpdated.addListener((id, info, tab) => {
    if (info.status === 'loading') {
        // on tab location change
        nojs.onPageRefresh()

        injected.delete(id)
        if (active[id]) inject(tab)
    }
})

browser.tabs.onRemoved.addListener(tabId => {
    nojs.unblock(tabId)
})
