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
        show_file_modal();
    });
    // Add New SubDir
    $("#action_add_subdir").click(function() {
        $.cookie('mdb_modal_action', "add_subdir");
        $.cookie('mdb_modal_file_code', $.cookie('mdb_current_dir_dbpath'));
        $.cookie('mdb_modal_default_filename', "");
        show_file_modal();
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
            show_file_modal();
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
            show_file_modal();
        }
    });

    //
    // Refresh icon
    //
    $('.rotate-on-click').hover(function () {
        //$(this).removeClass("icon-black");
        //$(this).addClass("icon-white");
        if (!is_sync_rotating) {
            $(this).css('border','1px solid darkgrey');
        }
    }, function () {
            //$(this).removeClass("icon-white");
            //$(this).addClass("icon-black");
            $(this).css('border','none');
        });
    $('.rotate-on-click').click(function () {
        if (!is_sync_rotating) {
            // Ask django to refresh dropbox data
            update_db_tree(false);
        }
    });

    // Show tree on page load
    update_db_tree(true);

    /*
    show_info("<b>Goodbye.</b> Come back again...");
    show_warning("<b>Ah oh</b> Something is wrong. But we will fix it...");
    show_error("<b>Oh Damn !</b> Something really BAD happened. Please call 911 !");
     show_notification("<b>Hello there !</b> Nice to see you here :)");
     show_success("<b>Wow ! Great !</b> Everything worked as expected !");
    */
});