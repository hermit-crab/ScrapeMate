chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    let [method, argument] = request;
    if (method === 'loadStorage') {
        chrome.storage.sync.get(null, sendResponse);
        return true;
    } else if (method === 'saveStorage') {
        chrome.storage.sync.set(argument);
    } else if (method === 'removeStorageKeys') {
        chrome.storage.sync.remove(argument);
    }
});

chrome.browserAction.onClicked.addListener(function(tab) {
    var ScrapeMateBaseUrl = chrome.extension.getURL('').slice(0, -1);
    var js = `
        var s = document.createElement('script');
        s.innerHTML = 'var ScrapeMate = ScrapeMate || {}; ScrapeMate.baseURL = "${ScrapeMateBaseUrl}";';
        document.body.appendChild(s);

        s = document.createElement('script');
        s.setAttribute('type', 'text/javascript');
        s.setAttribute('src', '${ScrapeMateBaseUrl}/main.js');
        document.body.appendChild(s);
    `;
    chrome.tabs.executeScript(tab.id, {code: js});
});
