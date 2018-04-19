import Vue from 'vue'
import MainComponent from './sidebar-main.vue'


window.vue = new Vue({
    el: '#main',
    render: h => h(MainComponent)
})

window.root = vue.$children[0]
