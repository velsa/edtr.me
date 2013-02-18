//
// Messages Bar
//
var messagesBar = {
    fadein_time:                    0,
    fadeout_time:                   200,
    notification_timeout:           1500,
    notification_warning_timeout:   3000,

    init:    function(dom_elem, base_elem) {
        this.dom_elem = dom_elem;
        this.base_elem = base_elem;
    },

    update_dimensions: function () {
        this.dom_elem.offset({
            'left': this.base_elem.offset().left,
            'top':  this.base_elem.offset().top-this.dom_elem.height()/2
        });
        this.dom_elem.width(this.base_elem.width());
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
    // Shows info on green background, automatically disappears
    show_success:       function(html_message) {
        this.show_message(html_message, 'alert-success', this.fadein_time);
    },
    // Shows warning on yellow background
    show_warning:       function(html_message) {
        this.show_message(html_message, '', 0);
    },
    // Shows notification on blue background, which will disappear after timeout
    show_notification:  function(html_message) {
        this.show_message(html_message, 'alert-info',
            this.notification_timeout+html_message.length*80);
    },
    // Shows notification on blue background, which will disappear after timeout*10
    show_notification_warning:  function(html_message) {
        this.show_message(html_message, '',
            this.notification_warning_timeout+html_message.length*80);
    },

    // Universal method
    // If timeout is 0 - user must manually close the message
    // If timeout > 0 - message will disappear automagically after timeout ms
    show_message:       function(html_message, alert_class, timeout) {
        // Compensate for any changes in dom structure
        this.update_dimensions();
        // Create message in dom
        this.dom_elem.append(
            '<div class="message-container alert '+alert_class+' fade in">'+
                '<a class="close" href="#">&#10006;</a>'+
                '<p class="message-container-text">'+
                    html_message+
                '</p>'+
            '</div>');
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
};

//
// Sync icon
//
var syncIcon = {
    is_sync_rotating:   false,
    icon:               null,
    animating_img:      "/static/images/refresh-anim.gif",
    static_img:         "/static/images/refresh-static.gif",

    init:                   function( dom_elem, on_click_callback ) {
        this.icon = dom_elem;
        this.icon
        .on("hover", function () {
                //$(this).removeClass("icon-black");
                //$(this).addClass("icon-white");
                if (!this.is_sync_rotating) {
                    $(this).css('border','1px solid darkgrey');
                }
            }, function () {
                //$(this).removeClass("icon-white");
                //$(this).addClass("icon-black");
                $(this).css('border','none');
        })
        .on("click", function () {
            if (!this.is_sync_rotating) {
                on_click_callback();
            }
        });
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
};


var edtrSplitters = {
    $this_es:       null,

    //
    // Setup splitter drag events
    //
    init: function(on_drag_end_callback) {
        this.container_elem = $('.main-container');
        this.top_elem = $('.main-view-container');
        this.left_elem = $('.main-view-left');
        this.right_elem = $('.main-view-right');
        this.bottom_elem = $('.sticky-footer');
        this.left_sidebar = this.left_elem.children().filter(":first"); // We assume that sidebar is FIRST div !
        this.lsb_is_visible = true;
        this.preview_container = this.bottom_elem.children().filter(":last"); // We assume that preview is LAST div !
        this.preview_is_visible = true;
        this.vl_splitter = $(".left-splitter");
        this.vr_splitter = $(".right-splitter");
        this.h_splitter = $(".bottom-splitter");
        this.left_min_width = parseInt(this.left_elem.css('min-width'), 10);
        this.left_max_width = parseInt(this.left_elem.css('max-width'), 10);
        this.bottom_min_height = parseInt(this.bottom_elem.css('min-height'), 10);
        this.top_min_height = parseInt(this.top_elem.css('min-height'), 10);
        this.container_shift = this.container_elem.position().top +
            parseInt(this.container_elem.css('bottom'), 10);
        this.is_dragging = false;
        
        $this_es = this;

        this.vl_splitter
        .on("mousedown", function(e) {
            e.preventDefault(); // disable text selection during drag
            if (!$this_es.lsb_is_visible)
                return;
            $(window).on("mousemove", function(e) {
                $this_es.is_dragging = true;
                var new_width = e.clientX-5;
                if (new_width > $this_es.left_max_width)
                    new_width = $this_es.left_max_width;
                else if (new_width < $this_es.left_min_width)
                    new_width = $this_es.left_min_width;
                if (new_width == $this_es.left_elem.width())
                    return;
                $this_es.left_elem.width(new_width);
                $this_es.right_elem.css({left: new_width});
            });
            $(window).on("mouseup", function(e) {
                var was_dragging = $this_es.is_dragging;
                $this_es.is_dragging = false;
                $(window).off("mousemove");
                $(window).off("mouseup");
                if (!was_dragging) { // was clicking
                    //console.log("just a click");
                } else {
                    on_drag_end_callback();
                }
            });
        })
        .on("dblclick", function(e) {
            $this_es.toggle_sidebar();
        });

        this.h_splitter
        .on("mousedown", function(e) {
            e.preventDefault(); // disable text selection during drag
            if (!$this_es.preview_is_visible)
                return;
            // $this_es.preview_container.contents().find('body').on("mousemove", function(e) {
            //     //e.preventDefault(); // disable text selection during drag
            //     console.log(e.pageY);
            // });
            $(window).on("mousemove", function(e) {
                if (!$this_es.is_dragging) {
                    // Apply hack div over iframe, we don't want it to capture our mouse events
                    $this_es.bottom_elem.append('<div id="tarpaulin"></div>');
                }
                $this_es.is_dragging = true;
                var top_height = e.clientY - $this_es.container_shift,
                    new_height = $this_es.container_elem.height() - top_height - 5;
                if (new_height < $this_es.bottom_min_height)
                    new_height = $this_es.bottom_min_height;
                else if (top_height <= $this_es.top_min_height)
                    new_height = $this_es.container_elem.height() - $this_es.top_min_height - 5;
                if (new_height == $this_es.bottom_elem.height())
                    return;
                $this_es.bottom_elem.height(new_height);
                $this_es.top_elem.css({bottom: new_height});
            });
            $(window).on("mouseup", function(e) {
                var was_dragging = $this_es.is_dragging;
                $this_es.is_dragging = false;
                $(window).off("mousemove");
                $(window).off("mouseup");
                if (!was_dragging) { // was clicking
                    //console.log("just a click");
                } else {
                    // Drag finished, remove hack div
                    $('#tarpaulin').remove();
                    on_drag_end_callback();
                }
            });
        })
        .on("dblclick", function(e) {
            $this_es.toggle_preview();
        });
    },

    toggle_sidebar: function() {
        if ($this_es.lsb_is_visible)
            $this_es.hide_sidebar();
        else
            $this_es.show_sidebar();
    },
    hide_sidebar: function() {
        if ($this_es.lsb_is_visible) {
            $this_es.lsb_is_visible = false;
            $this_es.left_sidebar.hide();
            $this_es.vl_splitter.css({left: 0});
            $this_es.right_elem_left = $this_es.right_elem.css("left");
            $this_es.right_elem.css({left: $this_es.vl_splitter.width() +
                parseInt($this_es.vl_splitter.css('right'), 10)});
        }
    },
    show_sidebar: function() {
        if (!$this_es.lsb_is_visible) {
            $this_es.lsb_is_visible = true;
            $this_es.left_sidebar.show();
            $this_es.vl_splitter.removeAttr('style');
            $this_es.right_elem.css({left: $this_es.right_elem_left});
        }
    },
    hide_editor: function() { $this_es.right_elem.hide(); },
    show_editor: function() { $this_es.right_elem.show(); },
    toggle_preview: function() {
        if ($this_es.preview_is_visible)
            $this_es.hide_preview();
        else
            $this_es.show_preview();
    },
    hide_preview: function() {
        if ($this_es.preview_is_visible) {
            $this_es.preview_is_visible = false;
            $this_es.preview_container.hide();
            $this_es.h_splitter.css({top: $this_es.bottom_elem.height() -
                parseInt($this_es.h_splitter.css('top'), 10)});
            $this_es.top_elem_bottom = $this_es.top_elem.css("bottom");
            $this_es.top_elem.css({'bottom': $this_es.h_splitter.height()});
        }
    },
    show_preview: function() {
        if (!$this_es.preview_is_visible) {
            $this_es.preview_is_visible = true;
            $this_es.preview_container.show();
            $this_es.h_splitter.removeAttr('style');
            $this_es.top_elem.css({'bottom': $this_es.top_elem_bottom});
        }
    }
};


//
// Handles all AJAX and Socket IO requests / responses
//
var serverComm = {
    timer_interval:     1000,
    api_v:              "/v1/",
    human_status: {
        0:      "success",
        1:      "directory",
        2:      "image",
        3:      "binary",
        4:      "not found",
        5:      "bad request",
        6:      "called to often",
        20770:  "unknown error",
        20771:  "not implemented",
        30770:  "server failure",
        30771:  "network failure"
    },
    max_success_status: 3,
    sio: null,

    init:                   function() {
        // TODO: HACK: Helps make socket connection more stable ?!
        setTimeout(function() {
            serverComm.sio = new io.connect(
                'http://' + window.location.host + '?xsrf=' + serverComm.get_cookie("_xsrf")
                // {
                //     transports: ['xhr-polling']
                // }
            );

            // Establish event handlers
            serverComm.sio.on('connect', function() {
                console.log("sio.on('connect'): connected");
            });
            serverComm.sio.on('disconnect', function() {
                console.log("sio.on('disconnect'): reconnecting...");
                serverComm.sio.socket.reconnect();
            });

            serverComm.sio.on('dbox_updates', function(response) {
                console.log(response);
                // We receive json string - convert it to object
                response = JSON.parse(response);
                // for (var f in response){
                //     console.log(f+":", response[f]);
                // }

                if (response.status > serverComm.max_success_status) {
                    // server failure
                    messagesBar.show_error("ERROR in sio.on('dbox_updates'):"+
                        serverComm.human_status[response.status]);
                    return;
                }

                // Process updates
                // We do it recursively to allow step by step processing in edtrTree
                function recursive_update(index, updates) {
                    // End recursion
                    if (index === updates.length)
                        return;
                    edtrTree.process_server_update("dropbox",
                        updates[index][0], updates[index][1], function(status) {
                        if (!status) {
                            // TODO: do we need to handle any errors here ?
                        }
                        recursive_update(index+1, updates);
                    });
                }
                recursive_update(0, response.updates);
            });
        }, 1000);

        // $( document ).ajaxError(serverComm._ajax_failed);
    },

    get_cookie:             function (name) {
        var c = document.cookie.match("\\b" + name + "=([^;]*)\\b");
        if (!c && name == "_xsrf") {
            return 'not_found';
        }
        return c ? c[1] : undefined;
    },

    api_url: function (source, request) {
        return this.api_v + source + '/' + request + '/';
        // "?reload="+(new Date()).getTime(),
    },

    // _ajax_failed: function(event, jqxhr, settings, exception) {
    //     $(".server-action").hide();
    //     $('.file-loading').hide();
    //     // network failure
    //     messagesBar.show_internal_error("serverComm._ajax_failed",
    //         "url: "+settings.url+", exception: "+exception);
    //     if (serverComm.on_err_callback) {
    //         console.log(source, action_string, "ERROR", textStatus, data);
    //         data = {};
    //         data.status = 30770;
    //         serverComm.on_err_callback.call(null, data);
    //     }
    // },

    post_request: function (source, request, params, callback) {
        params["_xsrf"] = this.get_cookie("_xsrf");
        // serverComm.on_err_callback = callback;
        $.post(serverComm.api_url(source, request), params, callback)
        .fail(function(jqXHR, textStatus, data) {
            if (textStatus !== "success") {
                // server failure
                messagesBar.show_error("ERROR: '"+source+" "+request+"' for <b>"+params.path+"</b><br>"+
                    jqXHR.status+": "+jqXHR.statusText);
                callback.call(null, null, textStatus, jqXHR);
            } else {
                callback.call(null, data, textStatus, jqXHR);
            }
        });
    },

    // Process action using POST request to server
    action: function(source, action_string, params, callback) {
        this.post_request(source, action_string, params, function(data, textStatus, jqXHR) {
            if (!data) {
                // console.log(source, action_string, "ERROR", textStatus, data);
                // We're here from post_request.fail, so error message should already be displayed
                // pass error to callback
                data = {};
                data.status = 30770;
                callback.call(null, data);
            } else if(textStatus !== "success") {
                // pass error to callback
                // TODO: actually we shouldn't get here ?!
                console.log(source, action_string, "ERROR", textStatus, data);
                data.status = 30770;
                messagesBar.show_error("ERROR: '"+source+" "+action_string+"' for <b>"+params.path+"</b><br>"+
                    serverComm.human_status[data.status]+"<br>"+data.http_code+data.error);
                callback.call(null, data);
            } else {
                // success
                // console.log(source, action_string, params, data);
                if (data.status > serverComm.max_success_status) {
                    messagesBar.show_error("ERROR: '"+source+" "+action_string+"' for <b>"+params.path+"</b><br>"+
                        serverComm.human_status[data.status]);
                }
                // TODO: check status == 2
                if (data.url)
                    data.content = data.url;
                callback.call(null, data);
            }
        });
    }

    // get_server_result:      function( task_id, callback_ok, callback_error ) {
    //     // // Check for special task_ids, those can be emitted by blocking calls
    //     // // on the server, which don't need to be polled for result
    //     // if ( task_id.startsWith('TASK COMPLETED') ) {
    //     //     // Task completed ! Hooray !
    //     //     callback_ok(task_id);
    //     //     return;
    //     // } else if ( task_id.startsWith('TASK FAILED') ) {
    //     //     // Task completed ! Hooray !
    //     //     callback_error(task_id);
    //     //     return;
    //     // }
    //     // Poll server for result from async operation
    //     $.post("/get_result/", {
    //         task_id: task_id
    //     }, function(data) {
    //         if (data['status'] != 'success') {
    //             // Serious error
    //             callback_error(data['messages'][0]);
    //         } else {
    //             if (data['result'] == 'FAILURE') {
    //                 // Task failed, oh-oh
    //                 for (var i=0; i < data['messages'].length; i++)
    //                     callback_error(data['messages'][i]);
    //             } else if (data['result'] == 'SUCCESS') {
    //                 // Task completed ! Hooray !
    //                 callback_ok(data['messages'][0]);
    //             } else  if (data['result'] == 'PENDING') {
    //                 // Task not completed yet, restart timer
    //                 if (data['messages'].length)
    //                     messagesBar.show_notification(data['messages'][0]);
    //                 setTimeout(function() {
    //                     this.get_server_result(task_id, callback_ok, callback_error);
    //                 }, this.timer_interval);
    //             } else { // Unrecognized result ?!
    //                 messagesBar.show_internal_error("serverComm.get_server_result",
    //                     "Unrecognized result: "+data['result']);
    //             }
    //         }
    //     });
    // }
};
