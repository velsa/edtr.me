//
// Holds all settings, which other objects use
// Syncs settings with server
// NOTE: this object uses knockout to interact with dom via data-bind
//
var edtrSettings = {
    // One-off settings containers
    // Used for convenience

    // Edit markdown MetaData
    file_meta: {
        author:         ko.observable(""),
        title:          ko.observable(""),
        date:           ko.observable(""),
        tags:           ko.observable(""),
        style:          ko.observable(""),
        slug:           ko.observable("")
    },

    // Settings for Codemirror
    editor: {
        theme:          ko.observable(""),
        theme_list:     [
                            "ambiance-mobile", "cobalt", "erlang-dark",
                            "neat", "solarized", "xq-dark", "ambiance",
                            "eclipse", "lesser-dark", "night", "twilight",
                            "blackboard", "elegant", "monokai", "rubyblue",
                            "vibrant-ink"
                        ],
        theme_tpl:      "codemirror-3.0-git/theme/{0}.css"
    },

    // Settings for Preview pane
    preview: {
        theme:          ko.observable(""),
        theme_list:     [
                            "alt", "dark", "default", "foghorn", "github", "light",
                            "smalltext", "swiss.css"
                        ],
        theme_tpl:      "css/md_preview/{0}.css"
    },

    init:                   function (root_dom) {
        // ko.applyBindings(edtrSettings, root_dom);
    },

    show_dialog:            function() {
        modalDialog.params = {
            action:         "general_settings",
            view_model:     edtrSettings,
            template_vars:  {
                filename:   node.id
            }
        };
    }
};
