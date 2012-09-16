//
// Generic file modal logic (new, rename, delete)
//

var _filename_with_correct_ext;
var modal_check_filename_input = function(){
    $(".modal-submit-button").attr('disabled', 'disabled');
    $(".modal-filename-input-error").text("");

    //console.log($('.modal-filename-input')[0]);

    // If input field does not exist, always return true
    // Otherwise check it for validity
    if ($('.modal-filename-input')[0]) {
        var filename = $('.modal-filename-input').val();

        // Empty filename is not allowed
        if (filename == "")
            return false;

        // Check for invalid characters in filename
        if (!check_valid_filename(filename)) {
            $(".modal-filename-input-error").text("Invalid characters in filename");
            return false;
        }

        // If add-on exists, we have default extension, but
        // if user specified his own extension, hide default
        _filename_with_correct_ext = filename;
        if ($('.modal-filename-input-add-on')[0]) {
            ext = get_filename_ext(filename);
            if (ext != null) {
                $(".modal-filename-input-add-on").hide();
                if (ext == "") {
                    return false;
                }
            } else {
                _filename_with_correct_ext +=
                    $('.modal-filename-input-add-on').text();
                $(".modal-filename-input-add-on").show();
                //will return true;
            }
        } // if input add-on exist
    } // if input exist

    //console.log("'"+_filename_with_correct_ext+"'");

    $(".modal-submit-button").removeAttr('disabled');
    return true;
};

// Callbacks, which are called by get_server_result()
var modal_result_success = function(message) {
    update_db_tree(false);
    show_notification(message);
};
var modal_result_error = function(message) {
    show_error(message);
};

//
// Show File or Directory action dialog (new, rename, delete)
// They are all VERY similar, so we handle them with one function
// (sticking with DRY :)
// Also, django is processing all file/dir operations via do_dropbox/ (POST)
//
var show_file_modal = function() {
    // Load modal HTML into placeholder
    $("#modal_placeholder").load(
        "/assets/html/home_modals.html?reload="+(new Date()).getTime()+
            " #modal_"+$.cookie('mdb_modal_action'),
        function(response, status, xhr) {
            if (status == "error") {
                show_error(response);
                return false
            }
            // Setup date radio buttons
            var d = new Date();
            var date = d.getFullYear()+"_"+
                ("0" + (d.getMonth() + 1)).slice(-2)+"_"+
                ("0" + d.getDate()).slice(-2)+"_";
            $('.modal-date').text(date);
            var datetime = date +"_"+
                ("0" + d.getHours()).slice(-2)+"_"+
                ("0" + d.getMinutes()).slice(-2)+"_";
            $('.modal-datetime').text(datetime);
            var date_short = d.getFullYear().toString().slice(2)+
                ("0" + (d.getMonth() + 1)).slice(-2)+
                ("0" + d.getDate()).slice(-2);
            $('.modal-date-short').text(date_short+"_");
            var datetime_short = date_short+
                ("0" + d.getHours()).slice(-2)+
                ("0" + d.getMinutes()).slice(-2)+"_";
            $('.modal-datetime-short').text(datetime_short);
            var year = d.getFullYear()+"_";
            $('.modal-year').text(year);
            var yearmonth = year+
                ("0" + (d.getMonth() + 1)).slice(-2)+"_";
            $('.modal-yearmonth').text(yearmonth);

            // Set dialog file field (<code> element)
            $('.modal-file-code').text($.cookie('mdb_modal_file_code'));

            // Activate and select input field
            $('.modal').on("shown", function() {
                $(".modal-filename-input").val($.cookie('mdb_modal_default_filename')).focus().select();
                modal_check_filename_input();
            });

            // Smart presets
            $('.modal').contents().find('.radio').css('cursor', 'pointer');
            $('.modal-radio').click(function() {
                var name = $(this).parent().children("code").text();
                $(".modal-filename-input").val(name).focus();
                modal_check_filename_input();
            });

            // Smart filename checking
            $('.modal-filename-input').keyup(function() {
                modal_check_filename_input();
            });

            // Form submission
            $('.modal-submit-button').click(function() {
                if (modal_check_filename_input()){
                    $('.modal').modal('hide');
                    $.post('/async/do_dropbox/', {
                        action: $.cookie('mdb_modal_action'),
                        db_dir_path: $.cookie('mdb_current_dir_dbpath'),
                        db_path: $.cookie('mdb_current_dbpath'),
                        filename: _filename_with_correct_ext
                    }, function(data) {
                        if (data['status'] != 'success') {
                            show_error(data['message']);
                        } else {
                            // Wait for result from server
                            get_server_result(data['task_id'], modal_result_success, modal_result_error);
                        }
                    }).error(function(data) {
                            show_error("Can't communicate with server ! Please refresh the page.");
                        });
                }
            }); // modal-submit-button.click()

            // Show modal
            $('.modal').modal({backdrop: false});
    });
};

//
// Confirmation dialog with one or more buttons
// id of clicked button is passed to the callback function
// a button should have .modal-submit-button class to receive callback
//
var show_confirm_modal = function(callback) {
    // Load modal HTML into placeholder
    $("#modal_placeholder").load(
        "/assets/html/home_modals.html?reload="+(new Date()).getTime()+
            " #modal_"+$.cookie('mdb_modal_action'),
        function(response, status, xhr) {
            if (status == "error") {
                show_error(response);
                return false
            }
            // Form submission
            $('.modal-submit-button').click(function() {
                $('.modal').modal('hide');
                callback($(this).attr("id"));
            }); // modal-submit-button.click()

            // Show modal
            $('.modal').modal({backdrop: true});
        });
};
