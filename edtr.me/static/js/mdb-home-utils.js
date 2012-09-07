
var fadein_time = 800;
var fadeout_time = 600;
//
// Messages Bar
//
// Shows error on red background
var show_error = function(html_message) {
    show_message(html_message, 'alert-error', 0)
};
// Shows info on blue background
var show_info = function(html_message) {
    show_message(html_message, 'alert-info', 0)
};
// Shows info on green background
var show_success = function(html_message) {
    show_message(html_message, 'alert-success', 0)
};
// Shows warning on yellow background
var show_warning = function(html_message) {
    show_message(html_message, '', 0)
};
// Shows notification on blue background, which will disappear after timeout
var show_notification = function(html_message) {
    show_message(html_message, 'alert-info', fadein_time+html_message.length*80)
};

// Universal method
// If timeout is 0 - user must manually close the message
// If timeout > 0 - message will disappear automagically after timeout ms
var show_message = function(html_message, alert_class, timeout) {
    var messages_bar = $('#messages_bar');
    messages_bar.append(
        '<div class="message-container alert '+alert_class+' fade in">'
            +'<a class="close" href="#">×</a>'
            +'<p class="message-container-text">'
                +html_message
            +'</p>'
        +'</div>');
    var elem = messages_bar.children('.message-container').last();
    elem.fadeIn(fadein_time, 'linear', function() {
        if (timeout > 0) {
            setTimeout(function() {
                elem.fadeOut(fadeout_time, 'linear', function() {
                    elem.remove();
                });
            }, timeout);
        }
    });
    elem.children('.close').click(function(){
        elem.remove();
    });
};


//
// Sync icon
//
var is_sync_rotating = false;
var start_sync_rotation = function() {
    if (!is_sync_rotating) {
        is_sync_rotating = true;
        // Start icon rotation
        $('.rotate-on-click')
            .attr("src", "/assets/images/refresh-anim.gif")
            .css({'cursor':'auto', 'border': 'none'});
        /* Just in case of some error - stop rotation after 10 secs
         setTimeout(function() {
         stop_sync_rotation();
         }, 10000);
         */
    }
};
var stop_sync_rotation = function() {
    // Stop icon rotation
    is_sync_rotating = false;
    $('.rotate-on-click')
        .css('cursor', 'pointer')
        .attr("src", "/assets/images/refresh-static.gif");
};


//
// Get server result (from celery tasks) and call appropriate callbacks
// Server stores all task_ids for user and will check their status for us
//
var get_server_result = function(task_id, callback_ok, callback_error) {
    // Check for special task_ids, those can be emitted by blocking calls
    // on the server, which don't need to be polled for result
    if ( task_id.startsWith('TASK COMPLETED') ) {
        // Task completed ! Hooray !
        callback_ok(task_id);
        return;
    } else if ( task_id.startsWith('TASK FAILED') ) {
        // Task completed ! Hooray !
        callback_error(task_id);
        return;
    }
    // Poll server for result from async operation
    $.post("/get_result/", {
        task_id: task_id
    }, function(data) {
        if (data['status'] != 'success') {
            // Serious error
            callback_error(data['messages'][0]);
        } else {
            if (data['result'] == 'FAILURE') {
                // Task failed, oh-oh
                for (var i=0; i < data['messages'].length; i++)
                    callback_error(data['messages'][i]);
            } else if (data['result'] == 'SUCCESS') {
                // Task completed ! Hooray !
                callback_ok(data['messages'][0]);
            } else { // we assume PENDING
                // Task not completed yet, restart timer
                show_notification(data['messages'][0]);
                setTimeout(function() {
                    get_server_result(task_id, callback_ok, callback_error);
                }, 2000);
            }
        }
    })
};
