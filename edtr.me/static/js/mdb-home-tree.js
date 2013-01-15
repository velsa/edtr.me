//
// Dropbox TreeView
//
//
var edtrTree = {
    // TODO: get those from user settings !
    editable_exts:      [ 'md', 'txt', 'html', 'css', 'js'  ],
    image_exts:         [ 'gif', 'jpg', 'jpeg', 'png', 'bmp' ],

    init:                   function (tree_elem) {
        // Just in case we decide to use instances
        $this_edtr_tree = this;
        $this_edtr_tree.dom_db_tree = $('#db_tree');
        $this_edtr_tree.dom_ul_tree = $('#ul_tree');
    },
    // Callbacks, which are called by get_server_result()
    db_tree_update_success: function(message) {
        messagesBar.show_notification(message);
        $this_edtr_tree.show_db_tree();
    },
    db_tree_update_failed:  function(message) {
        syncIcon.stop_sync_rotation();
        messagesBar.show_notification(message);
    },

    // Get db_tree from server and show it in left div
    show_db_tree:           function() {
        // NOTE: make sure this function can perform all of its actions on first page render !
        //hide_codemirror();

        // Get new data from server
        $.get('/get_db_tree/', function(data) {
            if (data.status != 'success') {
                syncIcon.stop_sync_rotation();
                messagesBar.show_error(data.message);
                return false;
            }

            // Refresh treeview
            $this_edtr_tree.dom_db_tree.html(data.tree_view);

            // Activate JS logic in treeview
            $this_edtr_tree.dom_ul_tree.treeview({
                animated: "fast",
                collapsed: true,
                // TODO: Tree control doesn't work ?
                control: "#ul_tree_control"
            });

            // Update hover handlers for tree elements
            // (which highlight tree nodes)
            $this_edtr_tree.dom_ul_tree.on('mouseover', '.file, .folder', function() {
                $(this).addClass("hover"); });
            $this_edtr_tree.dom_ul_tree.on('mouseleave', '.file, .folder', function () {
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
            $this_edtr_tree.dom_ul_tree.on('click', '.file, .folder', function(e) {
                $this_edtr_tree.dom_db_tree_on_click(e, $(this));
            });

            syncIcon.stop_sync_rotation();

            // Notify user about new and updated files
            $this_edtr_tree.blink_changes_in_tree(eval(data.changes_list));
        }).error(function(data) {
                syncIcon.stop_sync_rotation();
                messagesBar.show_error("<b>CRITICAL</b> Server Error ! Please refresh the page.");
            });
    },

    // Retrieve new dropbox tree structure from from server
    // and update #db_tree element
    update_db_tree:         function(hide_tree) {
        syncIcon.start_sync_rotation();

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
            $this_edtr_tree.dom_db_tree.html("<br/><h4 style='text-align: center; background: white'>Syncing with Dropbox...</h4>");
        }
        // Get new data from server
        $.get('/async/update_db_tree/', function(data) {
            if (data.status != 'success') {
                syncIcon.stop_sync_rotation();
                messagesBar.show_error(data.message);
                return false;
            }
            // Wait for result from server
            serverComm.get_server_result(data.task_id,
                $this_edtr_tree.db_tree_update_success, $this_edtr_tree.db_tree_update_failed);
        });
    },

    // Helper to highlight given db_path
    highlight_db_tree_item_by_db_path:  function(db_path) {
        $('.file').each(function() {
            if ($(this).data("dbpath") == db_path) {
                $this_edtr_tree.highlight_db_tree_item($(this));
            }
        });
    },

    // Helper to highlight given DOM element
    highlight_db_tree_item:             function(elem) {
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
    },

    //
    // Called by jQuery onClick() in db_tree
    //
    db_tree_on_click:       function(e, elem) {
        // Ctrl-Click inserts db_path to clicked node into editor
        if (e && (e.ctrlKey || e.metaKey) ) {
            if (!$this_edtr_tree.edtr_editor.is_codemirror_hidden) {
                // TODO: this should be a codemirror method
                $this_edtr_tree.edtr_editor.replaceSelection(elem.data('dbpath'));
                $this_edtr_tree.edtr_editor.focus();
                return false;
            }
        }

        // If codemirror is opened and text in it was not saved
        // ask confirmation from user to close it
        if (!$this_edtr_tree.edtr_editor.is_codemirror_saved) {
            // Confirmation dialog
            $.cookie('mdb_modal_action', "save_continue_lose");
            modalDialog.show_confirm_modal(function(button_id) {
                if (button_id == "scl_save") {
                    $this_edtr_tree.edtr_editor.save_codemirror();
                } else if (button_id == "scl_lose") {
                    $this_edtr_tree.db_tree_select(elem);
                }
            });
        } else {
            $this_edtr_tree.db_tree_select(elem);
        }
    },

    db_tree_select:         function(elem) {
        // First - set correct highlight
        $this_edtr_tree.highlight_db_tree_item(elem);

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
            if (path === "") path = "/";
            $.cookie('mdb_current_dir_dbpath', path);
            $.cookie('mdb_current_is_folder', "false");
            // Check extension
            var ext = edtrHelper.get_filename_ext($.cookie('mdb_current_dbpath')).toLowerCase();
            if ($.inArray(ext, editable_exts) > -1) {
                $this_edtr_tree.open_editor();
            } else if ($.inArray(ext, image_exts) > -1) {
                $this_edtr_tree.show_img_gallery();
            } else {
                $this_edtr_tree.edtr_editor.hide_codemirror();
            }
        }
        //return false;
    },

    //
    // Open CodeMirror replacing textarea and load selected file into it
    // TODO: should be a method of edtrCodemirror object
    //
    open_editor:            function() {
        // Load editor code for correct extension
        // TODO: replace 'markdown' with
        // 'css', 'html', 'js', depending on file extension
        var file_type = 'markdown';
        var editor_html = null;
        $.get("/get_editor",
        {
            content_type: file_type
        }, function(data, textStatus, jqXHR) {
            editor_html = data;
            var file_url = $.cookie('mdb_source_url');
            file_url = "/static/test.md";
            // Load file contents
            $.get(file_url+"?reload="+(new Date()).getTime(),
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
                    // TODO: server should also return settings dict for editor
                    // Insert editor HTML code (toolbar, textarea, buttons) into content div
                    // TODO: remove previous codemirror and all bindings (?)
                    if (edtrCodemirror.content_type !== file_type) {
                        $("#editor_area").html(editor_html);
                        //empty().prepend(editor_html);
                    } else {
                        // TODO: do we need to do anything else if editor is of the same type ?
                    }
                    $this_edtr_tree.edtr_editor = new edtrCodemirror(file_type, data);
                });
            }
        ).error(function(data) {
                messagesBar.show_error("<b>CRITICAL</b> Server Error ! Please refresh the page.");
            });
    },

    //
    // Open jQuery carousel with clicked image as active
    //
    show_img_gallery:       function() {
        // Load images carousel (all images from current dir)
        $.post("/get_content_div/", {
            content_type: 'img_gallery',
            db_path: $.cookie('mdb_current_dbpath'),
            is_folder: $.cookie('mdb_current_is_folder'),
            dir_path: $.cookie('mdb_current_dir_dbpath')
        }, function(data) {
            if (data.status != 'success') {
                messagesBar.show_error(data.message);
            } else {
                $('#content_area').html(data.html);
                // Every time image slides
                $('#img_carousel').on('slid', function() {
                    // We update the selection in tree view
                    var db_path = $('.carousel .active').data("dbpath");
                    $this_edtr_tree.highlight_db_tree_item_by_db_path(db_path);
                });
            }
        }).error(function(data) {
                messagesBar.show_error("<b>CRITICAL</b> Server Error ! Please refresh the page.");
            });
    },

    //
    // Nice animation to highlight changed files
    //
    blink_changes_in_tree: function(changes_list) {
        // Blink changed files and dirs
        var it1 = { opacity: 0.3 };
        var it2 = { opacity: 1 };
        var dur = 400;
        var isEven = function(num){ return (num%2 === 0) ? true : false; };
        var iter_anim = function(elem, i) {
            if (i !== 0) {
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
    }
};
