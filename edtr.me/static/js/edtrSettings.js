//
// Holds all settings, which other objects use
// Syncs settings with server
// NOTE: this object uses knockout to interact with dom via data-bind
//
var edtrSettings = {
    //
    // Static settings
    //
    amplify_key:            "edtr_modal_view_model",
    base_icon_url:          "/static/images/",

    // Various server statuses that we check against
    PUB_STATUS:             [ "unpublished", "published", "draft" ],

    //
    // Knockout models for dialogs
    //

    // Markdown MetaData
    // HACK: we prepend meta_ to avoid clashes with knockout and validatedObservable properties
    file_meta: ko.mapping.fromJS({
        meta_title:          ko.observable(""),
        meta_author:         ko.observable(""),
        meta_tags:           ko.observable(""),
        meta_style:          ko.observable(""),
        meta_slug:           ko.observable(""),
        meta_status:         ko.observable(""),
        meta_date:           ko.observable("")
    }),

    // General Settings
    general: ko.mapping.fromJS({
        editor: {
            theme:                  ko.observable(""),
            theme_list:             [
                                        "ambiance", "ambiance-mobile", "blackboard", "cobalt",
                                        "eclipse", "elegant", "erlang-dark",
                                        "lesser-dark", "monokai", "neat", "night",
                                        "rubyblue", "solarized", "solarized light", "solarized dark",
                                        "twilight", "vibrant-ink", "xq-dark"
            ],
            // theme_tpl:              "codemirror-3.1/theme/{0}"
            font_size:              ko.observable("14"),
            font_size_list:         [ "14", "15", "16", "17" ],
            line_numbers:           ko.observable(true),
            auto_close_brackets:    ko.observable(true),
            hl_current_line:        ko.observable(false),
            indent_with_tabs:       ko.observable(false),
            line_wrapping:          ko.observable(true),
            show_toolbar:           ko.observable(true),
            // Defaults that are not editable by user (?)
            default_content_type:   "markdown"
        },

        // Settings for Preview pane
        preview: {
            theme:          ko.observable(""),
            theme_list:     [
                                "alt", "dark", "default", "foghorn", "github", "light",
                                "smalltext", "swiss"
            ],
            theme_code:     ko.observable(""),
            theme_code_list: [
                                "arta", "ascetic", "brown_paper", "dark",
                                "default", "far", "github", "googlecode",
                                "idea", "ir_black", "magula", "monokai",
                                "monokai_sublime", "pojoaque", "railscasts",
                                "rainbow", "school_book", "solarized_dark",
                                "solarized_light", "sunburst", "tomorrow-night-blue",
                                "tomorrow-night-bright", "tomorrow-night-eighties",
                                "tomorrow-night", "tomorrow", "vs", "xcode",
                                "zenburn"
            ]
            // theme_tpl:      "css/md_preview/{0}"
        }
    }),

    init:                   function (root_dom) {
        // Convert all settings to validatedObservable
        // edtrSettings.file_meta = ko.validatedObservable(edtrSettings.file_meta);
        // edtrSettings.general = ko.validatedObservable(edtrSettings.general);

        // TODO: Load settings from server
        edtrSettings.general.editor.theme("eclipse");
        edtrSettings.general.preview.theme("default");
        edtrSettings.general.preview.theme_code("default");
        // TODO: should we get those from server as well ?
        edtrSettings.general.editor.default_icon =
            edtrSettings.base_icon_url+"dropbox-api-icons/16x16/page_white.gif";
    },

    // Show modal for general settings
    edtr_settings_modal:        function() {
        // Save model to browser storage
        amplify.store(edtrSettings.amplify_key, ko.mapping.toJSON(edtrSettings.general));

        modalDialog.params = {
            action:         "general_settings",
            view_model:     'general',
            template_vars:  {
                editor:     edtrSettings.general.editor,
                preview:    edtrSettings.general.preview
            },
            callback:       function(args) {
                // Restore previous settings if "OK" wasn't clicked
                if (args.button !== "ok") {
                    ko.mapping.fromJSON(amplify.store(edtrSettings.amplify_key), edtrSettings.general);
                }
            }
        };
        modalDialog.show_settings_modal();
    },

    // Show modal for file-meta settings
    // We don't store model in local storage, because file_meta is used as temporary storage
    // for metadata
    file_meta_modal:            function(filename, cb) {
        modalDialog.params = {
            action:         "edit_file_settings",
            view_model:     "file_meta",
            template_vars:  {
                filename:   filename
            },
            callback:       function(args) {
                cb.call(null, args);
            }
        };
        modalDialog.show_settings_modal();
    }
};