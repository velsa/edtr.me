//
// Dropbox TreeView
//
// TODO: get those from user settings !
var editable_exts = [ 'md', 'txt', 'html', 'css', 'js'  ];
var image_exts = [ 'gif', 'jpg', 'jpeg', 'png', 'bmp' ];

// GLOBALS
var cm_editor;

// Callbacks, which are called by get_server_result()
var db_tree_update_success = function(message) {
    show_notification(message);
    show_db_tree();
};
var db_tree_update_failed = function(message) {
    stop_sync_rotation();
    show_notification(message);
};

// Get db_tree from server and show it in left div
var show_db_tree = function() {
    // NOTE: make sure this function can perform all of its actions on first page render !
    //hide_codemirror();

    // Get new data from server
    $.get('/get_db_tree/', function(data) {
        if (data['status'] != 'success') {
            stop_sync_rotation();
            show_error(data['message']);
            return false;
        }
        // Refresh treeview
        $('#db_tree').html(data['tree_view']);
        var dom_ul_tree = $('#ul_tree');
        // Activate JS logic in treeview
        dom_ul_tree.treeview({
            animated: "fast",
            collapsed: true,
            // TODO: Tree control doesn't work ?
            control: "#ul_tree_control"
        });
        // Update hover handlers for tree elements
        // (which highlight tree nodes)
        dom_ul_tree.on('mouseover', '.file, .folder', function() {
            $(this).addClass("hover"); });
        dom_ul_tree.on('mouseleave', '.file, .folder', function () {
            $(this).removeClass("hover");
            //return false;
        });

        /* Update RIGHT Mouse Click handlers for tree elements
         $('.file, .folder').mousedown(function(e) {
         if (e.which === 4) {
         // 1 = Left   Mousebutton
         // 2 = Centre Mousebutton
         // 3 = Right  Mousebutton
         window.prompt("To copy PATH to Clipboard,\n\nPress Ctrl+C and Enter\n\n",
         $(this).data("dbpath"));
         //alert("Path:\n\n"++"\n\nwas copied to clipboard");
         return false;
         }
         });
         */

        // Update LEFT Mouse Click handlers for tree elements
        dom_ul_tree.on('click', '.file, .folder', function(e) {
            db_tree_on_click(e, $(this));
        });

        stop_sync_rotation();

        // Notify user about new and updated files
        blink_changes_in_tree(eval(data['changes_list']));
    }).error(function(data) {
            stop_sync_rotation();
            show_error("<b>CRITICAL</b> Server Error ! Please refresh the page.");
        });
};

// Retrieve new dropbox tree structure from from server
// and update #db_tree element
var update_db_tree = function(hide_tree) {
    start_sync_rotation();

    // Reset TreeView cookies (we use them as global vars)
    $.cookie('mdb_preview_url', ""); // url, opened when Preview button is clicked
    $.cookie('mdb_current_dbpath', "/"); // selected item
    $.cookie('mdb_current_is_folder', "true"); // true if dir selected
    $.cookie('mdb_current_dir_dbpath', "/"); // parent dir of selected item
    $.cookie('mdb_is_treeview_selected', "false"); // true if user clicked on treeview item

    // Disallow some file/dir actions until first click
    $("#action_delete, #action_rename").css('cursor', 'no-drop');

    // Show text while updating
    if (hide_tree) {
        $('#db_tree').html("<br/><h4 style='text-align: center; background: white'>Syncing with Dropbox...</h4>");
    }
    // Get new data from server
    $.get('/async/update_db_tree/', function(data) {
        if (data['status'] != 'success') {
            stop_sync_rotation();
            show_error(data['message']);
            return false;
        }
        // Wait for result from server
        get_server_result(data['task_id'], db_tree_update_success, db_tree_update_failed);
    });
};

// Helper to highlight given db_path
var highlight_db_tree_item_by_db_path = function(db_path) {
    $('.file').each(function() {
        if ($(this).data("dbpath") == db_path) {
            highlight_db_tree_item($(this));
        }
    });
};

// Helper to highlight given DOM element
var highlight_db_tree_item = function(elem) {
    // Remove selection from all items in TreeView
    $('.file, .folder')
        .removeAttr("style")
        .css({'background-color': 'white', 'border':'none'});
        //.removeClass('tree-node-selected');
    // And mark only clicked item in TreeView as selected
    elem
        .removeAttr("style")
        .css({'background-color': '#eee', 'border':'1px solid darkgrey'});
    //elem.addClass('tree-node-selected');
};

//
// Called by jQuery onClick() in db_tree
//
var db_tree_on_click = function(e, elem) {
    // Ctrl-Click inserts db_path to clicked node into editor
    if (e && (e.ctrlKey || e.metaKey) ) {
        if (!is_codemirror_hidden) {
            cm_editor.replaceSelection(elem.data('dbpath'));
            cm_editor.focus();
            return false;
        }
    }
    // If codemirror is opened and text in it was not saved
    // ask confirmation from user to close it
    if (!is_codemirror_saved) {
        // Confirmation dialog
        $.cookie('mdb_modal_action', "save_continue_lose");
        show_confirm_modal(function(button_id) {
            if (button_id == "scl_save") {
                save_codemirror();
            } else if (button_id == "scl_lose") {
                db_tree_select(elem);
            }
        });
    } else {
        db_tree_select(elem);
    }
};

var db_tree_select = function(elem) {
    // First - set correct highlight
    highlight_db_tree_item(elem);

    // Save cookies for other JS methods
    $.cookie('mdb_source_url', elem.data("src"));
    $.cookie('mdb_preview_url', elem.data("html"));
    $.cookie('mdb_current_dbpath', elem.data("dbpath"));
    $.cookie('mdb_is_treeview_selected', "true");

    // Allow file/dir actions in menu
    $("#action_delete, #action_rename").css('cursor', 'pointer');

    if (elem.hasClass('folder')) {
        // This is a DIR !
        // TODO: open folder settings pane

        // We add trailing slash to make dir look nicer in dialogs
        $.cookie('mdb_current_dir_dbpath', elem.data("dbpath")+"/");
        $.cookie('mdb_current_is_folder', "true");
    } else {
        // This is a FILE !
        // Calculate dropbox directory for it
        var path;
        var parts=$.cookie('mdb_current_dbpath').split("/");
        parts[parts.length-1]="";
        path = parts.join("/");
        if (path == "") path = "/";
        $.cookie('mdb_current_dir_dbpath', path);
        $.cookie('mdb_current_is_folder', "false");
        // Check extension
        var ext = get_filename_ext($.cookie('mdb_current_dbpath')).toLowerCase();
        if ($.inArray(ext, editable_exts) > -1) {
            open_editor();
        } else if ($.inArray(ext, image_exts) > -1) {
            show_img_gallery();
        } else {
            hide_codemirror();
        }
    }
    //return false;
};

//
// Open CodeMirror replacing textarea and load selected file into it
//
var open_editor = function() {
    // TODO: replace 'default' with
    // 'markdown_editor', 'css_editor', 'html_editor', 'js_editor',
    // depending on file extension
    $.post("/get_content_div/", {
        content_type: 'default'
    }, function(data) {
        if (data['status'] != 'success') {
            show_error(data['message']);
        } else {
            // Insert editor HTML code into content div
            $('#content_area').html(data['html']);
            // Load file contents into editor
            $.get($.cookie('mdb_source_url')+"?reload="+(new Date()).getTime(),
                function(data, textStatus, jqXHR) {
                    /*
                     // TODO: try jQuery Autocomplete instead
                     set_search_words(data);
                     alert(search_words_attr);
                     $('#text_search').attr('data-source', search_words_attr);
                     $('#text_search').typeahead();
                     //{source: search_words});
                     */
                    /*
                    console.log(textStatus);
                    console.log(data);
                    console.log(jqXHR);
                    */
                    // TODO: django should also return settings dict for editor
                    cm_editor = create_codemirror();
                    cm_editor.setValue(data);//search_words.join("\n"));
                    cm_editor.focus();
                    set_saved_state("SAVED");
                });
        }
    }).error(function(data) {
            show_error("<b>CRITICAL</b> Server Error ! Please refresh the page.");
        });
};

//
// Open jQuery carousel with clicked image as active
//
var show_img_gallery = function() {
    // Load images carousel (all images from current dir)
    $.post("/get_content_div/", {
        content_type: 'img_gallery',
        db_path: $.cookie('mdb_current_dbpath'),
        is_folder: $.cookie('mdb_current_is_folder'),
        dir_path: $.cookie('mdb_current_dir_dbpath')
    }, function(data) {
        if (data['status'] != 'success') {
            show_error(data['message']);
        } else {
            $('#content_area').html(data['html']);
            // Every time image slides
            $('#img_carousel').on('slid', function() {
                // We update the selection in tree view
                var db_path = $('.carousel .active').data("dbpath");
                highlight_db_tree_item_by_db_path(db_path);
            });
        }
    }).error(function(data) {
            show_error("<b>CRITICAL</b> Server Error ! Please refresh the page.");
        });
};

//
// Nice animation to highlight changed files
//
var blink_changes_in_tree = function(changes_list) {
    // Blink changed files and dirs
    var it1 = { opacity: .3 };
    var it2 = { opacity: 1 };
    var dur = 400;
    var isEven = function(num){ return (num%2 == 0) ? true : false; };
    var iter_anim = function(elem, i) {
        if (i != 0) {
            if (isEven(i)) {
                elem.animate(it1, dur, iter_anim(elem, i-1));
                elem.addClass("hover");
            }
            else {
                elem.removeClass("hover");
                elem.animate(it2, dur, iter_anim(elem, i-1));
            }
        } else {
            //alert(i);
            elem.removeClass("hover");
            elem.css({'font-weight': "normal", 'background-color': "white" });
        }
    };
    if (changes_list) {
        for (var i=0; i < changes_list.length; i++) {
            iter_anim($('span[data-dbpath="'+changes_list[i]+'"]'), 5);
        }
    }
    //$(this).css({'font-weight': "bold", 'background-color': "#eb9fb9" });
    //iter_anim($('span[data-dbpath="/t.md"]'), 5);
};
