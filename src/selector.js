import _ from 'lodash'

export default {

    _dummy: document.createElement('a'),

    // scrapy like functionality
    _augmentedCssRx: /(.*)::(attr\([^\)]+\)|text\b)/, // e.g. "div a::attr(href)" css augmented selector
    _hasClassRx: /has-class(\((?:\s*(?:'[^']*'|"[^"]*")\s*(?:,\s*|\)))*)/g, // e.g. "has-class('wrapper')" xpath function

    xpath: function (expr, parent) {
        expr = this._toGenericXpath(expr)

        let iter = document.evaluate(expr, parent || document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null)
        // TODO:low support constant xpath types
        let node = iter.iterateNext()
        let nodes = []

        while (node) {
            nodes.push(node)
            node = iter.iterateNext()
        }

        return nodes
    },

    _toGenericXpath: function (expr) {
        return expr.replace(this._hasClassRx, (f, g1) => {
            g1 = g1.slice(1, -1)

            // TODO:low this will trim the space within quotes too which is not desirable
            let classes = g1.split(',').map(s => this._trimWithQuotes(s))
            let conds = classes.map(s => `contains(concat(" ", normalize-space(@class), " "), " ${s} ")`)
            let joinedCond = '(@class and ' + conds.join(' and ') + ')'
            return joinedCond
        })
    },

    css: function (sel, parent) {
        if (!parent) parent = document

        let subsels = this._unaugmentCss(sel)
        let normalUnionCss = subsels.map(ss => ss[0]).join(',')
        let els = _.toArray(parent.querySelectorAll(normalUnionCss))

        if (subsels.every(ss => !ss[1])) {
            // simple sel -> no modifiers
            return els
        }

        // TODO:low, the bellow is pretty crazy, what we really need is a reliable css->xpath transpiler

        let newEls = new Set()
        for (let el of els) {
            let modded = false
            for (let [sel,mod] of subsels) {
                if (!mod) continue
                if (!el.matches(sel)) continue

                modded = true
                // TODO:low perhaps if it doesn't include first it doesn't include any further
                // which means I should break at that point
                this.xpath(mod, el).forEach(e => newEls.add(e))
            }
            if (!modded) newEls.add(el)
        }

        // TODO:low get terminology straight els/elements are for Node.ELEMENT_TYPE
        // nodes for mix of els/texts/attrs

        // sort elements way they appear in the document
        return Array.from(newEls).sort((a,b) => {
            if (a.nodeType !== Node.TEXT_NODE) a = this.asElementNode(a)
            if (b.nodeType !== Node.TEXT_NODE) b = this.asElementNode(b)
            let aPath = this._getElPath(a), bPath = this._getElPath(b)
            for (let i = 0; i < Math.min(aPath.length, bPath.length); i++) {
                let aa = aPath[i], bb = bPath[i]
                if (aa === bb) continue
                let commonParent = aPath[i-1]
                let childNodes = _.toArray(commonParent.childNodes)
                return childNodes.indexOf(bb) - childNodes.indexOf(aa)
            }
        }).reverse()
    },

    select: function (sel, parent) {
        try {
            return ['css', this.css(sel, parent)]
        } catch (e) {}
        try {
            return ['xpath', this.xpath(sel, parent)]
        } catch (e) {}

        return [null, []]
    },

    getType: function (sel) {
        try {
            this.css(sel, this._dummy)
            return 'css'
        } catch (e) {}
        try {
            this.xpath(sel, this._dummy)
            return 'xpath'
        } catch (e) {}

        return null
    },

    asElementNode: function (el) {
        if (el.nodeType === Node.ELEMENT_NODE)
            return el
        else
            return el.ownerElement || el.parentElement || el.parentNode
    },

    _getElPath: function (el) {
        // -> [parent, parent, ..., el]

        let path = [el]
        while (true) {
            let parent = path[0].parentElement
            if (!parent) break
            path.unshift(parent)
        }
        return path
    },

    _unaugmentCss: function (sel) {
        // 'div a::text, b' => [['div a', './text()'], ['b', null]]

        return this._splitCsvLike(sel).map(s => {
            let m = this._augmentedCssRx.exec(s)
            if (!m) {
                return [s, null]
            } else {
                let sel = m[1], mod = m[2]
                let path = './'

                if (sel.endsWith(' *')) {
                    sel = sel.slice(0, -2)
                    path = './/'
                }

                if (mod === 'text') mod = path + 'text()'
                else {
                    let attr = this._trimWithQuotes(mod.slice(5, -1))
                    mod = path + '@' + attr
                }

                return [sel, mod]
            }
        })
    },

    _trimWithQuotes: function (str) {
        return str.replace(/^[\s'"]+|[\s'"]+$/g, '')
    },

    _splitCsvLike: function (str) {
        // 'div a[name="te,st"], b' => ['div a[name="te,st"]', ' b']

        // simple cases
        if (!str.includes(',')) {
            return [str]
        } else if (!/['"]/.test(str)) {
            return str.split(',')
        }

        // difficult case
        let inQuotes = false; // will hold either false, ' or "
        let justEscaped = false
        let result = []
        let lastSplitIdx = 0
        for (let i = 0; i < str.length; i++) {
            let c = str[i]
            if (c === ',' && !inQuotes) {
                result.push(str.slice(lastSplitIdx, i))
                lastSplitIdx = i+1
            } else if (justEscaped) {
                justEscaped = false
            } else if (c === '\\') {
                justEscaped = true
            } else if (inQuotes && inQuotes === c) {
                inQuotes = false
            } else if (!inQuotes && c === "'" || c === '"') {
                inQuotes = c
            }
        }
        result.push(str.slice(lastSplitIdx))
        return result
    }
}
