$(document).ready(function() {
    // Set nav bar selection
    // $('.navbar_li').removeClass('active');
    // $('#navbar_home').addClass('active');

    //
    // Sidebar Actions (View)
    //
    // Toggle checkboxes in tree
    $("#sb_view_multiselect").on("click", function(e) {
        // e.stopPropagation();
        edtrTree.toggle_checkboxes(true);
    });
    // Clear all checkboxes in tree
    $("#sb_view_clear_checkboxes").on("click", edtrTree.clear_checkboxes);
    // Clear clipboard
    $("#sb_view_clear_clipboard").on("click", edtrTree.clear_clipboard);
    // Show clipboard contents
    $("#sb_view_show_clipboard").on("click", function() {
        edtrTree.show_clipboard($(this).data("action"));
    });

    //
    // Sidebar Actions (Edit)
    //
    // Add New file/subdir
    $(".sb_add").on("click", function() {
        edtrTree.add_node_via_modal($(this).data("action"));
    });
    // Rename/Remove file/subdir
    $(".sb_edit, .sb_clipboard").on("click", function() {
        edtrTree.node_action($(this).data("action"));
    });


    // Update shortcut modifiers in all menus
    var modifier = "Ctrl-";
    if (navigator.platform.startsWith("Mac"))
        modifier = "&#8984;";
    $(".shortcut").each(function() {
        $(this).html($(this).text().format(modifier));
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

    // Set keyboard focus to the tree
    // HACK: if we run it without timeout, focus is set to iframe (preview)
    window.setTimeout(function() {
        edtrTree.dom_db_tree.focus();
    }, 300);
});
