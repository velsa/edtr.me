$(document).ready(function() {
    // Set nav bar selection
    // $('.navbar_li').removeClass('active');
    // $('#navbar_home').addClass('active');

    // Tree context menu
    $(".tree-context-menu").html($(".menu-file").find(".dropdown-menu").clone());
    $(".tree-context-menu").find(".dropdown-menu").append(
        "<li class='divider'></li>" +
        $(".menu-edit").find(".dropdown-menu").html() +
        "<li class='divider'></li>" +
        $(".menu-web").find(".dropdown-menu").html()
    );

    //
    // Sidebar Actions (View)
    //
    // Toggle checkboxes in tree
    $(".sb-view-multiselect").on("click", function(e) {
        edtrTree.toggle_checkboxes();
        // e.stopPropagation();
        // e.preventDefault();
    });
    // Clear all checkboxes in tree
    $(".sb-view-clear-checkboxes").on("click", edtrTree.clear_checkboxes);
    // Clear clipboard
    $(".sb-view-clear-clipboard").on("click", edtrTree.clear_clipboard);
    // Show clipboard contents
    $(".sb-view-show-clipboard").on("click", function() {
        edtrTree.show_clipboard($(this).data("action"));
    });

    //
    // Sidebar Actions (File)
    //
    // Add/Copy/Cut/Paste/Rename/Remove/Refresh file/subdir, Show info for file/subdir
    $(".sb-add, .sb-edit, .sb-file, .sb-clipboard").on("click", function() {
        edtrTree.node_action($(this).data("action"));
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

    // Prepare server communications (TODO: init sockets here)
    serverComm.init();

    // Show tree on page load
    // We pass tree and editor containers
    edtrTree.init({
        dom_tree:       $('#db_tree'),
        dom_editor:     $(".main-view-right"),
        dom_rc_menu:    $(".tree-context-menu")
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
