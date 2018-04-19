<script src="./sidebar-main.js"></script>

<template><div id="sidebar">

    <!-- Head Controls -->

    <div id="head-controls">
        <div class="buttons">
            <div>
                <button class="blue plain-button fas fa-plus" @click="newTemplate" title="Create new template"></button>
                <button class="plain-button fas fa-arrows-alt-h" @click="sendMessage('togglePosition')"
                    title="Toggle sidebar position"></button>
                <button :disabled="jsDisabled === null"
                    :class="[jsDisabled === null ? 'unknown' : (jsDisabled ? 'disabled' : 'enabled')]"
                    @click="sendMessage('toggleJs')"
                    class="plain-button fas fa-code js"
                    title="Toggle JavaScript"></button>
                <button class="plain-button fas fa-list" @click="openTemplatesView" title="Show all archived templates"></button>
                <button class="plain-button fas fa-pencil-alt" @click="openJsonEditor" title="Edit template as JSON"></button>
                <button class="plain-button far fa-clone" :disabled="!this.templates[this.template.id]" @click="cloneCurrentTemplate"
                    title="Clone current template"></button>
                <button class="plain-button fas fa-fast-backward" @click="revertTemplate" title="Undo all modifications" :disabled="!stashedTemplate || !templateEdited"></button>
            </div>
            <button class="conf plain-button fas fa-cog" title="Options/Info" @click="confView = true"></button>
            <button class="red plain-button fas fa-times" @click="sendMessage('close')"></button>
        </div>
        <div class="title">
            <label for="template-title" class="left">Template: </label>
            <input class="template-title" id="template-title" @input="onTemplateTitleInput" v-model="template.title"/>
        </div>
    </div>

    <!-- Fields List -->

    <div id="field-list">
        <div :key="i"
            class="field"
            ref="field"
            :class="{picking:field===pickingField}"
            v-for="(field, i) in template.fields"
            @mouseenter="sendMessage('highlight', field.selector)"
            @mouseleave="sendMessage('unhighlight')">

            <div class="inner" >
                <div class="top">
                    <input v-model.trim="field.name" @input="onFieldNameInput(field)" placeholder="field name">
                    <button @click="onPickerClick(field, $event)"
                            class="orange plain-button fas fa-magic"
                            title="Start picker"
                            @keypress.prevent>
                            </button>
                    <button class="plain-button far fa-clone"
                            title="Clone field"
                            @click="cloneField(i)">
                            </button>
                    <button :disabled="i === fields.length-1"
                            class="plain-button far fa-circle"
                            title="Reset selector"
                            @click="resetSelector(field)">
                            </button>
                    <button class="plain-button fas fa-minus"
                            :disabled="i === fields.length-1"
                            @click="removeField(i)">
                            </button>
                </div>
                <div class="bottom">
                    <input v-model.trim="field.selector"
                            class="selector"
                            placeholder="css or xpath"
                            :class="{error:fieldCovers[i] === -1}"
                            @input="onSelectorInput(field)"
                            @keyup.enter="onSelectorEnter(field)">
                    <span :disabled="i === fields.length-1" class="amount">{{ fieldCovers[i] === -1 ? 0 : fieldCovers[i] }}</span>
                </div>

                <div v-if="i !== fields.length-1" class="indicator" :class="[fieldCovers[i] === undefined ? 'unknown' : (fieldCovers[i] > 0 ? 'good' : 'bad')]"></div>
                <div v-else class="indicator"></div>
            </div>
        </div>
    </div>

    <!-- Configuration View -->

    <div class="modal-overlay" @click.self="resetView();onOptionsEdited()" v-if="confView">
        <div id="conf">
            <div class="settings">
                <label><input v-model="options.autonojs" type="checkbox">Automatically disable JavaScript.</label>
            </div>
            <b>Data Tab:</b><br>
            In picking mode data previews show a few special properties alongside element real attributes.<br>
            Those are:<br>
            _html - element inner html.<br>
            _tag - element tag name (e.g. "a", "div", "span").<br>
            _text - list of element direct texts (e.g. <span style="color: #af4356">&lt;span&gt;hello &lt;b&gt;to&lt;/b&gt; you&lt;/span&gt;</span> will be ["hello ", " you"]).<br>
            _val - value under special nonstandard css pseudo elements if used (e.g. "div a::attr(href)"), these are supported by scrapy for example.<br><br>
            <b>Hotkeys:</b><br>
            Left/Right Arrow Keys - toggle sidebar position.<br>
            Backspace, Delete - (in picking mode) reset current selector.<br>
            Esc - dismiss current popup or turn off picking mode.<br>
        </div>
    </div>

    <!-- Templates List -->

    <div class="modal-overlay" @click.self="resetView" v-if="templatesView">
        <div id="templates-list">
            <div class="buttons">
                <label class="custom-file-picker plain-button" title="Import new templates from file">
                    <input type="file" @change="importTemplates($event)"/>import
                </label>
                <div class="sep"></div>
                <button class="plain-button" @click="exportTemplates" :disabled="!selectedTemplates.length" title="Save templates to file">export</button>
                <button class="plain-button" @click="removeSelectedTemplates" :disabled="!selectedTemplates.length">delete</button>
                <button class="plain-button" @click="selectAllTemplates" >{{selectedTemplates.length ? 'none' : 'all'}}</button>
            </div>
            <div class="list">
                <div v-for="(t, i) in sortedTemplates"
                    :title="t.title" :key="t.id"
                    @click="selectTemplate(t)"
                    @dblclick="pickTemplate(t)"
                    :class="{selected:selectedTemplates.includes(t.id)}" class="template">
                    <div class="title">{{ t.title }}</div>
                    <div class="stat" :class="[templateStat[i].matchPower]">{{ templateStat[i].selCount }}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Template Json Editor -->

    <div class="modal-overlay" @click.self="resetView" v-if="jsonEditorView">
        <div id="json-editor">
            <div class="buttons">
                <button class="plain-button" @click="copyJsonEditor">copy</button>
                <button class="plain-button" @click="resetJsonEditor" :disabled="jsonEditorIsReset">reset</button>
                <button class="plain-button" @click="applyJsonEditor" :disabled="jsonEditorIsReset">apply</button>
            </div>
            <textarea ref="jsonEditor" v-model="jsonEditorText" @input="jsonEditorIsReset = false"></textarea>
        </div>
    </div>

    <!-- Control Tabs -->

    <div id="control-tabs" ref="controlTabs" v-show='controlTabsView'>
        <div class="inner">
            <div class="buttons">
                <button class="data"
                        @click="controlTab = 'data'"
                        :disabled="controlTab === 'data'">Data</button>
                <button class="soon"
                        @click="controlTab = 'soon'"
                        :disabled="controlTab === 'soon'">Soon™</button>
            </div>

            <div class="window">

                <!-- Data Single Element -->

                <div v-if="controlTab === 'data' && selElemAttrs.length == 1" class="data single">
                    <div v-for="([attr, value]) in sortedSelElemAttrs[0]" :key="attr">
                        <span class="attr">{{ attr }}</span><span class="value">{{ value }}</span>
                    </div>
                </div>

                <!-- Data Many Elements -->

                <div v-else-if="controlTab === 'data' && selElemAttrs.length > 1" class="data many">
                    <div class="buttons">
                        <button v-for="attr in selElemUniqAttrs" :disabled="attrToShow == attr" :key="attr" @click="attrToShow = attr">{{attr}}</button>
                    </div>
                    <div class="value" :key="i" v-for="(attrs, i) in selElemAttrs">{{ attrs[attrToShow] }}</div>
                </div>

                <!-- Reserved -->

                <div v-else-if="controlTab === 'soon'" class="soon">
                        Nothing here yet.
                </div>

            </div>
        </div>
    </div>

</div></template>
