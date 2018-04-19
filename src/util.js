
export function makeElem (type, props) {
    let el = document.createElement(type)
    Object.entries(props).forEach(([k,v]) => el[k] = v)
    return el
}

export function insertElem(type, props, target) {
    let el = makeElem(type, props)
    target.appendChild(el)
    return el
}
