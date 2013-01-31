//
// Generic file modal logic (new, rename, delete)
//
var modalDialog = {

    init:                           function(dom_elem) {
        modalDialog.dom_container = dom_elem;
    },

    check_filename_input:           function() {
        //console.log($('.modal-filename-input')[0]);
        var dom_input   = modalDialog.dom_modal.find('.modal-filename-input');

        // If input field exist: check it for validity
        if (dom_input[0]) {
            var dom_submit      = modalDialog.dom_modal.find(".modal-submit-button"),
                dom_input_err   = modalDialog.dom_modal.find(".modal-filename-input-error"),
                dom_input_addon = modalDialog.dom_modal.find(".modal-filename-input-add-on");

            dom_submit.attr('disabled', 'disabled');
            dom_input_err.text("");

            var filename = dom_input.val();

            // Empty and unchanged filename is not allowed
            if (filename === "" || filename === edtrTree.modal_params.filename)
                return false;

            // Check for invalid characters in filename
            if (!edtrHelper.check_valid_filename(filename)) {
                dom_input_err.text("Invalid characters in filename");
                return false;
            }

            // If add-on exists, we have default extension, but
            // if user specified his own extension, hide default
            modalDialog.filename_with_correct_ext = filename;
            if (dom_input_addon[0]) {
                ext = edtrHelper.get_filename_ext(filename);
                if (ext !== null) {
                    dom_input_addon.hide();
                    if (ext === "") return false;
                } else {
                    modalDialog.filename_with_correct_ext += dom_input_addon.text();
                    dom_input_addon.show();
                    //will return true;
                }
            } // if input add-on exist

            dom_submit.removeAttr('disabled');
        } else {
            // Input does not exist: correct filename is the one we received
            modalDialog.filename_with_correct_ext = edtrTree.modal_params.filename;
        }
        //console.log("'"+this.filename_with_correct_ext+"'");

        return true;
    },

    // General helpers for modals
    modal_prepare:                  function(dom_elem) {
        // Create correct modal dialog
        modalDialog.dom_container.html(dom_elem.clone());
        modalDialog.dom_modal = modalDialog.dom_container.find(".modal");
        modalDialog.callback_arg = {};

        // Check for keys to dismiss dialog
        // Submission via ENTER and ESCAPE
        $('body').on("keyup", function(event) {
            var key = event.which; // recommended to use e.which, it's normalized across browsers
            if (key == 13 || key == 27) {
                modalDialog.callback_arg.key = key;
                modalDialog.modal_close();
            }
        });

        modalDialog.dom_modal.on("hidden", function() {
            // Unbind all events
            modalDialog.dom_modal.off("hidden");
            modalDialog.dom_modal.find('.modal-submit-button').off("click");
            $('body').off("keyup");
            if (modalDialog.callback)
                modalDialog.callback(modalDialog.callback_arg);
        });

        // Form submission
        modalDialog.dom_modal.find(".modal-submit-button").on("click", function() {
            modalDialog.callback_arg.button = $(this).attr("id");
            modalDialog.modal_close();
        }); // modal-submit-button.click()
    },
    // Hide modal
    modal_close:                    function() {
        modalDialog.dom_modal.modal("hide");
    },

    //
    // Called when user presses ENTER in input field or clicks on submit button
    // For file dialogs ONLY !
    //
    on_file_modal_submit:           function() {
        // For 'remove' dialogs will always return true
        if (modalDialog.check_filename_input()) {
            modalDialog.close_file_modal();
            // Call edtrTree to perform requested action
            edtrTree.file_action(
                // All params that we received stay the same
                edtrTree.modal_params.action,
                edtrTree.modal_params.path,
                edtrTree.modal_params.filename,
                // This is sanitized user input
                modalDialog.filename_with_correct_ext,
                // Ask server to perform this action as well
                true
            );
        }
    },

    // Hide modal and remove event handlers
    close_file_modal:               function() {
        modalDialog.dom_modal.modal('hide');
    },
    
    //
    // Show File or Directory action dialog (new, rename, delete)
    // They are all VERY similar, so we handle them with one function
    // (sticking with DRY :)
    // Also, server is processing all file/dir operations via the same ajax
    //
    // Can be called via callback (e.g. from edtrTree.on_node_expand)
    // edtrTree.modal_params should contain correct values !
    //
    // edtrTree.modal_params: {
    //      action              - Action to be performed, should correspond to modal_ name
    //      header              - What should be displayed in dialog header
    //      path                - Full path of dir where file/dir is located
    //      filename            - File/dir name itself, without full path
    // }
    show_file_modal:                function() {
        var action = edtrTree.modal_params.action;
        modalDialog.modal_prepare($("#modal_"+action));

        // Filename helpers are not available in 'remove' dialogs
        if (action !== "remove_file" && action !== "remove_subdir") {
            // Setup date radio buttons
            var d = new Date();
            var date = d.getFullYear()+"_"+
                ("0" + (d.getMonth() + 1)).slice(-2)+"_"+
                ("0" + d.getDate()).slice(-2)+"_";
            modalDialog.dom_modal.find('.modal-date').text(date);
            var datetime = date +"_"+
                ("0" + d.getHours()).slice(-2)+"_"+
                ("0" + d.getMinutes()).slice(-2)+"_";
            modalDialog.dom_modal.find('.modal-datetime').text(datetime);
            var date_short = d.getFullYear().toString().slice(2)+
                ("0" + (d.getMonth() + 1)).slice(-2)+
                ("0" + d.getDate()).slice(-2);
            modalDialog.dom_modal.find('.modal-date-short').text(date_short+"_");
            var datetime_short = date_short+
                ("0" + d.getHours()).slice(-2)+
                ("0" + d.getMinutes()).slice(-2)+"_";
            modalDialog.dom_modal.find('.modal-datetime-short').text(datetime_short);
            var year = d.getFullYear()+"_";
            modalDialog.dom_modal.find('.modal-year').text(year);
            var yearmonth = year+
                ("0" + (d.getMonth() + 1)).slice(-2)+"_";
            modalDialog.dom_modal.find('.modal-yearmonth').text(yearmonth);

            modalDialog.dom_modal
            .on("shown", function() {
                // Activate and select input field
                // Place provided filename as default value
                modalDialog.dom_modal.find(".modal-filename-input")
                    .val(edtrTree.modal_params.filename).focus().select();
                modalDialog.check_filename_input();
            })
            .on("hidden", function() {
                // Unbind all events
                modalDialog.dom_modal.find('.modal-radio').off();
                modalDialog.dom_modal.find('.modal-filename-input').off();
                modalDialog.dom_modal.find('.modal-submit-button').off();
            });

            // Smart presets
            modalDialog.dom_modal.find('.radio').css('cursor', 'pointer');
            modalDialog.dom_modal.find('.modal-radio').prop('checked', false).on("click", function() {
                var name = $(this).parent().children("code").text();
                modalDialog.dom_modal.find(".modal-filename-input").val(name).focus();
                modalDialog.check_filename_input();
            });

            // Smart filename checking
            modalDialog.dom_modal.find('.modal-filename-input').on("keyup", function(event) {
                var key = event.which; // recommended to use e.which, it's normalized across browsers
                // Submission via ENTER
                if (key == 13)
                    modalDialog.on_file_modal_submit();
                else
                    modalDialog.check_filename_input();
            });
        }

        // Set dialog file field (<pre> element)
        modalDialog.dom_modal.find('.modal-file-code').text(edtrTree.modal_params.header);

        // Submission via button
        modalDialog.dom_modal.find('.modal-submit-button').on("click", modalDialog.on_file_modal_submit);

        // Show modal
        modalDialog.dom_modal.modal({backdrop: true});
    },

    show_info_modal:                function(action, text, callback) {
        // Create correct modal dialog
        modalDialog.modal_prepare($("#modal_"+action));
        modalDialog.callback = callback;

        // Set dialog code field (<pre> element)
        modalDialog.dom_modal.find('.modal-text-code').text(text);

        // Show modal
        modalDialog.dom_modal.modal({backdrop: true});

        // Grab keyboard focus
        modalDialog.dom_modal.focus();
    },

    //
    // Confirmation dialog with one or more buttons
    // callback function receives true if ENTER or submit-button was clicked, false otherwise
    //
    show_confirm_modal:             function(action, callback) {
        // Load modal HTML into placeholder
        modalDialog.modal_prepare($("#modal_"+action));
        modalDialog.callback = callback;

        // Show modal
        modalDialog.dom_modal.modal({backdrop: true, keyboard: true});

        // Grab keyboard focus
        modalDialog.dom_modal.focus();
    }

    // Callbacks, which are called by get_server_result()
    // modal_result_success:           function(message) {
    //     edtrTree.update_db_tree(false);
    //     messagesBar.show_notification(message);
    // },
    // modal_result_error:             function(message) {
    //     messagesBar.show_error(message);
    // },

};
