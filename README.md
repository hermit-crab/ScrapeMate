# ScrapeMate Beta ![GitHub Logo](/icons/24.png) 
Scraping assistant tool. Editing and maintaining CSS/XPath selectors across webpages.  
Available as a [Chrome/Chromium](https://chrome.google.com/webstore/detail/scrapemate-beta/daiomapeacamgnofkkmiaollhidcndld) and a [Firefox](https://addons.mozilla.org/en-US/firefox/addon/scrapemate/) extensions.

Quick way to interactively pick and maintain CSS/XPath selectors and their presets for external use: website testing or scraping.

Features include:
* Element picker (from [SelectorGadget](https://github.com/cantino/selectorgadget)).
* List of presets ever worked on.
* Preset JSON editor (convenient for use in conjunction with scrapy or any similar tools). Presets selective export/import.
* Quick preview of the data currently selected.
* Support for `::text` / `::attr()` css pseudo elements and `has-class()` xpath function.
* Toggling JavaScript for the tab currently working on.

Planned features: nested selectors, more template testing and possibly actual extraction capabilities. See all: [TODO](/TODO).

### Notes
* This was first intended as a bookmarklet but due to various limitations bookmarklet mode has been dropped. You can still check out outdated but somewhat working version [at this page](https://rawgit.com/Unknowny/ScrapeMate/4a60a3bd65f9445a84a5642a056801ecd85d4212/index.html).

### Screenshots
![screenshot](https://lh3.googleusercontent.com/Yzdry6FnIr75tEJnoZCfdn1ybtlRkeyF4kNQZNH7z-GRYzA5Qvx5QW-gjdJKytyZILcYj--LLw=w640-h400-e365)
![screenshot](https://lh3.googleusercontent.com/LOAdby4Dm1dfhyE0B0nQXznkyaIBjIUl3FDlFpoggxxEfYQUkRjJTUIpz_TNqOd6obBOlqnX=w640-h400-e365)

### Build
```
npm install
npm run build
# this will create ./dist/extension folder
# which you can give to chrome as an unpacked extension
# or to firefox as a temporary extension in about:debugging
```
Icon credits to: Freepik from www.flaticon.com
