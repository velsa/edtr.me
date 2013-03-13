//
// Generic file modal logic (new, rename, delete)
//
var modalDialog = {

    init:                           function(dom_elem) {
        modalDialog.dom_container = dom_elem;
        // Find all templates in dom and compile them
        $(".modal-template").each(function(){
            modalDialog[$(this).attr("id")] = _.template($(this).html());
        });
    },

    // General helpers for modals
    modal_prepare:                  function(action) {
        var html = modalDialog["modal_"+action+"_template"](modalDialog.params.template_vars);
        // Create correct modal dialog
        // modalDialog.dom_modal_clone = dom_elem.clone();
        modalDialog.dom_container.html(html);
        modalDialog.dom_modal = modalDialog.dom_container.find(".modal");
        modalDialog.callback_arg = {};

        // Check for keys to dismiss dialog
        // ESCAPE closes modal
        modalDialog.dom_modal.on("keyup", function(event) {
            // recommended to use e.which, it's normalized across browsers
            var key = event.which;
            if (key == 27) { //key == 13 ||
                modalDialog.callback_arg.key = key;
                modalDialog.modal_close();
            }
        });

        modalDialog.dom_modal.draggable({
            handle: ".modal-header"
        });

        // Expected to fire up when modal_close() has been called
        modalDialog.dom_modal.on("hidden", function() {
            // Unbind all events
            modalDialog.dom_modal.off("hidden");
            modalDialog.dom_modal.find(".modal-submit-button").off("click");
            modalDialog.dom_modal.off("keyup");
            modalDialog.dom_modal.find("input[type='text']").off("keyup");

            // HACK: datetimepicker leaves its elements in the dom
            // remove them manually
            $('body').find(".bootstrap-datetimepicker-widget").remove();

            // Call the callback function if params has one
            if (modalDialog.params.callback)
                modalDialog.params.callback.call($(this), modalDialog.callback_arg);

            // Settings dialog was hidden - process necessary knockout actions
            if (modalDialog.params.view_model) {
                // Remove knockout bindings
                modalDialog.dom_modal.find("*").each(function () {
                    $(this).unbind();
                });
                ko.cleanNode(modalDialog.dom_modal);
            }
        });
    },

    // Hide modal
    modal_close:                    function() {
        // Should lead to dom_modal.on("hidden") being called (above)
        modalDialog.dom_modal.modal("hide");
    },

    //
    // Called when user presses ENTER in input field or clicks on submit button
    // For file dialogs ONLY !
    //
    on_file_modal_submit:           function(event) {
        // For 'remove' dialogs will always return true
        if (modalDialog.check_filename_input()) {
            modalDialog.modal_close();
            // Call edtrTree to perform requested action
            edtrTree.file_action(
                // All params that we received stay the same
                modalDialog.params.action,
                // IMPORTANT: we pass the path WITHOUT '/' at the end (unless it is '/')
                modalDialog.params.path,
                modalDialog.params.filename,
                // This is sanitized user input
                modalDialog.filename_validated
            );
        }
    },

    // Check input field in file dialogs for validity
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
            modalDialog.filename_validated = filename;
            if (modalDialog.dom_input_addon[0]) {
                ext = edtrHelper.get_filename_ext(filename);
                if (ext !== null) {
                    modalDialog.dom_input_addon.hide();
                    if (ext === "")
                        return false;
                } else {
                    modalDialog.filename_validated += modalDialog.dom_input_addon.text();
                    modalDialog.dom_input_addon.show();
                    // continue checking
                }
            } // if input add-on exist

            // Check if filename is in no_names
            if($.inArray(modalDialog.filename_validated, modalDialog.params.no_names) > -1) {
                modalDialog.dom_input_err.text("Filename already exists");
                return false;
            }

            modalDialog.dom_submit.removeAttr('disabled');
        } else {
            // Input does not exist: correct filename is the one we received
            modalDialog.filename_validated = modalDialog.params.filename;
        }
        //console.log("'"+this.filename_validated+"'");

        return true;
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
        modalDialog.modal_prepare(action);

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
                modalDialog.dom_input.focus().select();
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
                // recommended to use e.which, it's normalized across browsers
                // Submission via ENTER
                if (event.which == 13)
                    modalDialog.on_file_modal_submit();
                else
                    modalDialog.check_filename_input();
            });
        }

        // Submission via button
        modalDialog.dom_submit.on("click", modalDialog.on_file_modal_submit);

        // Show modal
        modalDialog.dom_modal.modal({backdrop: true});
    },

    show_info_modal:                function() {
        // Create correct modal dialog
        modalDialog.modal_prepare(modalDialog.params.action);

        // Form submission
        modalDialog.dom_modal.find(".modal-submit-button").on("click", function() {
            modalDialog.modal_close();
        }).focus();

        // Show modal
        modalDialog.dom_modal.modal({backdrop: true});
    },

    //
    // Confirmation dialog with one or more buttons
    // callback:            called when modal is dismissed
    //                      callback function receives modalDialog.callback_arg
    //                      and can check for 'button' parameter
    //
    show_confirm_modal:             function(callback) {
        // Load modal HTML into placeholder
        modalDialog.modal_prepare(modalDialog.params.action);

        // Form submission
        modalDialog.dom_modal.find(".modal-submit-button").on("click", function() {
            modalDialog.callback_arg.button = $(this).data("modal-button");
            modalDialog.modal_close();
        }); // modal-submit-button.click()

        // Show modal
        modalDialog.dom_modal.modal({backdrop: true});
    },

    //
    // Settings dialog with knockout fields
    //
    // callback:            called when modal is dismissed
    //                      callback function receives modalDialog.callback_arg
    //                      and can check for 'button' parameter
    //
    show_settings_modal:             function(callback) {
        // Load modal HTML into placeholder
        modalDialog.modal_prepare(modalDialog.params.action);

        // Form submission
        modalDialog.dom_modal.find(".modal-submit-button").on("click", function() {
            if (!modalDialog.view_model_validated.isValid())
                return;
            modalDialog.callback_arg.button = $(this).data("modal-button");
            modalDialog.modal_close();
        }); // modal-submit-button.click()

        // Process submit on Enter in input fields
        modalDialog.dom_modal.find("input[type='text']").on("keyup", function() {
            // recommended to use e.which, it's normalized across browsers
            var key = event.which;
            if (key === 13 && modalDialog.view_model_validated.isValid()) {
                modalDialog.callback_arg.button = "ok";
                modalDialog.modal_close();
            }
        });

        // If dialog has datetime picker - initiate it
        modalDialog.dom_modal.find('.datetime-picker').datetimepicker({
            language: 'en',
            pick12HourFormat: true
        });

        modalDialog.view_model_validated = ko.validatedObservable(edtrSettings[modalDialog.params.view_model]);

        // Initialize knockout
        ko.applyBindingsWithValidation(modalDialog.view_model_validated,
            modalDialog.dom_modal.get(0),
            {
                insertMessages:         true,
                messagesOnModified:     false,
                errorMessageClass:      "text-error",
                parseInputAttributes:   true,
                decorateElement:        true,
                errorElementClass:      "edtr-input-error"
            });

        // Subscribe to validation checks
        var dom_modal_ok_button = modalDialog.dom_modal.find(".modal-submit-button[data-modal-button=ok]");
        modalDialog.view_model_validated.isValid.subscribe(function(valid) {
            if (valid)
                dom_modal_ok_button.removeAttr('disabled');
            else
                dom_modal_ok_button.attr('disabled', 'disabled');

        });

        // Show modal
        modalDialog.dom_modal.modal({backdrop: true});
        // Make backdrop see-through so that user will be able to see the effect
        // of settings on editor, preview, etc..
        $("body").find(".modal-backdrop").css("opacity", "0");

        // Set focus on first input element
        modalDialog.dom_modal.find("input").eq(0).focus().select();
    }
};
