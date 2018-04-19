# ScrapeMate Beta ![GitHub Logo](/icons/24.png) 
Scraping assistant tool. Editing and maintaining CSS/XPath selectors across webpages.  
Available as a chrome and a firefox extensions.

Quick way to interactively pick and maintain CSS/XPath selectors and their presets for external use: website testing or scraping.

Features include:
* Element picker (from [SelectorGadget](https://github.com/cantino/selectorgadget)).
* List of presets ever worked on.
* Preset JSON editor (convenient for use in conjunction with scrapy or any similar tools). Presets selective export/import.
* Quick preview of the data currently selected.
* Support for `::text` / `::attr()` css pseudo elements and `has-class()` xpath function.
* Toggling JavaScript for the tab currently working on.
* Planned features: [TODO](/TODO)

### Notes
* This was first intended as a bookmarklet but due to various limitations bookmarklet mode has been dropped. You can still check out outdated but somewhat working version [at this page](https://rawgit.com/Unknowny/ScrapeMate/master/index.html).

### Screenshots
![screenshot](https://lh3.googleusercontent.com/t9ikegsrt7f909R51_3J2i3RQ-BOGGHytn9DZGVUGUv07IUTaIVb-DJHyR0gpO58tfKzNpaBEg=w640-h400-e365)
![screenshot](https://lh3.googleusercontent.com/blC1hopTdBtXe1Em-lsZN6RNXxFMRHiP7mfb-iKLOx7blAIyxQZl5YvT_1pWB0Qw-m40sMN_hQ=w640-h400-e365)

### Build
```
npm install
npm run build
# this will create ./dist/extension folder
# which you can give to chrome as an unpacked extension
# or to firefox as a temporary extension in about:debugging
```
Icon credits to: Freepik from www.flaticon.com
