$(document).ready(function() {
    // Set nav bar selection
    // $('.navbar_li').removeClass('active');
    // $('#navbar_home').addClass('active');

    //
    // Sidebar Actions (View)
    //
    // Toggle checkboxes in tree
    $("#sb_view_multiselect").on("click", function() {
        edtrTree.toggle_checkboxes();
    });
    // Cleat all checkboxes in tree (should also clear clipboard)
    $("#sb_view_clear_select").on("click", function() {
        edtrTree.clear_checkboxes();
    });


    //
    // Sidebar Actions (Edit)
    //
    // Add New file/subdir
    $(".sb_add").on("click", function() {
        // Save for callback
        modalDialog.cb = {};
        modalDialog.cb.action   = $(this).data("action");
        modalDialog.cb.filename = "";

        var selected_node = edtrTree.get_selected_node(),
            node = null;
        // Always expand the directory we're about to add to
        if (selected_node.isParent) {
            modalDialog.cb.header   = selected_node.id;
            modalDialog.cb.path     = modalDialog.cb.header;
            // If dir is selected - use it as root
            node = selected_node;
        } else {
            // File is selected - use it's dir (obviously, node is already expanded)
            modalDialog.cb.header   = selected_node.getParentNode().id;
            modalDialog.cb.path     = modalDialog.cb.header;
        }
        // If node is already expanded - launch modal
        if (!node || node.open)
            modalDialog.modal_on_callback();
        else
            // Expand node and only then launch modal
            edtrTree.expand_node(node, modalDialog.modal_on_callback);
    });
    // Rename/Remove file/subdir
    $(".sb_edit, .sb_clipboard").on("click", function() {
        var action = $(this).data("action");

        // debugger;
        // Allowed actions for checkbox mode are remove and clipboard operations
        if (edtrTree.is_checkbox_mode()) {
            var nodes = edtrTree.get_filtered_checked_nodes(),
                k, html="";
            // Perform action on checkboxes only if at least one is checked
            if (nodes.length) {
                switch(action) {
                    case "remove":
                        for (k=0; k < nodes.length; k++) {
                            // console.log(nodes[k].id);
                            html += nodes[k].id + (nodes[k].isParent? "/\n" : "\n");
                        }
                        modalDialog.cb = {};
                        modalDialog.cb.action   = action + "_checked";
                        modalDialog.cb.header   = html;
                        modalDialog.cb.path     = null;
                        modalDialog.cb.filename = nodes;

                        modalDialog.modal_on_callback();
                        return;
                    case "copy":
                    case "cut":
                    case "paste":
                        edtrTree.clipboard(action, nodes);
                        return;
                }
            } // if nodes checked
        } // if in checkbox mode

        // Selection mode
        var selected_node = edtrTree.get_selected_node();

        // Ignore operations on root
        if (selected_node.id === '/') {
            messagesBar.show_notification_warning("Will not "+action+" root folder.");
            return;
        }

        // Save for callback
        modalDialog.cb = {};
        modalDialog.cb.action   = action + (selected_node.isParent ? "_subdir" : "_file");
        modalDialog.cb.header   = action === "remove" ? selected_node.id : selected_node.name;
        modalDialog.cb.path     = selected_node.getParentNode().id;
        modalDialog.cb.filename = selected_node.name;

        // Always expand the directory we're about to remove
        if (action === "remove" && selected_node.isParent && !selected_node.open)
            edtrTree.expand_node(selected_node, modalDialog.modal_on_callback);
        else if($.inArray(action, ["copy", "cut", "paste"]) > -1)
            edtrTree.clipboard(action, [selected_node]);
        else
            modalDialog.modal_on_callback();
    });



    //
    // Init modal dialogs
    //
    modalDialog.init($("#modal_placeholder"));

    //
    // Refresh icon
    //
    syncIcon.init($('.sync-button'), function() {
        // Called when icon is clicked
        // Ask server to refresh dropbox data
        edtrTree.update_db_tree(false);
    });

    // Vertical and horizontal splitter hooks
    edtrSplitters.init(function() {
        // Called when drag has finished
        return;
    });

    messagesBar.init($('#messages_bar'), $('.main-view-right'));

    // Show tree on page load
    edtrTree.init();
    //edtrTree.update_db_tree(true);

    /*
    show_info("<b>Goodbye.</b> Come back again...");
    show_warning("<b>Ah oh</b> Something is wrong. But we will fix it...");
    show_error("<b>Oh Damn !</b> Something really BAD happened. Please call 911 !");
    show_success("<b>Wow ! Great !</b> Everything worked as expected !");
    messagesBar.show_notification("<b>Hello there !</b> Nice to see you here :)");
    */
    edtrTree.open_editor();
});
