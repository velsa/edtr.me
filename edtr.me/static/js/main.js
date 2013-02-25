$(document).ready(function() {
    // Prepare server communications (inits cookies and opens socket to server)
    serverComm.init();

    // Holds various settings for user, editor, files, etc..
    // TODO: get settings from server and process rest of the main code in
    // callback
    edtrSettings.init($(".main-view-container").get(0));
    
    // Build tree context menu
    $(".tree-context-menu").html($(".menu-file").find(".dropdown-menu").clone());
    $(".tree-context-menu").find(".dropdown-menu").append(
        "<li class='divider'></li>" +
        $(".menu-edit").find(".dropdown-menu").html() +
        "<li class='divider'></li>" +
        $(".menu-web").find(".dropdown-menu").html()
    );

    //
    // Sidebar Menu (File/Edit)
    //
    // Add/Rename/Remove/Refresh/Copy/Cut/Paste node
    $(".sb-file, .sb-edit").on("click", function() {
        edtrTree.node_action($(this).data("action"));
    });

    //
    // Sidebar Menu (View)
    //
    $(".sb-view").on("click", function(e) {
        edtrTree[$(this).data("action")]();
    });

    // Setup tooltips
    $(".edtr-tooltip").tooltip({ placement: "right", html: true, delay: { show: 1000, hide: 300 } });

    // Update shortcut modifiers in all menus according to browser OS
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
        syncIcon.start_sync_rotation();
        // Ask server to refresh tree data
        edtrTree.refresh_opened_nodes(function() {
            // Called when refresh is done
            syncIcon.stop_sync_rotation();
        });
    });

    // Vertical and horizontal splitter hooks
    edtrSplitters.init(function() {
        // Called when drag has finished
        return;
    });

    // We pass container for messages and element to adjust width to
    messagesBar.init($('#messages_bar'), $('.main-view-right'));

    // Show tree on page load
    // We pass tree and editor containers
    edtrTree.init({
        dom_tree:               $('#db_tree'),
        dom_editor:             $(".main-view-right"),
        dom_rc_menu:            $(".tree-context-menu"),
        popover_dir_template:   $("#popover_dir_template"),
        popover_file_template:  $("#popover_file_template")
    });

    /*
    show_info("<b>Goodbye.</b> Come back again...");
    show_warning("<b>Ah oh</b> Something is wrong. But we will fix it...");
    show_error("<b>Oh Damn !</b> Something really BAD happened. Please call 911 !");
    show_success("<b>Wow ! Great !</b> Everything worked as expected !");
    messagesBar.show_notification("<b>Hello there !</b> Nice to see you here :)");
    */
    //edtrTree.open_editor();

    // Set keyboard focus to the tree
    // HACK: if we run it without timeout, focus is set to iframe (preview)
    window.setTimeout(function() {
        edtrTree.dom_db_tree.focus();
    }, 300);
});
