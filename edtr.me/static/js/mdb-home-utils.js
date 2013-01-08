//
// Messages Bar
//
var messagesBar = {
    fadein_time:    800,
    fadeout_time:   600,
    dom_elem:       $('#messages_bar'),

    init:    function( dom_elem ) {
        this.dom_elem = dom_elem;
    },

    // Shows error on red background
    show_error:         function(html_message) {
        this.show_message(html_message, 'alert-error', 0);
    },
    // Same as above but for internal errors (not the ones sent from server)
    show_internal_error:    function(context, message) {
        this.show_message("<b>"+context+": </b>"+message, 'alert-error', 0);
    },
    // Shows info on blue background
    show_info:          function(html_message) {
        this.show_message(html_message, 'alert-info', 0);
    },
    // Shows info on green background
    show_success:       function(html_message) {
        this.show_message(html_message, 'alert-success', 0);
    },
    // Shows warning on yellow background
    show_warning:       function(html_message) {
        this.show_message(html_message, '', 0);
    },
    // Shows notification on blue background, which will disappear after timeout
    show_notification:  function(html_message) {
        this.show_message(html_message, 'alert-info', this.fadein_time+html_message.length*80);
    },

    // Universal method
    // If timeout is 0 - user must manually close the message
    // If timeout > 0 - message will disappear automagically after timeout ms
    show_message:       function(html_message, alert_class, timeout) {
        // If dom element not set, use hardcoded value
        //if (!this.dom_elem) this.dom_elem = $('#messages_bar');

        // Create message in dom
        this.dom_elem.append(
            '<div class="message-container alert '+alert_class+' fade in">'
                +'<a class="close" href="#">×</a>'
                +'<p class="message-container-text">'
                    +html_message
                +'</p>'
            +'</div>');
        // Show it in container
        var container = this.dom_elem.children('.message-container').last();
        container.fadeIn(this.fadein_time, 'linear', function() {
            if (timeout > 0) {
                setTimeout(function() {
                    container.fadeOut(this.fadeout_time, 'linear', function() {
                        container.remove();
                    });
                }, timeout);
            }
        });
        container.children('.close').on('click', (function(){
            container.remove();
        }));
    }
}

//
// Sync icon
//
var syncIcon = {
    is_sync_rotating:   false,
    icon:               $('.rotate-on-click'),
    animating_img:      "/static/images/refresh-anim.gif",
    static_img:         "/static/images/refresh-static.gif",

    init:                   function( dom_elem ) {
        this.icon = dom_elem;
    },

    // Start icon rotation
    start_sync_rotation:    function() {
        if (!this.is_sync_rotating) {
            this.is_sync_rotating = true;
            this.icon.attr("src", this.animating_img)
                .css({'cursor':'auto', 'border': 'none'});
            /* Just in case of some error - stop rotation after 10 secs
             setTimeout(function() {
             stop_sync_rotation();
             }, 10000);
             */
        }
    },
    // Stop icon rotation
    stop_sync_rotation:     function() {
        this.is_sync_rotating = false;
        this.icon.css('cursor', 'pointer')
            .attr("src", this.static_img);
    }
}

//
// Get server result and call appropriate callbacks
// Server stores all task_ids for user and will check their status for us
//
var serverComm = {
    timer_interval:     1000,

    get_server_result:      function( task_id, callback_ok, callback_error ) {
        // // Check for special task_ids, those can be emitted by blocking calls
        // // on the server, which don't need to be polled for result
        // if ( task_id.startsWith('TASK COMPLETED') ) {
        //     // Task completed ! Hooray !
        //     callback_ok(task_id);
        //     return;
        // } else if ( task_id.startsWith('TASK FAILED') ) {
        //     // Task completed ! Hooray !
        //     callback_error(task_id);
        //     return;
        // }
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
                } else  if (data['result'] == 'PENDING') {
                    // Task not completed yet, restart timer
                    if (data['messages'].length)
                        messagesBar.show_notification(data['messages'][0]);
                    setTimeout(function() {
                        this.get_server_result(task_id, callback_ok, callback_error);
                    }, this.timer_interval);
                } else { // Unrecognized result ?!
                    messagesBar.show_internal_error("serverComm.get_server_result", 
                        "Unrecognized result: "+data['result']);
                }
            }
        })
    }
}
