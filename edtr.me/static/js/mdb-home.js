$(document).ready(function() {
    // Set nav bar selection
    $('.navbar_li').removeClass('active');
    $('#navbar_home').addClass('active');

    //
    // ACTIONS MENU
    //
    // Add New file
    $("#action_add_file").click(function() {
        $.cookie('mdb_modal_action', "add_file");
        $.cookie('mdb_modal_file_code', $.cookie('mdb_current_dir_dbpath'));
        $.cookie('mdb_modal_default_filename', "index.md");
        modalDialog.show_file_modal();
    });
    // Add New SubDir
    $("#action_add_subdir").click(function() {
        $.cookie('mdb_modal_action', "add_subdir");
        $.cookie('mdb_modal_file_code', $.cookie('mdb_current_dir_dbpath'));
        $.cookie('mdb_modal_default_filename', "");
        modalDialog.show_file_modal();
    });
    // Rename file/subdir
    $("#action_rename").click(function() {
        if ($.cookie('mdb_is_treeview_selected') == "true") {
            if ($.cookie('mdb_current_is_folder') == "true") {
                // Rename directory dialog
                $.cookie('mdb_modal_action', "rename_subdir");
            } else {
                // Rename file dialog
                $.cookie('mdb_modal_action', "rename_file");
            }
            var path_parts = $.cookie('mdb_current_dbpath').split("/");
            var basename = path_parts[path_parts.length-1];
            $.cookie('mdb_modal_file_code', basename);
            $.cookie('mdb_modal_default_filename', "");
            modalDialog.show_file_modal();
        }
    });
    // Delete file/subdir
    $("#action_delete").click(function() {
        if ($.cookie('mdb_is_treeview_selected') == "true") {
            if ($.cookie('mdb_current_is_folder') == "true") {
                // Remove directory dialog
                $.cookie('mdb_modal_action', "remove_subdir");
            } else {
                // Remove file dialog
                $.cookie('mdb_modal_action', "remove_file");
            }
            $.cookie('mdb_modal_file_code', $.cookie('mdb_current_dbpath'));
            modalDialog.show_file_modal();
        }
    });


    //
    // Refresh icon
    //
    syncIcon.init($('.rotate-on-click'), function() {
        // Called when icon is clicked
        // Ask server to refresh dropbox data
        edtrTree.update_db_tree(false);
    });

    // Vertical and horizontal splitter hooks
    edtrSplitters.init(function() {
        // Called when drag has finished
        // TODO: do the same on browser window resize
        messagesBar.update_dimensions($('#editor_area'));
    });

    messagesBar.init($('#messages_bar'));
    messagesBar.update_dimensions($('#editor_area'));

    // Show tree on page load
    edtrTree.init();
    edtrTree.update_db_tree(true);

    /*
    show_info("<b>Goodbye.</b> Come back again...");
    show_warning("<b>Ah oh</b> Something is wrong. But we will fix it...");
    show_error("<b>Oh Damn !</b> Something really BAD happened. Please call 911 !");
     show_notification("<b>Hello there !</b> Nice to see you here :)");
     show_success("<b>Wow ! Great !</b> Everything worked as expected !");
    */
   edtrTree.open_editor();
});
