//
// Dropbox TreeView
//
//
var edtrTree = {
    // TODO: edit/extend those via user settings
    editor_type:      {
        'md':           'markdown',
        'txt':          'markdown',
        'css':          'html',
        'htm':          'html',
        'html':         'html',
        'js':           'javascript',
        'gif':          'image',
        'jpg':          'image',
        'jprg':         'image',
        'png':          'image',
        'bmp':          'image'
    },
    dom_db_tree:        null,
    ztree:              null,
    ztree_settings:     null,
    selected_node:      null,


    init:                   function (tree_elem, editor_elem) {
        edtrTree.dom_db_tree = tree_elem;
        edtrTree.dom_editor = editor_elem;

        // TODO: take those from user settings
        edtrTree.ztree_settings = {
            view: {
                selectedMulti:  false,
                addHoverDom:    edtrTree.on_hover,
                removeHoverDom: edtrTree.on_unhover
            },
            edit: {
                // Drag moves nodes without checking anything
                // TODO: find a way to perform necessary checks (e.g. overwrite)
                // before the drap is completed
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
                onRightClick:   edtrTree.on_right_click,
                onExpand:       edtrTree.on_node_expand,
                beforeDrop:     edtrTree.before_drop,
                onDrop:         edtrTree.on_drop,
                onAsyncSuccess: edtrTree.on_async_success,
                onAsyncError:   edtrTree.on_async_error
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
                args:       []
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
        i, k, l, shortcut_parts,
        key_mods =  (e.shiftKey << 0) +
                    (e.ctrlKey  << 1) +
                    (e.altKey   << 2) +
                    (e.metaKey  << 3);
        for (i in shortcuts) {
            for (k in shortcuts[i].keys) {
                shortcut_parts = shortcuts[i].keys[k].toLowerCase().split('-');
                shortcut_mods = {
                    shift:      0,
                    ctrl:       0,
                    alt:        0,
                    meta:       0
                };
                for (l in shortcut_parts)
                    shortcut_mods[shortcut_parts[l]] = 1;
                shortcut_bits = (shortcut_mods.shift << 0) +
                                (shortcut_mods.ctrl  << 1) +
                                (shortcut_mods.alt   << 2) +
                                (shortcut_mods.meta  << 3);
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

    // Go through all node's children recursively and perform
    // callback on each (excluding the node itself !)
    // returns number of callbacks performed
    traverse_tree:          function (node, callback) {
        if (!node.children)
            return 0;
        var count = 0;
        for (var i in node.children) {
            callback.call(edtrTree, node.children[i]);
            count++;
            if (node.children[i].isParent && node.children[i].children)
                count += edtrTree.traverse_tree(node.children[i], callback);
        }
        return count;
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
        var nodes = [], root, cut_len;

        if (!parent_node)
            root = '/';
        else
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
    is_checkbox_mode:           function() { return edtrTree.ztree.setting.check.enable; },
    toggle_checkboxes:          function() {
        // Also update menu items
        if (edtrTree.is_checkbox_mode()) {
            $(".sb-view-multiselect").prop("checked", false);
            $(".sb-view-clear-checkboxes").parent().addClass("disabled");
            edtrTree.ztree.setting.check.enable = false;
        }
        else {
            $(".sb-view-multiselect").prop("checked", true);
            $(".sb-view-clear-checkboxes").parent().removeClass("disabled");
            edtrTree.ztree.setting.check.enable = true;
        }
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
        if (edtrTree.is_checkbox_mode())
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
        // console.log("click", node.id);
        $(".tree-context-menu").removeClass("open");
        edtrTree.dom_db_tree.focus();
        // Alt-Click inserts path to clicked node into editor
        if (e && e.altKey) {
            if (edtrTree.editor && !edtrTree.editor.is_hidden) {
                // TODO: this should be a codemirror method
                edtrTree.editor.replace_selection(node.id);
            }
        }
    },

    on_right_click:         function(e, ztree, node) {
        if (!node) {
            $(".tree-context-menu").removeClass("open");
            return;
        }
        var dom_elem = $("#"+node.tId);
        console.log(e.pageX, e.pageY, node);
        console.log(dom_elem.position().left, dom_elem.position().top);
        $(".tree-context-menu").css({
            left:   e.pageX-10,
            top:    e.pageY-40
        });
        edtrTree.ztree.selectNode(node);
        $(".tree-context-menu").addClass("open");
        var remove_menu = function() {
            $(".tree-context-menu").removeClass("open");
            $('body').off("click", remove_menu);
        };
        $('body').on("click", remove_menu);
    },

    //
    // Called by zTree on mouse double click
    // and also when Enter is pressed
    //
    on_double_click:        function(e, ztree, node) {
        // Doubleclick was not on node - ignore
        if (!node) return;

        // Override argument (in case we were called from keyboard callback)
        node = edtrTree.get_selected_node();

        // Ignore double clicks on directories
        if (node.isParent)
            return;

        // If codemirror is opened and text in it was not saved
        // ask confirmation from user to close it
        if (edtrTree.editor && !edtrTree.editor.is_saved) {
            // Confirmation dialog
            // Save for callback
            modalDialog.params = {};
            modalDialog.params.action   = "save_continue_lose";
            modalDialog.params.callback = function(button_id) {
                if (button_id == "scl_save") {
                    //edtrTree.editor.save_codemirror();
                } else if (button_id == "scl_lose") {
                    //edtrTree.db_tree_select(elem);
                } else {
                    // Cancel open operation
                    return;
                }
                edtrTree.open_editor(node);
            };
            modalDialog.show_confirm_modal();
        } else {
            edtrTree.open_editor(node);
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
    before_drop:             function(tree_id, nodes, to_node, move_type, is_copy) {
        console.log("before drop", nodes[0].name, to_node.name, move_type);
        if (move_type === "inner") {
            // Allow drag only into directory
            if (!to_node.isParent) return false;
        } else {
            // Adjust paste node to parent
            to_node = to_node.getParentNode();
        }

        // Imitate paste
        edtrTree.clipped = {
            action:     is_copy ? "copy" : "cut",
            nodes:      nodes,
            paste_node: null
        };
        return edtrTree.set_paste_node(to_node);
    },

    //
    // Called by zTree after user drops node
    //
    on_drop:                function(event, tree_id, nodes, to_node, move_type, is_copy) {
        console.log("drop", nodes[0].name, to_node.name, move_type);
        var recursive_node_fix = function(index) {
            // Break out of recursion
            if (index == nodes.length)
                return;
            // Fix node's id. May also present confirmation dialog to user
            edtrTree.fix_node_after_paste(nodes[index], function() {
                // Fix next node recursively, to allow modal dialogs and callbacks
                recursive_node_fix(index+1);
            });
        };
        recursive_node_fix(0);
    },

    // Called when any tree node is expanded
    on_node_expand:         function(event, tree_id, node) {
        // Launch callback set by expand_node()
        if (edtrTree.on_expand_callback) {
            edtrTree.on_expand_callback.call(edtrTree);
            edtrTree.on_expand_callback = null;
        }
    },
    // Wrapper for ztree expandNode
    // Launches callback when tree node is expanded, but only ONCE !
    // Used by modal dialogs to display only when node's children are loaded
    expand_node:            function(node, callback) {
        if (node.open) {
            callback.call(edtrTree);
        }
        else {
            edtrTree.on_expand_callback = callback;
            edtrTree.ztree.expandNode(node, true, false, true, true);
        }
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
        modalDialog.params = {};
        modalDialog.params.action   = modal_id;
        modalDialog.params.text     = text;
        modalDialog.show_info_modal();
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
    // Smart paste is done in two steps:
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
        // Check if we can perform the paste
        for (var i in edtrTree.clipped.nodes) {
            // We shouldn't paste into ourselves or into the same parent
            if (edtrTree.clipped.nodes[i].id === node.id) {
                messagesBar.show_notification_warning("Can't paste <strong>"+
                    node.id+"</strong> into itself");
                return false;
            } else if (edtrTree.clipped.nodes[i].getParentNode().id === node.id) {
                messagesBar.show_notification_warning("Can't paste <strong>"+node.id+
                    "</strong> into <strong>"+
                    edtrTree.clipped.nodes[i].getParentNode().id+"</strong>");
                return false;
            }
        }
        edtrTree.clipped.paste_node = node;
        return true;
    },
    // Perform the paste operation
    // edtrTree.clipped contains all the necessary info:
    //      edtrTree.clipped.nodes:         the nodes to paste
    //      edtrTree.clipped.paste_node:    node to paste to
    //      edtrTree.clipped.action:        clip action - "copy" or "cut"
    //
    // We expect paste_node to be already opened by smart_paste()
    //
    paste:                  function() {
        if (edtrTree.clipped) {
            console.log("paste", edtrTree.clipped.nodes, "to",
                edtrTree.clipped.paste_node, "via", edtrTree.clipped.action);
            // debugger;
            var ztree_action;
            if (edtrTree.clipped.action === "copy")
                ztree_action = edtrTree.ztree.copyNode;
            else
                ztree_action = edtrTree.ztree.moveNode;
            // Paste node by index using ztree_action and perform
            // necessary checks
            var recursive_paste_node = function(ztree_action, index, callback) {
                // Break out of recursion
                if (edtrTree.clipped.nodes.length == index) {
                    callback.apply(edtrTree);
                    return;
                }
                // Perform requested action on node
                var new_node = ztree_action(edtrTree.clipped.paste_node,
                    edtrTree.clipped.nodes[index], "inner", false);
                // Fix node's id. May also present confirmation dialog to user
                edtrTree.fix_node_after_paste(new_node, function() {
                    // Node's action is done - move on to the next node recursively
                    recursive_paste_node(ztree_action, index+1, callback);
                });
            };
            // We use recursive paste to allow modal dialogs and callbacks
            recursive_paste_node(ztree_action, 0, function() {
                // Called when recursion is done
                edtrTree.clear_clipboard();
                // Restore keyboard focus
                edtrTree.dom_db_tree.focus();
            });
        }
    },

    // Check for overwrites and fix node's and it children's ids
    // Also move node alphabetically within its parent
    fix_node_after_paste: function(node, callback) {
        // Check for overwrites
        var nodes = edtrTree.clipped.paste_node.children,
            confirm_callback  = function(arg) {
                // The submit button was clicked
                if (arg.button) {
                    // Remove old node
                    old_node = edtrTree.ztree.getNodeByParam("id", node.id);
                    edtrTree.ztree.removeNode(old_node);
                    // Fix new one
                    fix_node();
                } else {
                    // Dialog was dismissed, meaning user declines copy/move
                    // Restore original node
                    if (edtrTree.clipped.action === "copy") {
                        // Cancel copy
                        edtrTree.ztree.removeNode(node);
                    }
                    else {
                        // Cancel move
                        var old_parent_id = node.id.substr(0, node.id.length-node.name.length-1),
                            old_parent;
                        if (old_parent_id === "") old_parent_id = "/";
                        old_parent = edtrTree.ztree.getNodeByParam("id", old_parent_id);
                        edtrTree.ztree.moveNode(old_parent, node, "inner", true);
                        edtrTree.move_node_in_parent(node, old_parent);
                    }
                    callback.apply(edtrTree);
                }
            },
            fix_node = function() {
                // Fix node id to new path
                node.id = edtrTree.clipped.paste_node.id;
                if (node.id !== "/") node.id += "/";
                node.id += node.name;
                // and do the same for its children
                if (node.isParent) {
                    edtrTree.traverse_tree(node, function(child) {
                        child.id = edtrTree.clipped.paste_node.id +
                            child.id.split(node.id).pop();
                        edtrTree.ztree.updateNode(child);
                    });
                }
                edtrTree.move_node_in_parent(node, edtrTree.clipped.paste_node);
                // TODO: perform server action here
                callback.apply(edtrTree);
            };

        // Go through nodes and see if we overwrite anything
        for (var i in nodes) {
            // Same name, but different path - it's an overwrite
            if (node.name === nodes[i].name &&
                node.id !== nodes[i].id) {
                // TODO: present confirmation dialog for overwriting existing node
                modalDialog.params = {};
                modalDialog.params.action   = "overwrite_confirm";
                modalDialog.params.text1    = nodes[i].id;
                modalDialog.params.text2    = node.id;
                modalDialog.params.callback = confirm_callback;
                modalDialog.show_confirm_modal();
                // messagesBar.show_notification_warning("Can't overwrite <strong>"+
                //     nodes[i].id+"</strong> with <strong>"+
                //     node.id+"</strong> (TODO !)");
                // Node will be fixed in comfirm_callback if confirmed by user
                return;
            }
        }

        // No overwrites - fix the node
        fix_node();
    },

    // zTree calls those when ajax request completes
    on_async_error:         function(event, ztree, node, request, status, http_error) {
        edtrTree.process_ajaxing_nodes(false, node);
    },
    on_async_success:       function(event, ztree, node, axaj_data) {
        edtrTree.process_ajaxing_nodes(true, node);
    },
    process_ajaxing_nodes:  function(is_success, node) {
        // console.log("loaded", node.id);
        if (edtrTree.ajaxing_nodes) {
            // Remove completed node from pool
            var i = edtrTree.ajaxing_nodes.indexOf(node);
            if (i == -1)
                messagesBar.show_internal_error("edtrTree.process_ajaxing_nodes", "Can't find node "+node.id);
            else
                edtrTree.ajaxing_nodes.splice(i, 1);
            if (edtrTree.ajaxing_nodes.length === 0) {
                edtrTree.ajaxing_nodes = null;
                edtrTree.ajaxing_callback.apply(edtrTree);
            }
        }
    },

    // Call refresh on all opened nodes and call callback function when done
    //
    refresh_opened_nodes:     function(callback) {
        var old_parent, old_children, old_selection_id,
            refresh_level, node,
            refresh_children = function() {
                // debugger;
                edtrTree.ajaxing_nodes = [];
                edtrTree.ajaxing_callback = refresh_children;
                // Refresh every opened child (if it still exists in new tree)
                for (var k in old_children) {
                    // Refresh level by level
                    if (old_children[k].level != refresh_level)
                        continue;
                    node = edtrTree.ztree.getNodeByParam("id", old_children[k].id);
                    if (node) {
                        edtrTree.ajaxing_nodes.push(node);
                        edtrTree.ztree.reAsyncChildNodes(node, "refresh",
                            !old_children[k].open);
                    }
                }
                refresh_level++;
                // No more nodes to refresh - apply callback
                if (!edtrTree.ajaxing_nodes.length) {
                    edtrTree.ajaxing_nodes = null;
                    // Restore selection, if previous selected node is gone - select '/'
                    node = edtrTree.ztree.getNodeByParam("id", old_selection_id);
                    if (node)
                        edtrTree.ztree.selectNode(node);
                    else
                        edtrTree.ztree.selectNode(edtrTree.ztree.getNodes()[0]);
                    callback.apply(edtrTree);
                }
            };
        // Save children before refresh
        old_parent = edtrTree.ztree.getNodes()[0];
        old_children = [];
        edtrTree.traverse_tree(old_parent, function(node) {
            // Save only loaded dirs
            if (node.isParent && node.children)
                old_children.push({
                    id:     node.id,
                    level:  node.level,
                    open:   node.open
                });
        });
        // Refresh root folder and when it is done - refresh its children
        edtrTree.ajaxing_nodes = [ old_parent ];
        edtrTree.ajaxing_callback = old_children.length ? refresh_children : callback;
        refresh_level = 1;
        old_selection_id = edtrTree.get_selected_node().id;
        edtrTree.ztree.reAsyncChildNodes(old_parent, "refresh", false);
    },

    // User requested action
    // We may need to display confirmation dialog
    // We store all dialog params in modalDialog.params
    // And modal uses it to display correct dialog and data
    //
    // action:      add_file, add_subdir, rename, remove, copy, cut, paste
    //
    node_action:            function(action) {
        var i, text;
        // Allowed actions for checkbox mode are: remove and clipboard operations
        if (edtrTree.is_checkbox_mode()) {
            var nodes = edtrTree.get_filtered_checked_nodes();
            text="";
            // Perform action on checkboxes only if at least one is checked
            if (nodes.length) {
                switch(action) {
                    case "remove":
                        for (i=0; i < nodes.length; i++)
                            text += nodes[i].id + (nodes[i].isParent? "/\n" : "\n");
                        modalDialog.params = {};
                        modalDialog.params.action   = action + "_checked";
                        modalDialog.params.header   = text;
                        modalDialog.params.path     = null;
                        modalDialog.params.filename = nodes;
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
        // Since it can be also called via keyboard, it calculates selected_node by itself
        if (action === "paste") {
            edtrTree.smart_paste();
            return;
        }
        
        //
        // Selection mode
        //
        var selected_node = edtrTree.get_selected_node();

        // Refresh selected node
        if (action === "refresh") {
            edtrTree.ztree.reAsyncChildNodes(selected_node, "refresh", false);
            return;
        }

        // Ignore all operations on root, except "add_"
        if ($.inArray(action, ["add_file", "add_subdir"]) == -1 && selected_node.id === '/') {
            messagesBar.show_notification_warning("Will not "+action+" root folder.");
            return;
        }

        modalDialog.params = {};
        modalDialog.params.no_names = [];

        switch (action) {
            case "remove":
                // Always expand the directory we're about to remove
                modalDialog.params.action   = action + (selected_node.isParent ? "_subdir" : "_file");
                modalDialog.params.header   = selected_node.id;
                modalDialog.params.path     = selected_node.getParentNode();
                modalDialog.params.filename = selected_node.name;
                if (selected_node.isParent)
                    edtrTree.expand_node(selected_node, modalDialog.show_file_modal);
                else
                    modalDialog.show_file_modal();
                break;
            case "add_file":
            case "add_subdir":
                if (!selected_node.isParent)
                    // File is selected - use it's dir for adding
                    selected_node = selected_node.getParentNode();
                modalDialog.params.action   = action;
                modalDialog.params.header   = selected_node.id;
                modalDialog.params.path     = selected_node.id;
                modalDialog.params.filename = "";
                // Expand node and only then launch modal
                edtrTree.expand_node(selected_node, function() {
                    // Create list of files in the parent directory to disallow user
                    // naming the file with any of existing names
                    for (var k in selected_node.children)
                        modalDialog.params.no_names.push(selected_node.children[k].name);
                    modalDialog.show_file_modal();
                });
                break;
            case "copy":
            case "cut":
                edtrTree.clipboard_action(action, [selected_node]);
                break;
            case "rename":
                var parent = selected_node.getParentNode();
                modalDialog.params.action   = action + (selected_node.isParent ? "_subdir" : "_file");
                modalDialog.params.header   = selected_node.name;
                modalDialog.params.path     = parent.id;
                modalDialog.params.filename = selected_node.name;
                for (i in parent.children)
                    modalDialog.params.no_names.push(parent.children[i].name);
                modalDialog.show_file_modal();
        }
    },

    //
    // Perform requested file action in ztree:
    // Called either from modal dialog or by server
    //
    // action:          add_file, add_subdir,
    //                  remove_file, remove_subdir,
    //                  rename_file, rename_subdir,
    //                  remove_checked,
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

        // Action is requested while in checkbox mode and on an array of objects
        // It is possible that user would perform an action on single node while in checkbox mode
        // in this case, filename will be string and not an array of objects
        if (edtrTree.is_checkbox_mode() && typeof filename !== "string") {
            if (action === "remove_checked") {
                // filename contains array of nodes to remove
                for (i=0; i < filename.length; i++)
                    edtrTree.ztree.removeNode(filename[i]);
                edtrTree.ztree.checkAllNodes(false);
                edtrTree.ztree.selectNode(edtrTree.ztree.getNodes()[0], false);
            } else {
                messagesBar.show_internal_error("edtrTree.file_action", "Unknown action: "+action);
                return false;
            }
            // TODO: perform server action
            return true;
        }

        // Get parent node
        var parent_node = edtrTree.ztree.getNodeByParam("id", path),
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
        if ($.inArray(action, ["add_file", "add_subdir"]) > -1) {
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
    },

    //
    // Open CodeMirror replacing textarea and load selected file into it
    // TODO: should be a method of edtrCodemirror object
    //
    open_editor:            function(node) {
        // Load editor code for correct extension
        var ext = edtrHelper.get_filename_ext(node.name),
            content_type = edtrTree.editor_type[ext];
        if (!content_type) {
            messagesBar.show_notification_warning(
                "No editor defined for file type <strong>"+ext+"</strong>");
            return;
        }
        // Get HTML for editor and its toolbar
        // TODO: server should also return settings dict for editor
        $.get("/get_editor", {
            editor_type: content_type
        }, function(editor_data, textStatus, jqXHR) {
            // Retrieve file from dropbox (server provides us with unique media url)
            serverComm.get_dropbox_file(node.id, function(file_data) {
                /*
                 // TODO: try jQuery Autocomplete instead
                 set_search_words(data);
                 alert(search_words_attr);
                 $('#text_search').attr('data-source', search_words_attr);
                 $('#text_search').typeahead();
                 //{source: search_words});
                 */
                // console.log(textStatus);
                // console.log(data);
                // console.log(jqXHR);
                //
                // Insert editor HTML code (toolbar, textarea, buttons) into content div
                // TODO: remove previous codemirror and all bindings (?)
                if (!edtrTree.editor || edtrTree.editor.content_type !== content_type) {
                    edtrTree.dom_editor.html(editor_data.html);
                } else {
                    // TODO: do we need to do anything else if editor is of the same type ?
                }
                // TODO: need a method in edtrCodemirror to replace data
                // or even better - to create a new tab
                edtrTree.editor = new edtrCodemirror(content_type, file_data);
                messagesBar.show_notification("File <b>"+node.id+"</b> was loaded into the editor");
            });
        })
        .error(function(data) {
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
