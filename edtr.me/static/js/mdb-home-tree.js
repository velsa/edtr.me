//
// Dropbox TreeView
//
//
var edtrTree = {
    // TODO: get those from user settings !
    editable_exts:      [ 'md', 'txt', 'html', 'css', 'js'  ],
    image_exts:         [ 'gif', 'jpg', 'jpeg', 'png', 'bmp' ],
    dom_db_tree:        null,
    ztree:              null,
    ztree_settings:     null,
    selected_node:      null,


    init:                   function (tree_elem) {
        edtrTree.dom_db_tree = $('#db_tree');

        // TODO: take those from user settings
        edtrTree.ztree_settings = {
            view: {
                selectedMulti:  false,
                addHoverDom:    edtrTree.on_hover,
                removeHoverDom: edtrTree.on_unhover
            },
            edit: {
                enable:         true,
                showRemoveBtn:  false,
                showRenameBtn:  false,
                drag: {
                    prev:           true,
                    next:           true,
                    inner:          true,
                    autoOpenTime:   300
                }
            },
            check: {
                enable:         false,
                chkboxType:     { "Y" : "s", "N" : "s" }
            },
            data: {
                keep: {
                    leaf:           true,
                    parent:         true
                }
            },
            callback: {
                onClick:        edtrTree.on_click,
                onDblClick:     edtrTree.on_double_click,
                onExpand:       edtrTree.on_node_expand,
                beforeDrop:     edtrTree.before_drop,
                onDrop:         edtrTree.on_drop
            },
            async: {
                enable:         true,
                url:            serverComm.get_request_url("dropbox", "get_tree"),
                type:           "post",
                autoParam:      [ "id=path" ],
                otherParam:     { "_xsrf": serverComm.get_cookie("_xsrf") },
                dataFilter:     edtrTree.process_server_json
            }
        };

        // Root is always the same
        var root = [{
                id:         "/",
                name:       "(Dropbox) Apps/edtr.me/",
                open:       true,
                isParent:   true,
                iconSkin:   "parent",
                children:   []
        }];

        // Show tree in container
        edtrTree.ztree = $.fn.zTree.init(edtrTree.dom_db_tree,
            edtrTree.ztree_settings, root);

        // Open root node
        // (will automagically launch ajax request to server)
        edtrTree.ztree.expandNode(edtrTree.ztree.getNodes()[0], true);

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
        // edtrTree.dom_ul_tree.on('click', '.file, .folder', function(e) {
        //     edtrTree.dom_db_tree_on_click(e, $(this));
        // });

        // Notify user about new and updated files
        // edtrTree.blink_changes_in_tree(eval(data.changes_list));
        
        var shiftKey = 16, ctrlKey = 17, altKey = 18, metaKey = 91,
            leftKey = 37, upKey = 38, rightKey = 39, downKey = 40,
            spaceKey = 20, enterKey = 13,
            aKey = 65, shift = 'a'.charCodeAt(0)-aKey, key_char;
        edtrTree.dom_db_tree.keydown(function(e) {
            // console.log(e);
            // debugger;
            switch (e.keyCode) {
                case metaKey:       e.stopPropagation(); return;
                case leftKey:       key_char = "left"; e.preventDefault(); break;
                case upKey:         key_char = "up"; e.preventDefault(); break;
                case rightKey:      key_char = "right"; e.preventDefault(); break;
                case downKey:       key_char = "down"; e.preventDefault(); break;
                default:
                    key_char = String.fromCharCode(e.keyCode+shift); break;
                    // return;
            }
            edtrTree.process_key(e, key_char);
        }).keyup(function(e) {
            // console.log(e);
            switch (e.keyCode) {
                case spaceKey:      key_char = "space"; e.stopPropagation(); break;
                case enterKey:      key_char = "enter"; e.stopPropagation(); break;
                default:
                    // key_char = String.fromCharCode(e.keyCode+shift); break;
                    return;
            }
            edtrTree.process_key(e, key_char);
        });

        // Select root node
        edtrTree.ztree.selectNode(edtrTree.get_selected_node());
    }, // init()

    process_key:    function(e, key_char) {
        //
        // Process key event and do appropriate action
        //
        // Hotkeys for tree (Ctrl/Meta+X/C/V)
        var shortcuts = [ {
                keys:       [ "Left", "Up", "Right", "Down" ],
                action:     edtrTree.move_selection,
                args:       []
            }, {
                keys:       [ "Space" ],
                action:     edtrTree.show_node_info,
                args:       []
            }, {
                keys:       [ "Enter" ],
                action:     edtrTree.on_double_click,
                args:       [ null, null, true ]
            }, {
                keys:       [ "Alt-T" ],
                action:     edtrTree.toggle_checkboxes,
                args:       [ false ]
            }, {
                keys:       [ "Ctrl-X", "Meta-X" ],
                action:     edtrTree.node_action,
                args:       [ "cut" ]
            }, {
                keys:       [ "Ctrl-C", "Meta-C" ],
                action:     edtrTree.node_action,
                args:       [ "copy" ]
            }, {
                keys:       [ "Ctrl-V", "Meta-V" ],
                action:     edtrTree.smart_paste,
                args:       []
            }
        ],
        i, k, shortcut_parts,
        key_mods =  (e.shiftKey << 0) +
                    (e.ctrlKey  << 1) +
                    (e.altKey   << 2) +
                    (e.metaKey  << 3);
        for (i = 0; i < shortcuts.length; i++) {
            for (k = 0; k < shortcuts[i].keys.length; k++) {
                shortcut_parts = shortcuts[i].keys[k].toLowerCase().split('-');
                shortcut_mods = {
                    shift:      0,
                    ctrl:       0,
                    alt:        0,
                    meta:       0
                };
                for (l=0; l < shortcut_parts.length-1; l++)
                    shortcut_mods[shortcut_parts[l]] = 1;
                shortcut_bits = (shortcut_mods['shift'] << 0) +
                                (shortcut_mods['ctrl']  << 1) +
                                (shortcut_mods['alt']   << 2) +
                                (shortcut_mods['meta']  << 3);
                if (shortcut_bits === key_mods &&
                    key_char === shortcut_parts[shortcut_parts.length-1]) {
                        // console.log("matched", shortcuts[i].keys[k]);
                        shortcuts[i].action.apply(undefined, // value for this
                            shortcuts[i].args.concat(shortcuts[i].keys[k]));
                        return;
                    }
            }
        }
    },

    // Move node to alphabetical position within parent
    move_node_in_parent:    function (node, parent_node) {
        if (!parent_node.isParent)
            return;
        var nodes = parent_node.children;
        if (nodes.length > 1) {
            var i;
            for (i = 0; i < nodes.length; i++) {
                if (node.isParent && !nodes[i].isParent ||
                    (node.isParent === nodes[i].isParent && node.name < nodes[i].name))
                    break;
            }
            if (i < nodes.length-1) {
                // TODO: moveNode method calls asyncNode on targetNode
                // ask zTree author to fix this behavior
                edtrTree.ztree.moveNode(nodes[i], node, "prev", true);
            }
        }
        edtrTree.ztree.selectNode(node, false);
    },

    // Sort dirs and files alphabetically and place dirs first
    sort_nodes:             function (nodes) {
        // Separate dirs and files
        dirs = nodes.filter(function(elem, index, array) {return elem.isParent;});
        files = nodes.filter(function(elem, index, array) {return !elem.isParent;});

        // Sort each one alphabetically
        var name_sort = function(n1, n2) { return n1.id > n2.id; };
        dirs.sort(name_sort);
        files.sort(name_sort);

        // Place dirs first
        return dirs.concat(files);
    },

    // Called by zTree after receiving ajax response for node
    process_server_json:    function (ztree, parent_node, data) {
        var nodes = [],
            root = parent_node.id,
            cut_len = root[root.length-1] === '/' ? root.length : root.length+1;

        // Build tree nodes from server data
        for (var i=0; i < data.tree.length; i++) {
            nodes[i] = {
                id:         data.tree[i]._id,
                name:       data.tree[i]._id.substr(cut_len), // Cut parent path
                isParent:   data.tree[i].is_dir
            };
        }
        return edtrTree.sort_nodes(nodes);
    },

    // Wrappers
    is_checkbox_mode:           function() { return edtrTree.ztree.setting.check.enable; },

    // Get selected node (we can only have one)
    // If nothing is selected - we assume selection to be root
    get_selected_node:          function() {
        var selected = edtrTree.ztree.getSelectedNodes();
        return selected.length? selected[0] : edtrTree.ztree.getNodes()[0];
    },
    // Keyboard movement
    // direction: Left, Up, Right, Down
    move_selection:             function(direction) {
        var selected = edtrTree.get_selected_node();
        switch(direction.toLowerCase()) {
            case "left":
                if (selected.isParent && selected.open)
                    edtrTree.ztree.expandNode(selected, false);
                else
                    edtrTree.ztree.selectNode(selected.getParentNode());
                break;
            case "up":
                var pre_node = selected.getPreNode();
                if (!pre_node)
                    pre_node = selected.getParentNode();
                else if (pre_node.isParent && pre_node.open &&
                    pre_node.children.length)
                    pre_node = pre_node.children[pre_node.children.length-1];
                if (pre_node)
                    edtrTree.ztree.selectNode(pre_node);
                break;
            case "right":
                if (selected.isParent && !selected.open)
                    edtrTree.ztree.expandNode(selected, true);
                break;
            case "down":
                var next_node;
                if (selected.isParent && selected.open &&
                    selected.children.length)
                    next_node = selected.children[0];
                else {
                    next_node = selected.getNextNode();
                    if (!next_node)
                        next_node = selected.getParentNode().getNextNode();
                }
                if (next_node)
                    edtrTree.ztree.selectNode(next_node);
                break;
        }
        // Restore keyboard focus
        edtrTree.dom_db_tree.focus();
    },

    // Show/hide checkboxes in tree view
    toggle_checkboxes:         function(is_mouse_click) {
        // Also update menu items
        if (!is_mouse_click)
            $("#sb_view_multiselect").prop("checked", !$("#sb_view_multiselect").prop("checked"));
        if (edtrTree.is_checkbox_mode())
            $("#sb_view_clear_checkboxes").parent().removeClass("disabled");
        else
            $("#sb_view_clear_checkboxes").parent().addClass("disabled");
        console.log(is_mouse_click);
        edtrTree.ztree.setting.check.enable = !edtrTree.ztree.setting.check.enable;
        edtrTree.clear_clipboard();
        // Remember selected node to restore it after refresh
        var selected = edtrTree.ztree.getSelectedNodes()[0];
        edtrTree.ztree.refresh();
        if (selected)
            // We search selected node by param because tree structure has changed and
            // 'selected' is not valid anymore
            edtrTree.ztree.selectNode(edtrTree.ztree.getNodesByParam("id", selected.id)[0]);
        else
            edtrTree.ztree.selectNode(edtrTree.ztree.getNodes()[0]);
        // Restore keyboard focus
        edtrTree.dom_db_tree.focus();
    },
    // Clear checkboxes in tree view
    clear_checkboxes:           function() {
        edtrTree.ztree.checkAllNodes(false);
    },

    //
    // Get all checked nodes and filter them, so that 'remove' can be performed
    // Assumes that getCheckedNodes() returns list ordered by dirs first
    //
    get_filtered_checked_nodes: function() {
        var nodes = edtrTree.ztree.getCheckedNodes(true),
            filtered_nodes = [], i, k, parent_id;
        // Filter the nodes list
        for (i=0; i < nodes.length; i++) {
            // Always ignore root
            if (!nodes[i].getParentNode())
                continue;
            // Check if we already have this node's parent
            // If we do - ignore it
            parent_id = nodes[i].getParentNode().id;
            for (k=0; k < filtered_nodes.length; k++)
                if (filtered_nodes[k].id === parent_id) break;
            // We don't have node's parent
            if (k == filtered_nodes.length) {
                if (!nodes[i].isParent) {
                    // Not a directory - add node
                    filtered_nodes.push(nodes[i]);
                }
                else { // Directory, add if
                    if (nodes[i].check_Child_State == 2 || // all children are checked
                        nodes[i].check_Child_State == -1)  // or it has no children
                        filtered_nodes.push(nodes[i]);
                }
            }
        }
        return filtered_nodes;
    },

    //
    // Called by zTree on mouse click
    //
    on_click:               function(e, ztree, node, flag) {
        edtrTree.dom_db_tree.focus();
        // Alt-Click inserts path to clicked node into editor
        if (e && e.altKey) {
            if (edtrTree.editor && !edtrTree.editor.is_hidden) {
                // TODO: this should be a codemirror method
                edtrTree.editor.replace_selection(node.id);
            }
        }
    },

    //
    // Called by zTree on mouse double click
    //
    on_double_click:        function(e, ztree, node, flag) {
        // Doubleclick was not on node - ignore
        if (!node) return;

        // If codemirror is opened and text in it was not saved
        // ask confirmation from user to close it
        if (edtrTree.editor && !edtrTree.editor.is_saved) {
            // Confirmation dialog
            modalDialog.show_confirm_modal("save_continue_lose", function(button_id) {
                if (button_id == "scl_save") {
                    //edtrTree.editor.save_codemirror();
                } else if (button_id == "scl_lose") {
                    //edtrTree.db_tree_select(elem);
                }
            });
        } else {
            //edtrTree.db_tree_select(elem);
        }
    },

    //
    // Called by zTree when mouse enters node
    //
    on_hover:               function(ztree, node) {
        //debugger;
        // var node_elem = $("#" + node.tId + "_a");
        // node_elem.css({"background-color": "#FFE6B0"});
    },

    //
    // Called by zTree when mouse leaves node
    //
    on_unhover:             function(ztree, node) {
        // var node_elem = $("#" + node.tId + "_a");
        // node_elem.css({"background-color": "white"});
    },

    //
    // Called by zTree before user drops node
    //
    before_drop:             function(tree_id, nodes, to_node, move_type) {
        console.log("before drop", nodes[0].name, to_node.name, move_type);
        if (move_type === "inner") {
            // Allow drag only into directory
            if (to_node.isParent) return true;
            else return false;
        } else {
            // Moving within the same directory is ignored
            if (to_node.getParentNode().id === nodes[0].getParentNode().id)
                return false;
        }
        return true;
    },

    //
    // Called by zTree after user drops node
    //
    on_drop:                function(event, tree_id, nodes, to_node, move_type) {
        console.log("drop", nodes[0].name, to_node.name, move_type);
        edtrTree.move_node_in_parent(nodes[0], nodes[0].getParentNode());
    },

    // Called when any tree node is expanded
    on_node_expand:         function(event, tree_id, node) {
        // Launch callback set by expand_node()
        if (edtrTree.on_expand_callback) {
            edtrTree.on_expand_callback();
            edtrTree.on_expand_callback = null;
        }
    },
    // Wrapper for ztree expandNode
    // Launches callback when tree node is expanded, but only ONCE !
    // Used by modal dialogs to show in dom only when node's children are loaded
    expand_node:            function(node, callback) {
        edtrTree.on_expand_callback = callback;
        edtrTree.ztree.expandNode(node, true, false, true, true);
    },


    //
    // File / Directory operations with modal dialogs
    //
    add_node_via_modal:     function(action) {
        // Save for callback
        edtrTree.modal_params = {};
        edtrTree.modal_params.action   = action;
        edtrTree.modal_params.filename = "";

        var selected_node = edtrTree.get_selected_node(),
            node = null;
        // Always expand the directory we're about to add to
        if (selected_node.isParent) {
            edtrTree.modal_params.header   = selected_node.id;
            edtrTree.modal_params.path     = edtrTree.modal_params.header;
            // Dir is selected - use it as root
            node = selected_node;
        } else {
            // File is selected - use it's dir (obviously, node is already expanded)
            edtrTree.modal_params.header   = selected_node.getParentNode().id;
            edtrTree.modal_params.path     = edtrTree.modal_params.header;
        }
        // If node is already expanded - launch modal
        if (!node || node.open)
            modalDialog.show_file_modal();
        else
            // Expand node and only then launch modal
            edtrTree.expand_node(node, modalDialog.show_file_modal);
    },

    // User requested action
    // We may need to display confirmation dialog
    // We store all dialog params in edtrTree.modal_params
    // And modal uses it to display correct dialog and data
    //
    // action:      add_file, add_subdir, rename, remove, copy, cut, paste
    //
    node_action:            function(action) {
        // Allowed actions for checkbox mode are: remove and clipboard operations
        if (edtrTree.is_checkbox_mode()) {
            var nodes = edtrTree.get_filtered_checked_nodes(),
                i, text="";
            // Perform action on checkboxes only if at least one is checked
            if (nodes.length) {
                switch(action) {
                    case "remove":
                        for (i=0; i < nodes.length; i++)
                            text += nodes[i].id + (nodes[i].isParent? "/\n" : "\n");
                        edtrTree.modal_params = {};
                        edtrTree.modal_params.action   = action + "_checked";
                        edtrTree.modal_params.header   = text;
                        edtrTree.modal_params.path     = null;
                        edtrTree.modal_params.filename = nodes;
                        modalDialog.show_file_modal();
                        return;
                    case "copy":
                    case "cut":
                        edtrTree.clipboard_action(action, nodes);
                        return;
                }
            } // if nodes checked
        } // if in checkbox mode

        // Paste works on root, so we process it first
        if (action === "paste") {
            edtrTree.smart_paste();
            return;
        }
        
        // Selection mode
        var selected_node = edtrTree.get_selected_node();

        // Ignore operations on root
        if (selected_node.id === '/') {
            messagesBar.show_notification_warning("Will not "+action+" root folder.");
            return;
        }

        // Save for callback
        edtrTree.modal_params = {};
        edtrTree.modal_params.action   = action + (selected_node.isParent ? "_subdir" : "_file");
        edtrTree.modal_params.header   = action === "remove" ? selected_node.id : selected_node.name;
        edtrTree.modal_params.path     = selected_node.getParentNode().id;
        edtrTree.modal_params.filename = selected_node.name;

        // Always expand the directory we're about to remove
        if (action === "remove" && selected_node.isParent && !selected_node.open)
            edtrTree.expand_node(selected_node, modalDialog.show_file_modal);
        else if($.inArray(action, ["copy", "cut"]) > -1)
            edtrTree.clipboard_action(action, [selected_node]);
        else
            modalDialog.show_file_modal();
    },

    // Remove clipboard and clear tree highlighting set by clipboard()
    clear_clipboard:           function() {
        // debugger;
        if (edtrTree.clipped) {
            edtrTree.clipped = null;
            // Gets ALL ztree nodes
            var nodes = edtrTree.ztree.getNodesByFilter(function() {return true;}), i;
            for (i=0; i < nodes.length; i++) {
                $("#"+nodes[i].tId+"_span").css("color", "");
            }
        }
    },
    // Show modal with clipboard contents
    show_clipboard:             function(modal_id) {
        var nodes, i, text="";
        if (edtrTree.clipped) {
            nodes = edtrTree.clipped.nodes;
            for (i=0; i < nodes.length; i++) {
                text += nodes[i].id + (nodes[i].isParent? "/\n" : "\n");
            }
        } else {
            text = "You don't have clipped files.";
        }
        modalDialog.show_info_modal(modal_id, text);
    },

    //
    // Perform requested clipboard action on array of nodes
    // action:      copy, cut
    //
    clipboard_action:           function(action, nodes) {
        edtrTree.clear_clipboard();
        edtrTree.clipped = {
            action:     action,
            nodes:      nodes,
            paste_node: null
        };
        var i, color = action === "copy"? "blue" : "lightblue";
        for (i=0; i < nodes.length; i++) {
            $("#"+nodes[i].tId+"_span").css("color", color);
        }
    },
    //
    // Perform paste. We do it in two steps:
    // First, paste_node is set and then paste() is be called
    // this allows using paste() as callback for edtrTree.expand_node()
    //
    smart_paste:            function() {
        if (!edtrTree.clipped) {
            messagesBar.show_notification_warning("Nothing to paste. Clipboard is empty.");
            return;
        }

        // Adjust selection to parent folder
        var node = edtrTree.get_selected_node();
        if (!node.isParent)
            node = node.getParentNode();
        if (!edtrTree.set_paste_node(node)) {
            messagesBar.show_notification_warning("Can't paste clipboard into <strong>"+
                node.id+"</strong>");
            return;
        } else {
            // Open folder (if needed) and paste into it
            if (!node.open)
                edtrTree.expand_node(node, edtrTree.paste);
            else
                edtrTree.paste();
            return;
        }
    },
    set_paste_node:         function(node) {
        // If we don't have a clipboard or paste is not into folder - break out
        if (!edtrTree.clipped || !node.isParent)
            return false;
        // We shouldn't paste into ourselves or into the same parent
        for (var i=0; i < edtrTree.clipped.nodes.length; i++)
            if (edtrTree.clipped.nodes[i].id === node.id ||
                edtrTree.clipped.nodes[i].getParentNode().id === node.id)
                return false;
        edtrTree.clipped.paste_node = node;
        return true;
    },
    paste:                  function() {
        if (edtrTree.clipped) {
            console.log("paste", edtrTree.clipped.nodes, "to",
                edtrTree.clipped.paste_node, "via", edtrTree.clipped.action);
            edtrTree.clear_clipboard();
            // Restore keyboard focus
            edtrTree.dom_db_tree.focus();
        }
    },

    //
    // Perform requested file action in ztree:
    //
    // action:          add_file, add_subdir, remove_file, remove_subdir, rename_file, rename_subdir,
    //                  remove_checked
    // path:            path to directory where filename resides
    // filename:        file name to perform action on
    // filename_new:    file name to rename to (if action is rename)
    // need_server_action:
    //      true - ask server to perform this action (default)
    //      false - don't ask server to perform this action (action initiated by server itself)
    //
    file_action:            function(action, path, filename, filename_new, need_server_action) {
        //console.log(action, path, filename, filename_new);
        need_server_action = typeof need_server_action !== 'undefined' ? need_server_action : true;
        var human_action = {
            "add_file":         "file <b>{0}</b> was added to <b>{1}</b>",
            "remove_file":      "file <b>{0}</b> was removed from <b>{1}</b>",
            "rename_file":      "file <b>{0}</b> was renamed to <b>{2}</b> in <b>{1}</b>",
            "add_dir":          "directory <b>{0}</b> was added to <b>{1}</b>",
            "remove_dir":       "directory <b>{0}</b> was removed from <b>{1}</b>",
            "rename_dir":       "directory <b>{0}</b> was renamed to <b>{2}</b> in <b>{1}</b>",
            "remove_checked":   "checked items where removed"
        }, i;

        // Action is requested while in checkbox mode
        if (edtrTree.is_checkbox_mode() && typeof filename !== "string") {
            switch (action) {
                case "remove_checked":
                    // filename contains array of nodes to remove
                    for (i=0; i < filename.length; i++)
                        edtrTree.ztree.removeNode(filename[i]);
                    edtrTree.ztree.checkAllNodes(false);
                    edtrTree.ztree.selectNode(edtrTree.ztree.getNodes()[0], false);
                    break;
                case "copy":
                    console.log(filename);
                    return;
                case "cut":
                    console.log(filename);
                    return;
                case "paste":
                    console.log(filename);
                    return;
                default:
                    messagesBar.show_internal_error("edtrTree.file_action", "Unknown action: "+action);
                    return false;
            }
            // TODO: perform server action
            return true;
        }

        // Get parent node
        var parent_node = edtrTree.ztree.getNodesByParam("id", path)[0],
            node;
        if (!parent_node) {
            if (need_server_action)
                messagesBar.show_internal_error("edtrTree.file_action", "Can't find parent_node "+path);
            else
                messagesBar.show_notification(human_action[action].format(
                    filename, path, filename_new));
            return false;
        }

        // Fix for root ('/') to avoid adding double '/'
        var full_path = path === '/' ? '/' + filename_new : path + '/' + filename_new;

        // Process action in ztree
        if (action.substr(0,3) === "add") {
            // Add
            node = [{
                id:         full_path,
                name:       filename_new,
                isParent:   action.substr(4,7) === "subdir" ? true : false
            }];
            node = edtrTree.ztree.addNodes(parent_node, node, true)[0];
            edtrTree.move_node_in_parent(node, parent_node);
            // TODO: perform server action
        } else {
            // debugger;
            // Remove or Rename
            node = edtrTree.ztree.getNodesByParam("name", filename, parent_node)[0];
            if (!node) {
                messagesBar.show_internal_error("edtrTree.file_action", "Can't find node "+filename+" in "+path);
                return false;
            }
            switch (action) {
                case "rename_file":
                case "rename_subdir":
                    node.id     = full_path,
                    node.name   = filename_new;
                    edtrTree.ztree.updateNode(node);
                    break;
                case "remove_file":
                case "remove_subdir":
                    edtrTree.ztree.removeNode(node, false);
                    edtrTree.ztree.selectNode(parent_node, false);
                    break;
            }
            // TODO: perform server action
            return true;
        }

        return;
        // Request file contents from server
        // TODO: get direct link to dropbox from server and fetch file
        // $.post('/async/do_dropbox/', {
        //         action:     action,
        //         path:       path,
        //         filename:   filename
        //     }, function(data) {
        //         if (data['status'] != 'success') {
        //             messagesBar.show_error(data['message']);
        //         } else {
        //             // Wait for result from server
        //             serverComm.get_server_result(data.task_id,
        //                 modal_result_success, modal_result_error);
        //         }
        //     }).error(function(data) {
        //         messagesBar.show_error("Can't communicate with server ! Please refresh the page.");
        //     });
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
        var editor_html, editor_tb_html;
        $.get("/get_editor",
        {
            editor_type: file_type
        }, function(data, textStatus, jqXHR) {
            // Put data values into global vars to access them in callback
            editor_html = data.editor_html;
            editor_tb_html = data.editor_tb_html;
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
                    if (!edtrTree.editor || edtrTree.editor.content_type !== file_type) {
                        $(".main-view-right").html(editor_html);
                        //$("#editor_toolbar").html(editor_tb_html);
                        //empty().prepend(editor_html);
                    } else {
                        // TODO: do we need to do anything else if editor is of the same type ?
                    }
                    edtrTree.editor = new edtrCodemirror(file_type, data);
                    messagesBar.show_notification("File <b>"+file_url+"</b> was loaded into the editor");
                });
            }
        ).error(function(data) {
                messagesBar.show_error("<b>CRITICAL</b> Server Error ! Please refresh the page.");
            });
    }



    // // Callbacks, which are called by get_server_result()
    // db_tree_update_success: function(message) {
    //     messagesBar.show_notification(message);
    //     edtrTree.show_db_tree();
    // },
    // db_tree_update_failed:  function(message) {
    //     syncIcon.stop_sync_rotation();
    //     messagesBar.show_notification(message);
    // },


    // db_tree_select:         function(elem) {
    //     // First - set correct highlight
    //     edtrTree.highlight_db_tree_item(elem);

    //     // Save cookies for other JS methods
    //     $.cookie('mdb_source_url', elem.data("src"));
    //     $.cookie('mdb_preview_url', elem.data("html"));
    //     $.cookie('mdb_current_dbpath', elem.data("dbpath"));
    //     $.cookie('mdb_is_treeview_selected', "true");

    //     // Allow file/dir actions in menu
    //     $("#action_delete, #action_rename").css('cursor', 'pointer');

    //     if (elem.hasClass('folder')) {
    //         // This is a DIR !
    //         // TODO: open folder settings pane

    //         // We add trailing slash to make dir look nicer in dialogs
    //         $.cookie('mdb_current_dir_dbpath', elem.data("dbpath")+"/");
    //         $.cookie('mdb_current_is_folder', "true");
    //     } else {
    //         // This is a FILE !
    //         // Calculate dropbox directory for it
    //         var path;
    //         var parts=$.cookie('mdb_current_dbpath').split("/");
    //         parts[parts.length-1]="";
    //         path = parts.join("/");
    //         if (path === "") path = "/";
    //         $.cookie('mdb_current_dir_dbpath', path);
    //         $.cookie('mdb_current_is_folder', "false");
    //         // Check extension
    //         var ext = edtrHelper.get_filename_ext($.cookie('mdb_current_dbpath')).toLowerCase();
    //         if ($.inArray(ext, editable_exts) > -1) {
    //             edtrTree.open_editor();
    //         } else if ($.inArray(ext, image_exts) > -1) {
    //             edtrTree.show_img_gallery();
    //         } else {
    //             edtrTree.editor.hide_codemirror();
    //         }
    //     }
    //     //return false;
    // },

    //
    // Open jQuery carousel with clicked image as active
    //
    // show_img_gallery:       function() {
    //     // Load images carousel (all images from current dir)
    //     $.post("/get_content_div/", {
    //         content_type: 'img_gallery',
    //         db_path: $.cookie('mdb_current_dbpath'),
    //         is_folder: $.cookie('mdb_current_is_folder'),
    //         dir_path: $.cookie('mdb_current_dir_dbpath')
    //     }, function(data) {
    //         if (data.status != 'success') {
    //             messagesBar.show_error(data.message);
    //         } else {
    //             $('#content_area').html(data.html);
    //             // Every time image slides
    //             $('#img_carousel').on('slid', function() {
    //                 // We update the selection in tree view
    //                 var db_path = $('.carousel .active').data("dbpath");
    //                 edtrTree.highlight_db_tree_item_by_db_path(db_path);
    //             });
    //         }
    //     }).error(function(data) {
    //             messagesBar.show_error("<b>CRITICAL</b> Server Error ! Please refresh the page.");
    //         });
    // },

    // Retrieve new dropbox tree structure from from server
    // and update #db_tree element
    // update_db_tree:         function(hide_tree) {
    //     syncIcon.start_sync_rotation();

    //     // Reset TreeView cookies (we use them as global vars)
    //     $.cookie('mdb_preview_url', ""); // url, opened when Preview button is clicked
    //     $.cookie('mdb_current_dbpath', "/"); // selected item
    //     $.cookie('mdb_current_is_folder', "true"); // true if dir selected
    //     $.cookie('mdb_current_dir_dbpath', "/"); // parent dir of selected item
    //     $.cookie('mdb_is_treeview_selected', "false"); // true if user clicked on treeview item

    //     // Disallow some file/dir actions until first click
    //     $("#action_delete, #action_rename").css('cursor', 'no-drop');

    //     // Show text while updating
    //     if (hide_tree) {
    //         edtrTree.dom_db_tree.html("<br/><h4 style='text-align: center; background: white'>Syncing with Dropbox...</h4>");
    //     }
    //     // Get new data from server
    //     $.get('/async/update_db_tree/', function(data) {
    //         if (data.status != 'success') {
    //             syncIcon.stop_sync_rotation();
    //             messagesBar.show_error(data.message);
    //             return false;
    //         }
    //         // Wait for result from server
    //         serverComm.get_server_result(data.task_id,
    //             edtrTree.db_tree_update_success, edtrTree.db_tree_update_failed);
    //     });
    // },

    // Helper to highlight given db_path
    // highlight_db_tree_item_by_db_path:  function(db_path) {
    //     $('.file').each(function() {
    //         if ($(this).data("dbpath") == db_path) {
    //             edtrTree.highlight_db_tree_item($(this));
    //         }
    //     });
    // },

    // Helper to highlight given DOM element
    // highlight_db_tree_item:             function(elem) {
    //     // Remove selection from all items in TreeView
    //     $('.file, .folder')
    //         .removeAttr("style")
    //         .css({'background-color': 'white', 'border':'none'});
    //         //.removeClass('tree-node-selected');
    //     // And mark only clicked item in TreeView as selected
    //     elem
    //         .removeAttr("style")
    //         .css({'background-color': '#eee', 'border':'1px solid darkgrey'});
    //     //elem.addClass('tree-node-selected');
    // },

    //
    // Nice animation to highlight changed files
    //
    // blink_changes_in_tree: function(changes_list) {
    //     // Blink changed files and dirs
    //     var it1 = { opacity: 0.3 };
    //     var it2 = { opacity: 1 };
    //     var dur = 400;
    //     var isEven = function(num){ return (num%2 === 0) ? true : false; };
    //     var iter_anim = function(elem, i) {
    //         if (i !== 0) {
    //             if (isEven(i)) {
    //                 elem.animate(it1, dur, iter_anim(elem, i-1));
    //                 elem.addClass("hover");
    //             }
    //             else {
    //                 elem.removeClass("hover");
    //                 elem.animate(it2, dur, iter_anim(elem, i-1));
    //             }
    //         } else {
    //             //alert(i);
    //             elem.removeClass("hover");
    //             elem.css({'font-weight': "normal", 'background-color': "white" });
    //         }
    //     };
    //     if (changes_list) {
    //         for (var i=0; i < changes_list.length; i++) {
    //             iter_anim($('span[data-dbpath="'+changes_list[i]+'"]'), 5);
    //         }
    //     }
    //     //$(this).css({'font-weight': "bold", 'background-color': "#eb9fb9" });
    //     //iter_anim($('span[data-dbpath="/t.md"]'), 5);
    // }
};
