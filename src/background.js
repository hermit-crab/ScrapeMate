import browser from '../vendor/browser-polyfill.js'

const SCRIPTS = ['vendor/selectorgadget_combined.min.js', 'content.js']

const loaded = new Set()

window.loaded = loaded
window.browser = browser

// browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
//     let [method, argument] = request
// })

browser.tabs.onUpdated.addListener((id, info, tab) => {
    if (info.status === 'loading') loaded.delete(id)
})

browser.browserAction.onClicked.addListener(tab => {
    if (tab.id === browser.tabs.TAB_ID_NONE) return

    if (loaded.has(tab.id)) {
        browser.tabs.sendMessage(tab.id, ['onClicked'])
    } else {
        SCRIPTS.forEach(f => browser.tabs.executeScript(tab.id, {file: f, runAt: 'document_end'})
            .then(r => console.log(f, r)))
        // might want to do that only if confirmed by the content script
        loaded.add(tab.id)
    }
})
