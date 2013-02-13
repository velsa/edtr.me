//
// Generic file modal logic (new, rename, delete)
//
var modalDialog = {

    init:                           function(dom_elem) {
        modalDialog.dom_container = dom_elem;
    },

    check_filename_input:           function() {
        // If input field exist: check it for validity
        if (modalDialog.dom_input[0]) {
            modalDialog.dom_submit.attr('disabled', 'disabled');
            modalDialog.dom_input_err.text("");

            var filename = modalDialog.dom_input.val();

            // Empty and unchanged filename is not allowed
            if (filename === "" || filename === modalDialog.params.filename)
                return false;

            // Check for invalid characters in filename
            if (!edtrHelper.check_valid_filename(filename)) {
                modalDialog.dom_input_err.text("Invalid characters in filename");
                return false;
            }

            // If add-on exists, we have default extension, but
            // if user specified his own extension, hide default
            modalDialog.filename_with_correct_ext = filename;
            if (modalDialog.dom_input_addon[0]) {
                ext = edtrHelper.get_filename_ext(filename);
                if (ext !== null) {
                    modalDialog.dom_input_addon.hide();
                    if (ext === "")
                        return false;
                } else {
                    modalDialog.filename_with_correct_ext += modalDialog.dom_input_addon.text();
                    modalDialog.dom_input_addon.show();
                    // continue checking
                }
            } // if input add-on exist

            // Check if filename is in no_names
            if($.inArray(modalDialog.filename_with_correct_ext, modalDialog.params.no_names) > -1) {
                modalDialog.dom_input_err.text("Filename already exists");
                return false;
            }

            modalDialog.dom_submit.removeAttr('disabled');
        } else {
            // Input does not exist: correct filename is the one we received
            modalDialog.filename_with_correct_ext = modalDialog.params.filename;
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
        // ESCAPE closes modal
        dom_elem.on("keyup", function(event) {
            var key = event.which; // recommended to use e.which, it's normalized across browsers
            if (key == 27) { //key == 13 ||
                modalDialog.callback_arg.key = key;
                modalDialog.modal_close();
            }
        });

        modalDialog.dom_modal.on("hidden", function() {
            // Unbind all events
            modalDialog.dom_modal.off("hidden");
            modalDialog.dom_modal.find('.modal-submit-button').off("click");
            dom_elem.off("keyup");
            if (modalDialog.params.callback)
                modalDialog.params.callback.call($(this), modalDialog.callback_arg);
        });
    },
    // Hide modal
    modal_close:                    function() {
        modalDialog.dom_modal.modal("hide");
    },

    //
    // Called when user presses ENTER in input field or clicks on submit button
    // For file dialogs ONLY !
    //
    on_file_modal_submit:           function(event) {
        // For 'remove' dialogs will always return true
        if (modalDialog.check_filename_input()) {
            modalDialog.close_file_modal();
            // Call edtrTree to perform requested action
            edtrTree.file_action(
                // All params that we received stay the same
                modalDialog.params.action,
                // Fix for root ('/') to avoid adding double '/'
                modalDialog.params.path === '/' ? modalDialog.params.path : modalDialog.params.path+'/',
                modalDialog.params.filename,
                // This is sanitized user input
                modalDialog.filename_with_correct_ext
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
    // modalDialog.params should contain correct values !
    //
    // modalDialog.params: {
    //      action              - Action to be performed, should correspond to modal_ name
    //      header              - What should be displayed in dialog header
    //      path                - Full path of dir where file/dir is located
    //      filename            - File/dir name itself, without full path
    // }
    show_file_modal:                function() {
        var action = modalDialog.params.action;
        modalDialog.modal_prepare($("#modal_"+action));

        // Store dom elements for callbacks
        modalDialog.dom_input       = modalDialog.dom_modal.find('.modal-filename-input');
        modalDialog.dom_submit      = modalDialog.dom_modal.find(".modal-submit-button"),
        modalDialog.dom_input_err   = modalDialog.dom_modal.find(".modal-filename-input-error"),
        modalDialog.dom_input_addon = modalDialog.dom_modal.find(".modal-filename-input-add-on");

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
                modalDialog.dom_input.val(modalDialog.params.filename).focus().select();
                modalDialog.check_filename_input();
            })
            .on("hidden", function() {
                // Unbind all events
                modalDialog.dom_modal.find('.modal-radio').off();
                modalDialog.dom_input.off();
                modalDialog.dom_submit.off();
            });

            // Smart presets
            modalDialog.dom_modal.find('.radio').css('cursor', 'pointer');
            modalDialog.dom_modal.find('.modal-radio').prop('checked', false).on("click", function() {
                var name = $(this).parent().children("code").text();
                modalDialog.dom_input.val(name).focus();
                modalDialog.check_filename_input();
            });

            // Smart filename checking
            modalDialog.dom_input.on("keyup", function(event) {
                var key = event.which; // recommended to use e.which, it's normalized across browsers
                // Submission via ENTER
                if (key == 13)
                    modalDialog.on_file_modal_submit();
                else
                    modalDialog.check_filename_input();
            });
        }

        // Set dialog file field (<pre> element)
        modalDialog.dom_modal.find('.modal-file-code').text(modalDialog.params.header);

        // Submission via button
        modalDialog.dom_submit.on("click", modalDialog.on_file_modal_submit);

        // Show modal
        modalDialog.dom_modal.modal({backdrop: true});
    },

    show_info_modal:                function() {
        // Create correct modal dialog
        modalDialog.modal_prepare($("#modal_"+modalDialog.params.action));

        // Set dialog code field (<pre> element)
        modalDialog.dom_modal.find('.modal-text-code').text(modalDialog.params.text);

        // Form submission
        modalDialog.dom_modal.find(".modal-submit-button").on("click", function() {
            modalDialog.modal_close();
        }).focus(); // modal-submit-button.click()

        // Show modal
        modalDialog.dom_modal.modal({backdrop: true});
    },

    //
    // Confirmation dialog with one or more buttons
    // callback function receives modalDialog.callback_arg
    // and can check for 'button' parameter
    //
    show_confirm_modal:             function(callback) {
        // Load modal HTML into placeholder
        modalDialog.modal_prepare($("#modal_"+modalDialog.params.action));

        // Set dialog code fields (<pre> elements)
        modalDialog.dom_modal.find('.modal-text1-code').text(modalDialog.params.text1);
        modalDialog.dom_modal.find('.modal-text2-code').text(modalDialog.params.text2);

        // Form submission
        modalDialog.dom_modal.find(".modal-submit-button").on("click", function() {
            modalDialog.callback_arg.button = $(this).attr("id");
            modalDialog.modal_close();
        }); // modal-submit-button.click()

        // Show modal
        modalDialog.dom_modal.modal({backdrop: true});
    }
};
