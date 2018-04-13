
// Template - main data model for this application:
// {
//     id: {
//         fields: [
//             {name: '', selector: ''},
//             ...
//         ],
//         title: '',
//         urls: ['', ...] // pages template was ever edited on
//     },
//     ...
// }

const htmlAttrImportance = [
    'value', 'href', 'src', 'title', 'alt', 'name', 'html', 'ownText',
    attr => attr.startsWith('data-'),
    attr => !attr.startsWith('on')
]

// Utils
////////////////////////////////////////////////////////////////////////////////

function parseUrl (url) {
    let a = document.createElement('a');
    a.setAttribute('href', url);
    return _.pick(a, ['protocol', 'search', 'pathname', 'host', 'hostname', 'port', 'href', 'hash', 'origin']);
}

function toBooleanSorters (sorters) {
    return sorters.map(sorter => _.isFunction(sorter) ? _.negate(sorter) : v => v != sorter);
}

function no3w (string) {
    return string.replace(/^www\./, '');
}

// Storage
////////////////////////////////////////////////////////////////////////////////

const STORAGE_PREFIX = 'ScrapeMate_'; // in case we use localStorage (bookmarklet mode)

// TODO:low notify of any storage errors

function loadStorage () {
    return new Promise(function (resolve) {
        if (location.href.startsWith('chrome-extension://')) {
            chrome.runtime.sendMessage(['loadStorage'], resolve);
        } else {
            let storage = {};
            for (let [k,v] of Object.entries(localStorage)) {
                if (!k.startsWith(STORAGE_PREFIX)) continue;
                let kk = k.slice(STORAGE_PREFIX.length)
                storage[kk] = JSON.parse(v);
            }
            resolve(storage);
        }
    });
}

function saveStorage (items) {
    // items - an object which gives each key/value pair to update storage with.
    // Any other key/value pairs in storage will not be affected.

    if (location.href.startsWith('chrome-extension://')) {
        chrome.runtime.sendMessage(['saveStorage', items]);
    } else {
        Object.entries(items).forEach(([k,v]) => {
            localStorage[STORAGE_PREFIX+k] = JSON.stringify(v);
        });
    }
}

function removeStorageKeys (keys) {
    if (location.href.startsWith('chrome-extension://')) {
        chrome.runtime.sendMessage(['removeStorageKeys', keys]);
    } else {
        keys.forEach(k => localStorage.removeItem(STORAGE_PREFIX+k));
    }
}

// Main
////////////////////////////////////////////////////////////////////////////////

Vue.component('modal-overlay', {
    template: '<div class="modal-overlay" v-on:click.self="$emit(\'click\')"><slot></slot></div>'
});

let vue = new Vue({
    el: '#sidebar',
    data: {
        template: {}, // current template
        templates: [], // all templates
        loc: null, // page location
        selCovers: {}, // number of element each selector covers
        pickingField: null, // field that selector picker is active on

        stashedTemplate: null, // stashed copy of current template (for revert)
        templateEdited: false,
        selectedTemplates: [],

        jsDisabled: false,

        jsonEditorView: false,
        controlTabsView: false,
        templatesView: false,

        jsonEditorText: '',
        jsonEditorIsReset: true,

        controlTab: 'data',

        selElemAttrs: [], // [[[attrName, attrVale]...], ...]
        selElemUniqAttrs: [], // [attrName, ...]
        attrToShow: null
    },
    created: function () {
        loadStorage().then(storage => {

            // retrieve templates and config
            options = storage['options'] || {};
            Object.entries(storage).forEach(([k,v]) => {
                if (!k.startsWith('_')) return;
                let [id, t] = [k, v];
                this.augmentTemplate(t, id);
                Vue.set(this.templates, id, t);
            });

            // setup communication with the page
            ScrapeMate.messageBus.attach(window.parent);
            Object.keys(this).filter(k => k.startsWith('remote_')).forEach(k => {
                let kk = k.slice('remote_'.length);
                ScrapeMate.messageBus.listeners[kk] = this[k].bind(this);
            });

            // let know we good
            this.sendMessage('sidebarInitialized');

            // get page url
            return this.sendMessage('location');
        }).then(url => {
            this.loc = parseUrl(url);

            // find an existing template matching this page best
            return this.findTemplate();
        }).then(id => {
            if (!id) {
                this.newTemplate();
            } else {
                this.template = this.templates[id];
                this.stashedTemplate = _.cloneDeep(this.template);
            }
            this.checkAndUpdateSelectors();
        });
    },
    mounted: function () {
        window.addEventListener('keyup', e => this.onKeyUp(e));
        this.$el.style = ''; // show everything
    },
    computed: {
        fields: function () {
            return this.template.fields || [];
        },
        fieldCovers: function () {
            // selCovers but accessing from fields
            return this.fields.map(f => this.selCovers[f.selector]);
        },
        sortedTemplates: function () {
            if (!this.loc) return [];
            return _.sortBy(_.values(this.templates), [
                        t => t !== this.template, // current template
                        t => no3w(t.lastLoc.hostname) !== no3w(this.loc.hostname), // same host
                        t => no3w(t.lastLoc.host) // hostname alphabetic
                    ]);
        },
        sortedSelElemAttrs: function () {
            if (!this.selElemAttrs.length) return [];
            let sorters = _.concat(toBooleanSorters(htmlAttrImportance), _.identity);
            let pairsSorters = sorters.map(s => v => s(v[0]));
            return this.selElemAttrs.map(attrs => {
                return _.sortBy(_.toPairs(attrs), pairsSorters);
            });
        },
        templateStat: function () {
            return _.values(this.sortedTemplates).map(t => {
                let liveSels = '?';
                let matchPower = 'low';
                let fields = t.fields.slice(0, -1);
                let hasUndefined = _.find(fields, f => this.selCovers[f.selector] === undefined);
                if (!hasUndefined) {
                    liveSels = _.filter(fields, f => this.selCovers[f.selector] > 0).length;
                    if (liveSels > 0) matchPower = 'medium';
                    if (liveSels === fields.length) matchPower = 'high';
                } else {
                    matchPower = 'unknown';
                }

                return {selCount: liveSels + '/' + (fields.length), matchPower: matchPower};
            });
        },
    },
    methods: {

        onKeyUp: function (e) {
            // note: on remote call from parent window e.target will not be set

            if (e.keyCode === 27) {
                // esc
                this.resetView();
            } else if (_.includes([8,46], e.keyCode)) {
                // backspace
                if (this.pickingField && _.includes([undefined, document.body], e.target))
                    this.resetSelector(this.pickingField);
            } else if (e.target) {
                // delegate to parent
                e = _.pick(e, ['ctrlKey', 'shiftKey', 'altKey', 'metaKey', 'repeat', 'keyCode', 'key']);
                this.sendMessage('keyUp', e);
            }
        },
        sendMessage: function (event, data) {
            // cooperate with our content script in the page
            return ScrapeMate.messageBus.sendMessage(event, data);
        },
        resetView: function () {
            this.disablePicker();
            this.controlTabsView = false;
            this.jsonEditorView = false;
            this.templatesView = false;
        },
        remote_resetView: function () {this.resetView();},
        remote_jsDisabled: function () {this.jsDisabled = true;},
        remote_keyUp: function(e) {this.onKeyUp(e);},

        // Template Management

        makeTemplate: function (augment) {
            return {
                fields: [],
                title: no3w(this.loc.hostname) + this.loc.pathname,
                urls: [this.loc.href],
            };
        },
        augmentTemplate: function (t, id) {
            t.id = id ? id : '_' + Date.now();
            t.lastLoc = parseUrl(_.last(t.urls) || this.loc.href);
            t.fields.push(this.makeField());
        },
        revertTemplate: function () {
            if (!confirm('Undo all edits made to this template?')) return;
            this.resetView();
            this.template = this.stashedTemplate;
            this.stashedTemplate = _.cloneDeep(this.template);
            Vue.set(this.templates, this.template.id, this.template);
            this.templateEdited = false;
        },
        newTemplate: function () {
            this.resetView();
            this.template = this.makeTemplate();
            this.stashedTemplate = null;
            this.augmentTemplate(this.template);
        },
        openTemplatesView: function () {
            this.resetView();
            this.templatesView = true;
        },
        pickTemplate: function (t) {
            this.template = t;
            this.stashedTemplate = _.cloneDeep(this.template);
            this.checkAndUpdateSelectors();
            this.templatesView = false;
        },
        removeSelectedTemplates: function () {
            this.templates = _.omit(this.templates, this.selectedTemplates);
            removeStorageKeys(this.selectedTemplates);
            this.selectedTemplates = [];
        },
        selectTemplate: function (t) {
            if (_.includes(this.selectedTemplates, t.id))
                this.selectedTemplates = _.without(this.selectedTemplates, t.id);
            else
                this.selectedTemplates.push(t.id);
        },
        selectAllTemplates: function () {
            if (this.selectedTemplates.length) this.selectedTemplates = [];
            else this.selectedTemplates = _.keys(this.templates);
        },
        commitTemplate: function () {
            this.templateEdited = true;
            if (!_.includes(this.template.urls, this.loc.href))
                this.template.urls.push(this.loc.href);
            Vue.set(this.templates, this.template.id, this.template)
            let template = _.pick(this.template, ['title', 'fields', 'urls']);
            template.fields = template.fields.slice(0, -1); // remove ghost field
            saveStorage({[this.template.id]: template});
        },
        findTemplate: function () {
            // looks for template matching this page

            return new Promise(resolve => {

                // filter out outside domain templates
                let candidates = _.pickBy(this.templates, t => {
                    return t.lastLoc.hostname === this.loc.hostname;
                });

                let id2sels = _.mapValues(candidates, t => _.map(t.fields, 'selector'))
                let uniqSels = _.chain(id2sels).values().flatMap().uniq().value();

                this.sendMessage('checkSelectors', uniqSels).then(data => {

                    // count amount of working on this page selectors for each template
                    var counted = Object.entries(id2sels).map(([id,sels]) => {
                        return [id, sels.filter(s => data[s]).length];
                    });
                    counted.sort((a,b) => b[1] - a[1]);
                    let top = counted[0];

                    if (top && top[1] > 0) {
                        resolve(top[0]);
                        return;
                    }

                    // if no templates found try to find template
                    // with a url (hostname+pathname) match
                    let id = _.findKey(candidates, t => {
                        return (t.lastLoc.hostname + t.lastLoc.pathname) === (this.loc.hostname + this.loc.pathname);
                    });
                    resolve(id);
                });
            });
        },
        matchAllTemplatesSelectors: function () {
            let sels = _.chain(vue.templates)
                        .values()
                        .flatMap(t => t.fields.map(f => f.selector))
                        .uniq().value()
            this.sendMessage('checkSelectors', sels).then(data => {
                this.selCovers = Object.assign({}, this.selCovers, data);
            });
        },
        onTemplateTitleInput: _.debounce(function () {this.commitTemplate()}, 300),

        // Fields/Selectors Management

        makeField: function () {
            return {name: '', selector: ''};
        },
        addField: function () {
            this.template.fields.push(this.makeField());
            this.commitTemplate();
        },
        removeField: function (idx) {
            if (this.fields[idx] === this.pickingField) this.disablePicker();
            this.template.fields.splice(idx, 1);
            this.commitTemplate();
        },
        onPickerClick: function (f, e) {
            if (f === _.last(this.fields)) this.addField();

            e.target.blur();
            if (!this.pickingField) this.enablePicker(f);
            else if (this.pickingField === f) this.disablePicker();
            else {
                this.disablePicker();
                this.enablePicker(f);
            }
        },
        enablePicker: function (f) {
            this.sendMessage('enablePicker');
            this.pickingField = f;
            this.controlTabsView = true;
            this.submitSelector(f.selector);
            this.getSelElemAttrs(f.selector);

            let idx = _.findIndex(this.fields, ff => ff === f);
            setTimeout(() => {
                let fbox = this.$refs.field[idx].getBoundingClientRect();
                let cbox = this.$refs.controlTabs.getBoundingClientRect();

                let scrollBy = (fbox.y + fbox.height) - cbox.y;
                if (scrollBy > 0) this.$el.scrollTop += scrollBy + 10;
            }, 100);
        },
        disablePicker: function () {
            this.sendMessage('disablePicker');
            this.controlTabsView = false;
            this.pickingField = null;
        },
        submitSelector: function (sel) {
            this.sendMessage('changeSelectorPicked', sel);
        },
        onSelectorInput: function (f) {
            if (f === _.last(this.fields)) this.addField();
            this._onSelectorInput(f);
        },
        _onSelectorInput: _.debounce(function (f) {
            let sel = f.selector;
            this.checkAndUpdateSelectors([sel])
            this.sendMessage('highlight', sel);
            this.commitTemplate();
            if (this.pickingField)
                this.getSelElemAttrs(sel);
        }, 300),
        onSelectorEnter: function (f) {
            if (f === this.pickingField)
                this.submitSelector(f.selector);
        },
        onFieldNameInput: function (f) {
            if (f === _.last(this.fields)) this.addField();
            this._onFieldNameInput();
        },
        _onFieldNameInput: _.debounce(function () {this.commitTemplate();}, 300),
        checkAndUpdateSelectors: function (sels) {
            if (!sels) sels = this.template.fields.map(f => f.selector);
            this.sendMessage('checkSelectors', sels).then(data => {
                this.selCovers = Object.assign({}, this.selCovers, data);
            });
        },
        getSelElemAttrs: function (sel) {
            this.sendMessage('getSelElemAttrs', sel).then(data => {
                let sorters = _.concat(toBooleanSorters(htmlAttrImportance), _.identity);

                this.selElemAttrs = data;
                this.selElemUniqAttrs = _.chain(data)
                    .flatMap(_.keys).uniq().sortBy(sorters).value();
                this.attrToShow = this.selElemUniqAttrs[0];
            });
        },
        resetSelector: function (field) {
            if (!field) return;
            field.selector = '';
            this.onSelectorInput(field);
            if (field === this.pickingField)
                this.submitSelector(field.selector);
        },
        remote_selectorPicked: function (sel) {
            if (this.pickingField)
                this.pickingField.selector = sel;
            this.commitTemplate();
            this.getSelElemAttrs(sel);
            // don't mess with this line even if it makes little sense here
            this.checkAndUpdateSelectors([sel]);
        },

        // Import/Export

        exportTemplates: function () {
            loadStorage().then(storage => {
                let templates = _.omit(storage, ['options']);
                let content = JSON.stringify(storage, null, 2);

                var el = document.createElement('a');
                el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
                let dt = new Date().toISOString().split('T')[0];
                el.setAttribute('download', `ScrapeMate.storage.${dt}.json`);
                el.style.display = 'none';
                document.body.appendChild(el);
                el.click();
                document.body.removeChild(el);
            });
        },
        importTemplates: function (e) {
            let file = e.target.files[0];
            if (file.type !== 'application/json') {
                alert(`Incorrect file type of "${file.name}": ${file.type}\nExpected: application/json`);
                return;
            }
            let reader = new FileReader();
            reader.addEventListener('load', e => {
                try {
                    let object = JSON.parse(reader.result);
                    this.commitImportedTemplates(object);
                } catch (e) {
                    alert(`Import failed: ${e}\nCheck console for details.`);
                    throw e;
                }
            });
            // TODO:low report problem with loading it or something?
            reader.readAsText(file);
        },
        commitImportedTemplates: function (object) {
            let templates = Object.entries(object).map(([id,t]) => {
                id = id.toString();
                if (!id.startsWith('_')) id = '_' + id;
                let tt = this.makeTemplate();
                tt.urls = t.urls.map(s => s.toString());
                tt.title = t.title.toString();
                tt.fields = t.fields.map(f => {
                    let ff = this.makeField();
                    ff.name = f.name.toString();
                    ff.selector = f.selector.toString();
                    return ff;
                });
                if (this.templates[id])
                    console.log(`ScrapeMate Will Overwrite ${id}:`, tt)
                else
                    console.log(`ScrapeMate Will Create ${id}:`, tt)
                return [id, tt];
            });
            saveStorage(_.fromPairs(templates));
            templates.forEach(([id,t]) => {
                this.augmentTemplate(t, id);
                Vue.set(this.templates, id, t);
            });
        },

        // Field JSON editor

        openJsonEditor: function () {
            this.resetView();
            this.resetJsonEditor();
            this.jsonEditorView = true;
        },
        applyJsonEditor: function () {
            try {
                let data = JSON.parse(this.jsonEditorText);
                let fields = [];
                Object.entries(data).forEach(([k,v]) => {
                    let f = this.makeField();
                    f.name = k;
                    f.selector = v;
                    fields.push(f);
                });
                this.template.fields = fields;
                this.fields.push(this.makeField());
                this.commitTemplate();
                this.checkAndUpdateSelectors();
                this.jsonEditorView = false;
                this.resetJsonEditor();
            } catch (e) {
                alert('Failed to apply specified json: ' + e);
                throw e;
            }
        },
        resetJsonEditor: function () {
            this.jsonEditorIsReset = true;
            let object = _.fromPairs(this.template.fields.slice(0, -1).map(f => [f.name, f.selector]));
            this.jsonEditorText = JSON.stringify(object, null, 2);
        },
        copyJsonEditor: function () {
            this.$refs.jsonEditor.select();
            document.execCommand('copy');
        },
    }
});
