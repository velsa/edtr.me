//
// Dropbox TreeView
//
//
var edtrTree = {
    // TODO: edit/extend those via user settings
    editor_type:      {
        'md':           'markdown',
        'txt':          'markdown',
        'text':         'markdown',
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
    editor:             null,
    dom_db_tree:        null,
    ztree:              null,
    ztree_settings:     null,
    selected_node:      null,


    init:                   function (settings) {
        // Cache dom elements
        edtrTree.dom_db_tree    = settings.dom_tree;
        edtrTree.dom_editor     = settings.dom_editor;
        edtrTree.dom_rc_menu    = settings.dom_rc_menu;

        // Cache some menu items
        edtrTree.dom_menu_refresh = $(".sb-file[data-action='refresh']").parent();
        edtrTree.dom_menu_edit = $(".sb-file[data-action='edit']").parent();
        edtrTree.dom_menu_cb = $(".sb-view[data-action='toggle_checkboxes']").parent();

        // Compile templates for popovers
        edtrTree.dir_info_template = _.template(settings.popover_dir_template.html());
        edtrTree.file_info_template = _.template(settings.popover_file_template.html());

        // TODO: take those from user settings
        edtrTree.ztree_settings = {
            view: {
                selectedMulti:      false,
                addHoverDom:        edtrTree.on_hover,
                removeHoverDom:     edtrTree.on_unhover,
                // We remove the title attribute to avoid showing tooltip along with popover
                showTitle:          false

            },
            edit: {
                // Drag moves nodes without checking anything
                enable:             true,
                showRemoveBtn:      false,
                showRenameBtn:      false,
                drag: {
                    prev:           true,
                    next:           true,
                    inner:          true,
                    autoOpenTime:   300
                }
            },
            check: {
                enable:             false,
                chkboxType:         { "Y" : "s", "N" : "s" }
            },
            data: {
                keep: {
                    leaf:           true,
                    parent:         true
                }
            },
            callback: {
                onClick:            edtrTree.on_click,
                onDblClick:         edtrTree.on_double_click,
                onRightClick:       edtrTree.on_right_click,
                onExpand:           edtrTree.on_node_expand,
                beforeDrag:         edtrTree.before_drag,
                beforeDrop:         edtrTree.before_drop,
                onDrop:             edtrTree.on_drop,
                onAsyncSuccess:     edtrTree.on_async_success,
                onAsyncError:       edtrTree.on_async_error
            },
            async: {
                enable:             true,
                url:                serverComm.api_url("dropbox", "get_tree"),
                type:               "post",
                autoParam:          [ "id=path" ],
                otherParam:         { "_xsrf": serverComm.get_cookie("_xsrf") },
                dataFilter:         edtrTree.process_server_json
            }
        };

        // Root is always the same
        var root = [{
                id:         "/",
                name:       "(Dropbox) Apps/edtr.me/",
                open:       true,
                isParent:   true,
                icon:       edtrSettings.base_icon_url+"dropbox.png",
                // iconSkin:   "parent",
                children:   []
        }];

        // Show tree in container
        edtrTree.ztree = $.fn.zTree.init(edtrTree.dom_db_tree,
            edtrTree.ztree_settings, root);

        // Open root node
        // (will automagically launch ajax request to server)
        edtrTree.ztree.expandNode(edtrTree.get_root_node(), true);

        // Setup keyboard navigation in tree
        var shiftKey = 16, ctrlKey = 17, altKey = 18, metaKey = 91,
            leftKey = 37, upKey = 38, rightKey = 39, downKey = 40,
            spaceKey = 32, enterKey = 13,
            aKey = 65, shift = 'a'.charCodeAt(0)-aKey, key_char;
        edtrTree.dom_db_tree.keydown(function(e) {
            // console.log(e);
            // debugger;
            switch (e.keyCode) {
                case metaKey:       e.stopPropagation(); return;
                // Imitate on_hover when user holds shift key
                case shiftKey:
                    edtrTree.shift_key = true;
                    edtrTree.on_hover(null, edtrTree.get_selected_node());
                    break;
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
            // console.log(e.keyCode);
            switch (e.keyCode) {
                case spaceKey:      key_char = "space"; e.stopPropagation();e.preventDefault(); break;
                case enterKey:      key_char = "enter"; e.stopPropagation(); break;
                default:
                    // key_char = String.fromCharCode(e.keyCode+shift); break;
                    return;
            }
            edtrTree.process_key(e, key_char);
        });

        // Monitor shift key globally to show popover while focus is not in tree
        edtrTree.shift_key = false;
        $(document).on('keyup keydown', function(e) {
            edtrTree.shift_key = e.shiftKey;
            if (!edtrTree.shift_key && edtrTree.popover) {
                edtrTree._hide_popover();
            }
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
                keys:       [ "Enter" ],
                action:     edtrTree.on_double_click,
                args:       [ null, null, true ]
            }, {
                keys:       [ "Ctrl-N" ],
                action:     edtrTree.node_action,
                args:       ["add_file"]
            }, {
                keys:       [ "Ctrl-Alt-N" ],
                action:     edtrTree.node_action,
                args:       ["add_subdir"]
            }, {
                keys:       [ "Ctrl-Shift-N" ],
                action:     edtrTree.node_action,
                args:       ["rename"]
            }, {
                keys:       [ "Ctrl-E" ],
                action:     edtrTree.node_action,
                args:       ["edit"]
            }, {
                keys:       [ "Ctrl-R" ],
                action:     edtrTree.node_action,
                args:       ["refresh"]
            }, {
                keys:       [ "Ctrl-Shift-P" ],
                action:     edtrTree.node_action,
                args:       ["publish"]
            }, {
                keys:       [ "Ctrl-Shift-U" ],
                action:     edtrTree.node_action,
                args:       ["unpublish"]
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
        i, k, l, shortcut_parts;
        key_mods =
            (e.shiftKey << 0) +
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

    // Helper
    get_node_type:          function(node) {
        var ext = edtrHelper.get_filename_ext(node.name);
        return edtrTree.editor_type[ext];
    },

    // Go through all node's children recursively and perform
    // callback on each (excluding the node itself !)
    // returns number of callbacks performed
    traverse_tree:          function(node, callback) {
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

    // Sort alphabetically by filename and by extension
    _name_ext_sort:         function(n1, n2) {
        var ext1 = edtrHelper.get_filename_ext(n1.id),
            ext2 = edtrHelper.get_filename_ext(n2.id);
        if (ext1 > ext2) return 1;
        if (ext1 < ext2) return -1;
        if (n1.id > n2.id) return 1;
        if (n1.id < n2.id) return -1;
        return 0;
    },

    // Move node to alphabetical position within parent
    sort_node_in_parent:    function(node, parent_node) {
        if (!parent_node.isParent)
            return;
        var nodes = parent_node.children, i;
        if (nodes.length > 1) {
            for (i in nodes) {
                if (node.isParent && !nodes[i].isParent ||
                    (node.isParent === nodes[i].isParent && edtrTree._name_ext_sort(node, nodes[i]) <= 0))
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
    sort_nodes:             function(nodes) {
        // Separate dirs and files
        // We use _ filter method
        var dirs = _.filter(nodes, function(elem, index, array) {return elem.isParent;}),
            files = _.filter(nodes, function(elem, index, array) {return !elem.isParent;});

        dirs.sort(edtrTree._name_ext_sort);
        files.sort(edtrTree._name_ext_sort);

        // Place dirs first
        dirs.push.apply(dirs, files);
        return dirs;
    },

    // Update existing ztree node with new server data
    _update_tree_node:      function(node, server_data) {
        // We don't touch the essentials (id, name, isParent)
        // and expect them to be the same
        // But do the sanity check, just in case
        if (node.id !== server_data._id ||
            node.name !== edtrHelper.get_filename(server_data._id) ||
            node.isParent !== server_data.is_dir) {
            messagesBar.show_internal_error("edtrTree._update_tree_node", "essential data has changed ?!");
        }

        // Update extra file info
        node.size_bytes     = server_data.bytes;
        node.size_text      = server_data.size;
        node.mime_type      = server_data.mime_type;
        node.modified       = server_data.modified;
        node.client_mtime   = server_data.client_mtime;
        node.rev_id         = server_data.rev;
        node.rev_num        = server_data.revision;

        // If those values are not provided by server, we don't update them
        if (server_data.thumbnail_url)
            node.thumbnail_url = server_data.thumbnail_url;
        // Meta data
        if (server_data.pub_status)
            node.pub_status = server_data.pub_status;

        // Set correct icon
        edtrTree.update_node_icon(node);
    },

    // Change node icon to state
    // should be one of the values from node.icons
    update_node_icon:      function(node, state) {
        // If node is opened in editor - set editing icon
        if (edtrTree.editor && edtrTree.editor.find_tab(node.id, false) !== -1) {
            node.icon = node.icons.editing;
        }
        else {
            // If state is not provided - set icon according to pub_state
            if (state === undefined)
                state = edtrSettings.PUB_STATUS[node.pub_status];
            node.icon = node.icons[state];
        }
        edtrTree.ztree.updateNode(node);
    },

    // Transform server data into ztree node
    _create_tree_node:      function (server_data) {
        var tree_node = {
            // Essentials
            id:                 server_data._id,
            name:               edtrHelper.get_filename(server_data._id),
            // path:               edtrHelper.get_filename_path(server_data._id),
            isParent:           server_data.is_dir,
            // Extra file info
            size_bytes:         server_data.bytes,
            size_text:          server_data.size,
            mime_type:          server_data.mime_type,
            modified:           server_data.modified,
            client_mtime:       server_data.client_mtime,
            rev_id:             server_data.rev,
            rev_num:            server_data.revision,
            // thumb_exists:       server_data.thumb_exists,
            // Meta data
            pub_status:         0 // HACK: unpublished is default (see edtrSettings)
        };
        if (server_data.pub_status !== undefined)
            tree_node.pub_status = server_data.pub_status;
        // Set specific icons for all files
        // folders will have default ztree open/close icons
        // TODO: add specific icons for each state:
        //      published:      small world icon at bottom right corner of the def icon
        //      draft:          small edit icon at bottom right corner of the def icon
        //      unpublished:    def icon
        //      editing:        large edit icon over the def icon
        if (!tree_node.isParent) {
            var base_icon_url = edtrSettings.base_icon_url;
            tree_node.icons = {
                def:        base_icon_url+"dropbox-api-icons/16x16/"+server_data.icon+".gif",
                large:      base_icon_url+"dropbox-api-icons/48x48/"+server_data.icon+"48.gif",
                published:  base_icon_url+"famfamfam_silk_icons_v013/icons/world.png",
                editing:    base_icon_url+"famfamfam_silk_icons_v013/icons/page_edit.png"
            };
            tree_node.icons.draft = tree_node.icons.def;
            tree_node.icons.unpublished = tree_node.icons.def;
            // Set icon according to publish status
            // or, if node is opened in editor - set editing icon
            if (edtrTree.editor && edtrTree.editor.find_tab(tree_node.id, false) !== -1)
                tree_node.icon = tree_node.icons.editing;
            else
                tree_node.icon = tree_node.icons[edtrSettings.PUB_STATUS[tree_node.pub_status]];
            // Set thumbnail url to real thumb or to large icon
            if (server_data.thumbnail_url !== undefined)
                tree_node.thumbnail_url = server_data.thumbnail_url;
            else
                tree_node.thumbnail_url = tree_node.icons.large;
        }
        return tree_node;
    },

    // Called by zTree after receiving ajax response for node
    process_server_json:    function (ztree, parent_node, data) {
        var nodes = [], i;
        if (data.errcode) {
            serverComm.process_errcode("edtrTree.process_server_json", data);
            return;
        }
        // debugger;
        // Build tree nodes from server data
        for (i in data.tree) {
            nodes.push(edtrTree._create_tree_node(data.tree[i]));
        }
        return edtrTree.sort_nodes(nodes);
    },

    // Get selected node (we can only have one)
    // If nothing is selected - we assume selection to be root
    get_selected_node:          function() {
        var selected = edtrTree.ztree.getSelectedNodes();
        return selected.length? selected[0] : edtrTree.get_root_node();
    },

    // Get root node (we can only have one)
    get_root_node:              function() {
        return edtrTree.ztree.getNodes()[0];
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
                var prev_node = selected.getPreNode();
                if (!prev_node)
                    prev_node = selected.getParentNode();
                else if (prev_node.isParent && prev_node.open &&
                    prev_node.children.length)
                    prev_node = prev_node.children[prev_node.children.length-1];
                if (prev_node)
                    edtrTree.ztree.selectNode(prev_node);
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
    is_checkbox_mode:           function() {
        return edtrTree.ztree.setting.check.enable;
    },
    toggle_checkboxes:          function() {
        // Also update menu items
        if (edtrTree.is_checkbox_mode()) {
            edtrTree.dom_menu_cb.addClass("disabled");
            edtrTree.ztree.setting.check.enable = false;
        }
        else {
            edtrTree.dom_menu_cb.removeClass("disabled");
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
            edtrTree.ztree.selectNode(edtrTree.get_root_node());
        // Restore keyboard focus
        edtrTree.dom_db_tree.focus();
    },
    // Clear checkboxes in tree view
    clear_checkboxes:           function() {
        if (edtrTree.is_checkbox_mode())
            edtrTree.ztree.checkAllNodes(false);
    },

    //
    // Get all checked nodes and filter them, so that 'remove'
    // can be performed more efficiently
    // Assumes that getCheckedNodes() returns list ordered by dirs first
    // which should always be the case, since we always sort tree nodes that way
    //
    get_filtered_checked_nodes: function() {
        // debugger;
        var nodes = edtrTree.ztree.getCheckedNodes(true),
            filtered_nodes = [], i, k, parent_id;
        // Filter the nodes list
        for (i in nodes) {
            // Always ignore root
            if (!nodes[i].getParentNode())
                continue;
            // Check if we already have this node's parent
            // If we do - ignore it
            parent_id = nodes[i].getParentNode().id;
            for (k=0; k < filtered_nodes.length; k++)
                if (filtered_nodes[k].id === parent_id)
                    break;
            // We don't have node's parent
            if (k === filtered_nodes.length) {
                if (!nodes[i].isParent) {
                    // Not a directory - add node
                    filtered_nodes.push(nodes[i]);
                }
                else { // Directory, add if
                    if (nodes[i].check_Child_State === 2 || // all children are checked
                        nodes[i].check_Child_State === -1)  // or it has no children
                        filtered_nodes.push(nodes[i]);
                }
            }
        }
        return filtered_nodes;
    },

    // Updated menu state on left click and on right click
    _update_menu:           function(node) {
        if (node.isParent) {
            edtrTree.dom_menu_refresh.removeClass("disabled");
            edtrTree.dom_menu_edit.removeClass("disabled");
        } else {
            edtrTree.dom_menu_refresh.addClass("disabled");
            edtrTree.dom_menu_edit.addClass("disabled");
        }
    },

    // Called by zTree on left mouse click
    on_click:               function(e, ztree, node, flag) {
        // console.log("click", node.id);
        edtrTree.dom_rc_menu.dir.removeClass("open");
        edtrTree.dom_rc_menu.file.removeClass("open");
        edtrTree.dom_db_tree.focus();
        // Shift-Click inserts clicked node into editor
        // Its up to the editor to decide how to insert it
        // (as link, as node.name or as node.id)
        if (e && e.shiftKey) {
            if (edtrTree.editor && !edtrTree.editor.is_hidden) {
                edtrTree.editor.insert_node(node, edtrTree.get_node_type(node));
            }
        }
        edtrTree._update_menu(node);
    },

    // Called by zTree on right mouse click
    // show context menu for node
    on_right_click:         function(e, ztree, node) {
        // Always remove previous context menu
        edtrTree.dom_rc_menu.dir.removeClass("open");
        edtrTree.dom_rc_menu.file.removeClass("open");

        // Right click NOT on node - ignore
        if (!node) return;

        edtrTree._update_menu(node);

        var dom_elem = $("#"+node.tId), menu;
        menu = node.isParent ? edtrTree.dom_rc_menu.dir : edtrTree.dom_rc_menu.file;

        // console.log(e.pageX, e.pageY, node);
        // console.log(dom_elem.position().left, dom_elem.position().top);
        menu.css({
            left:   e.pageX-10,
            top:    e.pageY-40
        });
        edtrTree.ztree.selectNode(node);
        menu.addClass("open");
        var remove_menu = function() {
            menu.removeClass("open");
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

        edtrTree.open_editor(node);
    },

    //
    // Called by zTree when mouse enters node
    //
    on_hover:               function(ztree, node) {
        // Ignore root node
        if (node.id === "/")
            return;

        // console.log(edtrTree.shift_key);
        if (edtrTree.hover_timer) {
            // HACK: ztree is null when we are called from on(shiftKey)
            // and if mouse hover timer is already in progress, we give it preference
            if (!ztree) return;
            clearTimeout(edtrTree.hover_timer);
        }
        // var node_elem = $("#"+node.tId+"_a");
        //     node_pos = node_elem.offset().top,
        //     node_height = node_elem.height();
        //     container = edtrTree.dom_db_tree.parent(),
        //     container_top = container.offset().top,
        //     container_bottom = container_top + container.height();
        // console.log(node_pos - container_top, container_bottom - node_pos - node_height);

        // Show popover when mouse sits on node for 1 second
        // while Shift key is pressed
        edtrTree.hover_timer = setTimeout(function() {
            // console.log(edtrTree.shift_key);
            edtrTree.hover_timer = null;
            edtrTree._hide_popover();
            if (!edtrTree.shift_key)
                return;
            edtrTree.popover_node = node;
            edtrTree.popover = $("#"+node.tId+"_a").popover({
                offset:     20,
                trigger:    "manual",
                container:  "body",
                html:       true,
                title:      "<strong>"+node.name+"</strong>",
                content:    node.isParent ?
                    edtrTree.dir_info_template({
                        full_path:      node.id,
                        modified:       node.modified,
                        revision:       node.rev_num
                    })
                    :
                    edtrTree.file_info_template({
                        full_path:      node.id,
                        size_text:      node.size_text,
                        size_bytes:     node.size_bytes,
                        mime_type:      node.mime_type ? node.mime_type : "none",
                        modified:       node.modified,
                        revision:       node.rev_num,
                        thumbnail:      node.thumbnail_url
                    })
            }).data("popover");
            edtrTree.popover.show();
            // console.log("show info", node.tId);
        }, 1000);
    },

    _hide_popover:          function() {
        // return;
        edtrTree.popover_node = null;
        if (edtrTree.popover)
            edtrTree.popover.destroy();
    },

    //
    // Called by zTree when mouse leaves node
    //
    on_unhover:             function(ztree, node) {
        if (edtrTree.hover_timer)
            clearTimeout(edtrTree.hover_timer);
        edtrTree._hide_popover();
    },

    //
    // Called by zTree before user drags node
    //
    before_drag:             function(tree_id, nodes) {
        // debugger;
    },

    //
    // Called by zTree before user drops node
    //
    before_drop:             function(tree_id, nodes, to_node, move_type, is_copy) {
        // console.log("before drop", nodes[0].name, to_node.name, move_type);
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
        // console.log("drop", nodes[0].name, to_node.name, move_type);
        var recursive_node_fix = function(index) {
            // Break out of recursion
            if (index === nodes.length)
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
        if (node.on_expand_callback) {
            node.on_expand_callback.call(edtrTree);
            node.on_expand_callback = null;
        }
    },

    // Wrapper for ztree expandNode
    // Launches callback when tree node is expanded
    // Used by modal dialogs to display only when node's children are loaded
    expand_node:            function(node, callback) {
        if (node.open) {
            callback.call(edtrTree);
        }
        else {
            node.on_expand_callback = callback;
            edtrTree.ztree.expandNode(node, true, false, true, true);
        }
    },

    // Remove clipboard and clear tree highlighting set by clipboard()
    clear_clipboard:           function() {
        if (edtrTree.clipped) {
            edtrTree.clipped = null;
            // Gets ALL ztree nodes
            var nodes = edtrTree.ztree.getNodesByFilter(function() {return true;}), i;
            for (i in nodes) {
                $("#"+nodes[i].tId+"_span").css("color", "");
            }
        }
    },

    // Show modal with clipboard contents
    show_clipboard:             function() {
        var nodes, i, text="";
        if (edtrTree.clipped) {
            nodes = edtrTree.clipped.nodes;
            for (i in nodes) {
                text += nodes[i].id + (nodes[i].isParent? "/\n" : "\n");
            }
        } else {
            text = "You don't have clipped files.\nUse Edit->Copy or Edit->Cut to clip.";
        }
        modalDialog.params = {
            action:         "show_clipboard",
            template_vars: {
                filenames:  text
            }
        };
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
        var i, color = action === "copy" ? "blue" : "lightblue";
        for (i in nodes) {
            $("#"+nodes[i].tId+"_span").css("color", color);
        }
    },

    //
    // Smart paste is done in two steps:
    // First, paste_node is set and then paste() is called
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
            // Error should already be displayed
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

    //
    // Validate and assign paste node
    // returns false if paste node is not selected correctly
    //
    set_paste_node:         function(node) {
        // If we don't have a clipboard or paste is not into folder - break out
        if (!edtrTree.clipped || !node.isParent) {
                messagesBar.show_notification_warning("Can't paste into <strong>"+
                    node.id+"</strong>. Internal error.");
            return false;
        }
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
    //      nodes:         the nodes to paste
    //      paste_node:    node to paste to
    //      action:        clip action - "copy" or "cut"
    //
    // We expect paste_node to be already opened by smart_paste()
    //
    paste:                  function() {
        if (edtrTree.clipped) {
            // console.log("paste", edtrTree.clipped.nodes, "to",
            //     edtrTree.clipped.paste_node, "via", edtrTree.clipped.action);
            // debugger;
            var ztree_action;
            if (edtrTree.clipped.action === "copy")
                ztree_action = edtrTree.ztree.copyNode;
            else
                ztree_action = edtrTree.ztree.moveNode;
            // Paste node by index using ztree_action
            // and perform necessary checks
            var recursive_paste_node = function(ztree_action, index, callback) {
                // Break out of recursion
                if (edtrTree.clipped.nodes.length === index) {
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
            edtrTree.show_loading_node(edtrTree.clipped.paste_node, true);
            recursive_paste_node(ztree_action, 0, function() {
                edtrTree.show_loading_node(edtrTree.clipped.paste_node, false);
                // Called when recursion is done
                edtrTree.clear_clipboard();
                edtrTree.ztree.checkAllNodes(false);
                // Restore keyboard focus
                edtrTree.dom_db_tree.focus();
            });
        }
    },

    // Check for overwrites and fix node's and it children's ids
    // Also sort node within its new parent
    fix_node_after_paste: function(node, callback) {
        if (!edtrTree.clipped) return;
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
                    cancel_fix();
                }
            },
            cancel_fix = function() {
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
                    edtrTree.sort_node_in_parent(node, old_parent);
                }
                callback.apply(edtrTree);
            },
            fix_node = function() {
                var server_data = {}, new_path, server_action;
                // Calculate new node path
                new_path = edtrTree.clipped.paste_node.id;
                if (new_path !== "/") new_path += "/";
                new_path += node.name;
                server_data.path        = node.id;
                server_data.from_path   = node.id;
                server_data.to_path     = new_path;
                if (edtrTree.clipped.action === "copy")
                    server_action = "copy";
                else
                    server_action = "move";
                // Perform server action and if successful do the tree action
                serverComm.action("dropbox", server_action, server_data, function(data) {
                    // Error should be already displayed
                    if (data.errcode) {
                        cancel_fix();
                        return;
                    }
                    // Fix node id to new path
                    node.id = new_path;
                    edtrTree.ztree.updateNode(node);
                    // TODO: if file is opened in editor - rename tab

                    // and do the same for its children
                    if (node.isParent) {
                        edtrTree.traverse_tree(node, function(child) {
                            child.id = edtrTree.clipped.paste_node.id +
                                child.id.split(node.id).pop();
                            edtrTree.ztree.updateNode(child);
                        });
                    }
                    edtrTree.sort_node_in_parent(node, edtrTree.clipped.paste_node);
                    callback.apply(edtrTree);
                });
            };

        // Go through nodes (children of paste_node)
        // and see if we overwrite anything
        for (var i in nodes) {
            // Same name, but different path - it's an overwrite
            if (node.name === nodes[i].name &&
                node.id !== nodes[i].id) {
                // Present confirmation dialog for overwriting existing node
                modalDialog.params = {
                    action:         "overwrite_confirm",
                    callback:       confirm_callback,
                    template_vars:  {
                        filename:       nodes[i].id,
                        with_filename:  node.id
                    }
                };
                modalDialog.show_confirm_modal();
                // Node will be fixed in confirm_callback if confirmed by user
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
            if (i === -1)
                messagesBar.show_internal_error("edtrTree.process_ajaxing_nodes", "Can't find node "+node.id);
            else
                edtrTree.ajaxing_nodes.splice(i, 1);
            if (edtrTree.ajaxing_nodes.length === 0) {
                edtrTree.ajaxing_nodes = null;
                edtrTree.ajaxing_callback.apply(edtrTree);
            }
        }
    },

    // Show/hide node loading animation
    show_loading_node: function(node, state) {
        var dom_ico = edtrTree.dom_db_tree.find("#" + node.tId + "_ico");
        if (state) {
            if (node.is_loading)
                console.log("show_loading_node: already loading ?!");
            node.is_loading = true;
            node.saved_class = dom_ico.attr("class");
            node.saved_bg  = dom_ico.css("background");
            dom_ico.attr("class", "button ico_loading");
            dom_ico.css("background", "");
        } else {
            if (!node.is_loading) {
                console.log("show_loading_node: already stopped ?!");
                node.saved_class = "button";
            }
            node.is_loading = false;
            dom_ico.attr("class", node.saved_class);
            dom_ico.css("background", node.saved_bg);
        }
    },

    // Call refresh on all opened nodes and call callback function when done
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
                        edtrTree.ztree.selectNode(edtrTree.get_root_node());
                    callback.apply(edtrTree);
                }
            };
        // Save children before refresh
        old_parent = edtrTree.get_root_node();
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

    // Edit node - preset modal with appropriate fields
    // For directory:
    //      user can change publish mechanism, set domain, etc
    // For file:
    //      user can edit Metadata
    //
    edit_node_info:         function(node) {
        if (node.isParent) {
            // Directory settigs dialog
            messagesBar.show_notification_warning("Directory editing is not supported yet");
        } else {
            // File settigs dialog
            messagesBar.show_notification_warning("File editing is not supported yet");
        }
    },

    // User requested action
    // We may need to display confirmation dialog
    // We store all dialog params in modalDialog.params
    // And modal uses it to display correct dialog and data
    //
    // action:      add_file, add_subdir, rename, remove, copy, cut, paste
    //
    node_action:            function(action) {
        var i;

        // First process single node actions
        var selected_node = edtrTree.get_selected_node();
        if (selected_node.is_loading) {
            messagesBar.show_notification_warning("Please wait for previous action to complete");
            return;
        }

        // Actions below always work on single node, even if checkbox mode is active
        switch (action) {
            case "paste":
                // Paste works on root, so we process it first
                // Since it can be also called via keyboard, it calculates selected_node by itself
                edtrTree.smart_paste();
                return;
            case "refresh":
                // Refresh selected node
                edtrTree.ztree.reAsyncChildNodes(selected_node, "refresh", false);
                return;
            case "edit":
                // Edit selected node (shows modal)
                edtrTree.edit_node_info(selected_node);
                return;
        }

        // Allowed actions for checkbox mode are: remove and clipboard operations
        if (edtrTree.is_checkbox_mode()) {
            var nodes = edtrTree.get_filtered_checked_nodes();
            // Perform action on checkboxes only if at least one is checked
            // otherwise we work in 'single node selection mode' (below)
            if (nodes.length) {
                switch(action) {
                    case "remove":
                    case "publish":
                    case "unpublish":
                        // Create text view from nodes
                        var filenames="";
                        for (i in nodes)
                            filenames += nodes[i].id + (nodes[i].isParent? "/\n" : "\n");
                        modalDialog.params = {
                            action:         action + "_checked",
                            path:           null,
                            filename:       nodes,
                            template_vars:  {
                                filenames:          filenames
                            }
                        };
                        modalDialog.show_file_modal();
                        return;
                    case "copy":
                    case "cut":
                        edtrTree.clipboard_action(action, nodes);
                        return;
                }
            } // if nodes checked
        } // if in checkbox mode


        //
        // All actions below perform in 'single node' mode
        //

        // Ignore all operations on root, except "add_"
        if (selected_node.id === '/' && $.inArray(action, ["add_file", "add_subdir"]) === -1) {
            messagesBar.show_notification_warning("Will not "+action+" root folder.");
            return;
        }

        switch (action) {
            case "remove":
            case "publish":
            case "unpublish":
                // Always show confirmation dialog
                modalDialog.params = {
                    action:         action + (selected_node.isParent ? "_subdir" : "_file"),
                    path:           selected_node.getParentNode().id,
                    filename:       selected_node.name,
                    template_vars:  {
                        filename:           selected_node.id,
                        publish_url:        "http://usersite.edtr.me/file.html"
                    }
                };
                // Always expand the directory we're about to remove/publish/unpublish
                if (selected_node.isParent)
                    edtrTree.expand_node(selected_node, modalDialog.show_file_modal);
                else
                    modalDialog.show_file_modal();
                break;
            case "add_file":
            case "add_subdir":
                if (!selected_node.isParent) {
                    // File is selected - use it's parent dir for adding
                    selected_node = selected_node.getParentNode();
                }
                // Always present file/dir add dialog
                modalDialog.params = {
                    action:         action,
                    path:           selected_node.id,
                    filename:       "",
                    no_names:       [],
                    template_vars:  {
                        path:               selected_node.id,
                        default_filename:   ""
                    }
                };
                // Expand node and only then launch modal
                edtrTree.expand_node(selected_node, function() {
                    // Create list of files in the parent directory to disallow user
                    // adding the file with the same filename as any of the existing filenames
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
                modalDialog.params = {
                    action:         action + (selected_node.isParent ? "_subdir" : "_file"),
                    path:           parent.id,
                    filename:       selected_node.name,
                    no_names:       [],
                    template_vars:  {
                        path:               parent.id,
                        from_filename:      selected_node.name,
                        default_filename:   selected_node.name
                    }
                };
                // Create list of files in the parent directory to disallow user
                // renaming the file to the same filename as any of the existing filenames
                for (i in parent.children)
                    modalDialog.params.no_names.push(parent.children[i].name);
                modalDialog.show_file_modal();
        }
    },

    //
    // Perform requested file action in ztree:
    // Called from modal dialog
    //
    // action:          add_file, add_subdir,
    //                  remove_file, remove_subdir,
    //                  rename_file, rename_subdir,
    //                  remove_checked,
    // path:            path to directory where filename resides
    //                  IMPORTANT: path is without the '/' and the end (unless it is '/')
    // filename:        file name to perform action on
    // filename_new:    file name to rename to (if action is rename)
    //
    file_action:            function(action, path, filename, filename_new) {
        //console.log(action, path, filename, filename_new);
        var human_action = {
            "add_file":             "file <b>{2}</b> was added to <b>{1}</b>",
            "add_subdir":           "directory <b>{2}</b> was added to <b>{1}</b>",
            "rename_file":          "file <b>{0}</b> was renamed to <b>{2}</b> in <b>{1}</b>",
            "rename_subdir":        "directory <b>{0}</b> was renamed to <b>{2}</b> in <b>{1}</b>",
            "remove_file":          "file <b>{0}</b> was removed from <b>{1}</b>",
            "remove_subdir":        "directory <b>{0}</b> was removed from <b>{1}</b>",
            "publish_file":         "file <b>{0}</b> was published to the web",
            "unpublish_file":       "file <b>{0}</b> was unpublished from the web",
            "publish_subdir":       "directory <b>{0}</b> and all its contents was published to the web",
            "unpublish_subdir":     "directory <b>{0}</b> and all its contents was unpublished from the web"
        }, server_action = {
            "remove_checked":       "delete",
            "publish_checked":      "publish",
            "unpublish_checked":    "unpublish",
            "add_file":             "save_file",
            "add_subdir":           "create_dir",
            "rename_file":          "move",
            "rename_subdir":        "move",
            "remove_file":          "delete",
            "remove_subdir":        "delete",
            "publish_file":         "publish",
            "unpublish_file":       "unpublish",
            "publish_subdir":       "publish",
            "unpublish_subdir":     "unpublish"
        }, i;

        // Action is requested while in checkbox mode and on an array of nodes
        // It is possible that user would perform an action on single node while in checkbox mode
        // in this case, filename will be string and not an array of nodes
        if (edtrTree.is_checkbox_mode() && typeof filename !== "string") {
            switch(action) {
                case "remove_checked":
                case "publish_checked":
                case "unpublish_checked":
                    var nodes = filename;
                    // Perform server action recursively, to react on errors
                    var recursive_node_action = function(action, index, callback) {
                        // Break out of recursion
                        if (nodes.length == index) {
                            callback.apply(edtrTree);
                            return;
                        }
                        // Perform server action and if successful do the tree action
                        edtrTree.show_loading_node(nodes[index], true);
                        edtrTree.show_loading_node(nodes[index].getParentNode(), true);
                        serverComm.action("dropbox", action,
                            { path: nodes[index].id },
                            function(data) {
                                edtrTree.show_loading_node(nodes[index], false);
                                edtrTree.show_loading_node(nodes[index].getParentNode(), false);
                                // Error should be already displayed, if there was one
                                if (data.errcode === 0) {
                                    switch(action) {
                                        case "delete":
                                            edtrTree.ztree.removeNode(nodes[index]);
                                            // If file is opened in editor - remove tab
                                            // We simply ask for removal of tab and ignore errors
                                            edtrTree.editor.close_tab(nodes[index].id, false);
                                            break;
                                        case "publish":
                                            // TODO: update node with new data and change tree icon
                                            // if file is opened in editor - also change tab icon
                                            break;
                                        case "unpublish":
                                            // TODO: update node with new data and change tree icon
                                            // if file is opened in editor - also change tab icon
                                            break;
                                    }
                                }
                                // Continue recursion
                                recursive_node_action(action, index+1, callback);
                            });
                    };
                    // We use recursive action to allow modal dialogs and callbacks
                    recursive_node_action(server_action[action], 0, function() {
                        // Called when recursion is done
                        edtrTree.ztree.checkAllNodes(false);
                        edtrTree.ztree.selectNode(edtrTree.get_root_node(), false);
                        // Notify user
                        messagesBar.show_notification(server_action[action] + " operation on checked items is complete");
                    });
                    return true;
                default:
                    messagesBar.show_internal_error("edtrTree.file_action", "Unknown action: "+action);
                    return false;
            }
        }

        // Get parent node
        // path is always WITHOUT '/' at the end
        var parent_node = edtrTree.ztree.getNodeByParam("id", path);
        if (!parent_node) {
            messagesBar.show_internal_error("edtrTree.file_action", "Can't find parent_node "+path);
            return false;
        }

        // path is always WITHOUT '/' at the end
        var full_path_new = path === '/' ? path + filename_new : path + '/' + filename_new,
            full_path_old = path === '/' ? path + filename : path + '/' + filename,
            node,
            server_data = {path: full_path_new};

        // Process action in ztree
        if ($.inArray(action, ["add_file", "add_subdir"]) !== -1) {
            // General parameters
            // node = {
            //     id:         full_path_new,
            //     name:       filename_new
            // };
            // Specific parameters
            switch(action) {
                case "add_file":
                    // Save empty file
                    server_data.content = "";
                    // node.isParent = false;
                    break;
                case "add_subdir":
                    // node.isParent = true;
                    break;
            }
            // Perform server action and if successful do the tree action
            edtrTree.show_loading_node(parent_node, true);
            serverComm.action("dropbox", server_action[action], server_data, function(data) {
                edtrTree.show_loading_node(parent_node, false);
                // Error should be already displayed
                if (data.errcode)
                    return;
                node = edtrTree._create_tree_node(data.meta);
                var ztree_node = edtrTree.ztree.addNodes(parent_node, [node], true)[0];
                edtrTree.sort_node_in_parent(ztree_node, parent_node);
                // Notify user
                messagesBar.show_notification(human_action[action].format(
                    filename, path, filename_new));
            });
            return true;
        } else { // Remove, Rename, Publish or Unpublish
            // Find corresponding node in tree
            var found_nodes = edtrTree.ztree.getNodesByFilter(function(n) {
                return n.name === filename && n.getParentNode().id === path;
            }, false, parent_node);

            // Some sanity checks
            if (!found_nodes) {
                messagesBar.show_internal_error("edtrTree.file_action",
                    "Can't find node "+filename+" in "+path);
                return false;
            }
            if (found_nodes.length > 1) {
                messagesBar.show_internal_error("edtrTree.file_action",
                    "Too many nodes with the same name ("+filename+") in "+path);
                return false;
            }

            // We found our node
            node = found_nodes[0];
            switch (action) {
                case "rename_file":
                case "rename_subdir":
                    server_data.from_path   = full_path_old;
                    server_data.to_path     = full_path_new;
                    // Perform server rename and if successful do the tree rename
                    edtrTree.show_loading_node(node, true);
                    serverComm.action("dropbox", "move", server_data, function(data) {
                        edtrTree.show_loading_node(node, false);
                        // Error should be already displayed
                        if (data.errcode)
                            return;
                        // TODO: server_data should contain new node info
                        // right now it contains from_path, to_path
                        // edtrTree._update_tree_node(node, server_data);
                        node.id     = full_path_new,
                        node.name   = filename_new;
                        edtrTree.ztree.updateNode(node);
                        // Notify user
                        messagesBar.show_notification(human_action[action].format(
                            filename, path, filename_new));
                        // TODO: if file is opened in editor - rename tab
                    });
                    break;
                case "remove_file":
                case "remove_subdir":
                case "publish_file":
                case "publish_subdir":
                case "unpublish_file":
                case "unpublish_subdir":
                    // Perform server rename and if successful do the tree rename
                    edtrTree.show_loading_node(node, true);
                    edtrTree.show_loading_node(parent_node, true);
                    serverComm.action("dropbox", server_action[action], server_data, function(data) {
                        edtrTree.show_loading_node(node, false);
                        edtrTree.show_loading_node(parent_node, false);
                        // Error should be already displayed, if there was one
                        if (data.errcode)
                            return false;
                        switch(server_action[action]) {
                            case "delete":
                                edtrTree.ztree.removeNode(node, false);
                                edtrTree.ztree.selectNode(parent_node, false);
                                // If file is opened in editor - remove tab
                                // We simply ask for removal of tab and ignore errors
                                edtrTree.editor.close_tab(node.id, false);
                                break;
                            case "publish":
                                // TODO: update node with new data and change tree icon
                                // if file is opened in editor - also change tab icon
                                debugger;
                                edtrTree._update_tree_node(node, server_data);
                                break;
                            case "unpublish":
                                // TODO: update node with new data and change tree icon
                                // if file is opened in editor - also change tab icon
                                edtrTree._update_tree_node(node, server_data);
                                break;
                        }
                        // Notify user
                        messagesBar.show_notification(human_action[action].format(
                            filename, path, filename_new));
                    });
                    break;
            }
            return true;
        }
        messagesBar.show_internal_error("edtrTree.file_action", "Unprocessed action "+action+" on "+
            filename+", "+filename_new+" in "+path);
        // console.log("file_action ERROR:", action, path, filename, filename_new);
        return false;
    },

    //
    // Perform requested update:
    // Called from sockets io
    //
    // source:          protocol. currently only "dropbox" is supported
    // server_data:     node data sent by server
    // callback:        we call this when update is done or failed, passing the
    //                  success status (true or false)
    //
    process_server_update:  function(source, server_data, callback) {
        // Sanity check
        if (server_data._id === "/") {
            messagesBar.show_internal_error("edtrTree.process_server_update", "Update on root ?! Ignoring...");
            callback.call(null, false);
            return;
        }

        // Find corresponding node
        node = edtrTree.ztree.getNodesByFilter(function(node) {
            return node.id/*.toLowerCase()*/ === server_data._id;
        }, true);
        // if (!node && !update) {
        //     messagesBar.show_internal_error("edtrTree.process_server_update",
        //          "Can't find node for "+server_data._id);
        //     console.log(update);
        //     callback.call(null, false);
        //     return;
        // }

        // _action is 0 when file was removed
        if (server_data._action === 0) {
            var node_type = "";
            if (node) {
                // parent_node = node.getParentNode();
                edtrTree.ztree.removeNode(node, false);
                // edtrTree.ztree.selectNode(parent_node, false);
                node_type = node.isParent ? "Directory" : "File";
            }
            // Notify user
            messagesBar.show_notification_warning("UPDATE: " +
                node_type + " <strong>" + server_data._id +
                "</strong> was removed from dropbox" +
                (node ? "": " (wasn't shown)") );
            // TODO: if file is opened in editor - ask user if he wants to close the tab
            callback.call(null, true);
            return;
        }

        // We have corresponding node in tree
        if (node) {
            edtrTree._update_tree_node(node, server_data);
            // TODO: blink tree node to show that it has been updated
            // TODO: if file is opened in editor ask if user wants to reload it
            callback.call(null, true);
            return;
        }

        // Add new node to the tree, based on update data
        var parent_path = edtrHelper.get_filename_path(server_data._id);
        parent_node = edtrTree.ztree.getNodesByFilter(function(node) {
            return node.id.toLowerCase() === parent_path;
        }, true);
        if (!parent_node) {
            messagesBar.show_internal_error("edtrTree.process_server_update",
                "Can't find parent node for "+server_data._id);
            callback.call(null, false);
            return;
        }
        // Only add new node to the tree if it's parent is open
        // Otherwise skip adding and it will be automatically added when
        // parent is opened by ajax
        node = edtrTree._create_tree_node(server_data);
        if (parent_node.open) {
            var new_node = edtrTree.ztree.addNodes(parent_node, [node], true)[0];
            edtrTree.sort_node_in_parent(new_node, parent_node);
        } else {
            // TODO: blink tree node to show that it has new children
        }
        // Notify user
        messagesBar.show_notification_warning("UPDATE: New " +
            (node.isParent ? "directory" : "file") +
            " <strong>" + node.name + "</strong> was added to" +
            " <strong>" + parent_path + "</strong>");
        callback.call(null, true);
        return;
    },

    //
    // Open CodeMirror replacing textarea and load selected file into it
    // TODO: should be a method of edtrCodemirror object
    //
    open_editor:            function(node) {
        // Already trying to open or perform other file action ?
        if (node.is_loading) {
            messagesBar.show_notification_warning("Action is already in progress...");
            return;
        }

        // Load editor code for correct extension
        var content_type = edtrTree.get_node_type(node);
        if (!content_type) {
            messagesBar.show_notification_warning(
                "No editor defined for file <strong>"+node.name+"</strong>");
            return;
        }

        if (content_type !== "markdown" && content_type !== "html" && content_type !== "image" ) {
            messagesBar.show_error("ERROR: content "+content_type+" is not supported");
            return;
        }

        var _open_node_in_editor = function(node) {
            // Retrieve file from dropbox
            // Server provides us with file content and dropbox meta info
            edtrTree.show_loading_node(node, true);
            serverComm.action("dropbox", "get_file",
                { path: node.id },
                function(data) {
                    // debugger;
                    edtrTree.show_loading_node(node, false);
                    if (data.errcode) {
                        // Error should already be displayed
                        return;
                    }

                    // For images we get dropbox url in data.content and use it in fancybox preview
                    if (content_type === "image") {
                        // Sanity check
                        if (serverComm.FILE_TYPES[data.type] !== content_type) {
                            messagesBar.show_internal_error("_open_node_in_editor",
                                "mismatched file type ! ours: ", content_type,
                                "server:", serverComm.FILE_TYPES[data.type]);
                        }
                        edtrTree.show_img_gallery(node, data.content);
                        return;
                    }

                    // Update node data
                    edtrTree._update_tree_node(node, data.meta);

                    // Insert editor HTML code (toolbar, textarea, buttons) into content div
                    // TODO: remove previous codemirror and all bindings (?)
                    if (!edtrTree.editor) {
                        // Set correct dom structure (editor and toolbar)
                        // TODO: do we need a different editor HTML for different filetypes ?
                        // Probably just the toolbar should be different
                        // edtrTree.dom_editor.html($("#"+content_type+"_editor_html").html());
                        edtrTree.dom_editor.append($("#edtr_editor_template").html());
                        // Create new editor and save node with it
                        edtrTree.editor = new edtrCodemirror();
                        edtrTree.editor.init(
                            edtrTree.dom_editor,
                            $('body').find(".preview-container"));
                    }

                    // Open file in tab
                    edtrTree.editor.add_tab(node, content_type, data.content);
                    // messagesBar.show_notification("File <b>"+node.id+"</b> was loaded into the editor");
            });
        };
        // Replace existing tab or open new one
        if (edtrTree.editor && edtrTree.editor.find_tab(node.id) !== -1) {
            edtrTree.editor.confirm_replace_tab(node, function(is_confirmed) {
                if (is_confirmed)
                    _open_node_in_editor(node);
            });
        } else {
            _open_node_in_editor(node);
        }
    },

    //
    // Open jQuery lightbox and show gallery with images in the
    // same directory as selected one
    //
    // node:        clicked node
    // first_url:   url to the node's image (on dropbox)
    //
    show_img_gallery:       function(node, first_url) {
        // Build a list of images in the same directory
        // var siblings = node.getParentNode().children,
        //     images = [],
        //     i, pos;
        // for (i in siblings) {
        //     if (!siblings[i].isParent) {
        //         var ext             = edtrHelper.get_filename_ext(siblings[i].name),
        //             content_type    = edtrTree.editor_type[ext];
        //         if (content_type === "image") {
        //             images.push({
        //                 node:   siblings[i],
        //                 title:  siblings[i].name,
        //                 href:   null
        //             });
        //             if (siblings[i].name === node.name) {
        //                 pos = images.length-1;
        //                 images[pos].href = first_url;
        //             }
        //         }
        //     }
        // }

        // Show nice image box
        $.fancybox(
            [{ href: first_url, title: node.name }],
            // images,
            {
                openEffect  : 'none',
                closeEffect : 'none',
                nextEffect  : 'none',
                prevEffect  : 'none',
                padding     : 0,
                margin      : 50
                // preload     : 1,
                // index       : pos,
                // helpers     : { buttons: {} },
                // beforeLoad   : function() {
                //     var index;

                //     index = $(this)[0].index;

                //     if (!images[index].href) {
                //         // Retrieve image url from server
                //         serverComm.get_dropbox_file(images[index].node.id, function(status, url) {
                //             images[index].href = url;
                //             console.log(images[index].href);
                //         });
                //         return false;
                //     }
                //     console.log(index, images[index].href);

                //     // // debugger;
                //     // if (i%2)
                //     //     images[i].href="https://dl.dropbox.com/0/view/9rorxkd89hiie0k/Apps/edtr/images/3cows.jpg";
                //     // else {
                //     //     images[i].href="https://stripe.com/img/frontpage/blueprints.png";
                //     // }
                //     $(this)[0].href = images[index].href;
                //     //i++;
                //     return true;
                // },
                // afterLoad   : function(current, previous) {
                // },
                // beforeShow  : function() {
                //     // $.fancybox.inner.attr("tabindex", "-1");
                //     // $.fancybox.inner.focus();
                //     // debugger;
                //     // if (i%2)
                //     //     $.fancybox.inner.html('<img src="https://stripe.com/img/frontpage/api-cloud.png">');
                //     // else
                //     //     $.fancybox.inner.html('<img src="https://stripe.com/img/frontpage/blueprints.png">');
                //     // i++;
                //     // var id = $.fancybox.inner.find('iframe').attr('id');

                //     // // Create video player object and add event listeners
                //     // var player = new YT.Player(id, {
                //     //     events: {
                //     //         'onReady': onPlayerReady,
                //     //         'onStateChange': onPlayerStateChange
                //     //     }
                //     // });
                // }
            }
        );
    }




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
