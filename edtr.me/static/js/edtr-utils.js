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
    self:       null,

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

        self = this;

        this.vl_splitter
        .on("mousedown", function(e) {
            e.preventDefault(); // disable text selection during drag
            if (!self.lsb_is_visible)
                return;
            $(window).on("mousemove", function(e) {
                self.is_dragging = true;
                var new_width = e.clientX-5;
                if (new_width > self.left_max_width)
                    new_width = self.left_max_width;
                else if (new_width < self.left_min_width)
                    new_width = self.left_min_width;
                if (new_width == self.left_elem.width())
                    return;
                self.left_elem.width(new_width);
                self.right_elem.css({left: new_width});
            });
            $(window).on("mouseup", function(e) {
                var was_dragging = self.is_dragging;
                self.is_dragging = false;
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
            self.toggle_sidebar();
        });

        this.h_splitter
        .on("mousedown", function(e) {
            e.preventDefault(); // disable text selection during drag
            if (!self.preview_is_visible)
                return;
            // self.preview_container.contents().find('body').on("mousemove", function(e) {
            //     //e.preventDefault(); // disable text selection during drag
            //     console.log(e.pageY);
            // });
            $(window).on("mousemove", function(e) {
                if (!self.is_dragging) {
                    // Apply hack div over iframe, we don't want it to capture our mouse events
                    self.bottom_elem.append('<div id="tarpaulin"></div>');
                }
                self.is_dragging = true;
                var top_height = e.clientY - self.container_shift,
                    new_height = self.container_elem.height() - top_height - 5;
                if (new_height < self.bottom_min_height)
                    new_height = self.bottom_min_height;
                else if (top_height <= self.top_min_height)
                    new_height = self.container_elem.height() - self.top_min_height - 5;
                if (new_height == self.bottom_elem.height())
                    return;
                self.bottom_elem.css({height: new_height, top: "auto"});
                self.top_elem.css({bottom: new_height});
            });
            $(window).on("mouseup", function(e) {
                var was_dragging = self.is_dragging;
                self.is_dragging = false;
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
            self.toggle_preview();
        });

        $(window).resize(function () {
            self.bottom_elem.css({
                top:    self.top_elem.height()+"px",
                height: "auto"
            });
        });
    },

    toggle_sidebar: function() {
        if (self.lsb_is_visible)
            self.hide_sidebar();
        else
            self.show_sidebar();
    },
    hide_sidebar: function() {
        if (self.lsb_is_visible) {
            self.lsb_is_visible = false;
            self.left_sidebar.hide();
            self.vl_splitter.css({left: 0});
            self.right_elem_left = self.right_elem.css("left");
            self.right_elem.css({left: self.vl_splitter.width() +
                parseInt(self.vl_splitter.css('right'), 10)});
        }
    },
    show_sidebar: function() {
        if (!self.lsb_is_visible) {
            self.lsb_is_visible = true;
            self.left_sidebar.show();
            self.vl_splitter.removeAttr('style');
            self.right_elem.css({left: self.right_elem_left});
        }
    },
    hide_editor: function() { self.right_elem.hide(); },
    show_editor: function() { self.right_elem.show(); },
    toggle_preview: function() {
        if (self.preview_is_visible)
            self.hide_preview();
        else
            self.show_preview();
    },
    hide_preview: function() {
        if (self.preview_is_visible) {
            self.preview_is_visible = false;
            self.preview_container.hide();
            self.h_splitter.css({top: self.bottom_elem.height() -
                parseInt(self.h_splitter.css('top'), 10)});
            self.top_elem_bottom = self.top_elem.css("bottom");
            self.top_elem.css({'bottom': self.h_splitter.height()});
        }
    },
    show_preview: function() {
        if (!self.preview_is_visible) {
            self.preview_is_visible = true;
            self.preview_container.show();
            self.h_splitter.removeAttr('style');
            self.top_elem.css({'bottom': self.top_elem_bottom});
        }
    }
};

function requestFullScreen(element) {
    // Supports most browsers and their versions.
    var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullScreen;

    if (requestMethod) { // Native full screen.
        requestMethod.call(element);
    } else if (typeof window.ActiveXObject !== "undefined") { // Older IE.
        var wscript = new ActiveXObject("WScript.Shell");
        if (wscript !== null) {
            wscript.SendKeys("{F11}");
        }
    }
}

//
// Handles all AJAX and Socket IO requests / responses
//
var serverComm = {
    timer_interval:     1000,
    api_v:              "/v1/",
    human_status: {
        0:      "success",
        1:      "not found",
        2:      "bad request",
        3:      "called to often",
        4:      "already published",
        20770:  "unknown error",
        20771:  "not implemented",
        30770:  "server failure",
        30771:  "network failure"
    },
    FILE_TYPES: {
        0:      "directory",
        1:      "text_file",
        3:      "image",
        4:      "binary"
    },
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

                if (response.errcode) {
                    // server failure
                    messagesBar.show_error("ERROR in sio.on('dbox_updates'):"+
                        serverComm.human_status[response.errcode]);
                    return;
                }

                debugger;
                var obj, updates_arr = [];
                // Process updates
                // We do it recursively to allow step by step processing in edtrTree
                function recursive_update(index, updates) {
                    // End recursion
                    if (index === updates.length)
                        return;
                    edtrTree.process_server_update("dropbox",
                        updates[index], function(status) {
                        if (!status) {
                            // TODO: do we need to handle any errors here ?
                        }
                        recursive_update(index+1, updates);
                    });
                }
                // Create an array from object to iterate over it in recursion
                for (obj in response.updates)
                    updates_arr.push(response.updates[obj]);
                recursive_update(0, updates_arr);
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

    // Do error processing
    // Currently only displays error message
    process_errcode: function(context, data) {
        if (data.errcode) {
            messagesBar.show_error("ERROR: <b>'"+context+"'</b>: "+serverComm.human_status[data.errcode]);
        }
    },

    // Process action using POST request to server
    action: function(source, action_string, params, callback) {
        this.post_request(source, action_string, params, function(data, textStatus, jqXHR) {
            if (!data) {
                // console.log(source, action_string, "ERROR", textStatus, data);
                // We're here from post_request.fail, so error message should already be displayed
                // pass error to callback
                data = {};
                data.errcode = 30770;
                callback.call(null, data);
            } else if(textStatus !== "success") {
                // pass error to callback
                // TODO: actually we shouldn't get here ?!
                console.log(source, action_string, "ERROR", textStatus, data);
                data.errcode = 30770;
                messagesBar.show_error("ERROR: '"+source+" "+action_string+"' for <b>"+params.path+"</b><br>"+
                    serverComm.human_status[data.errcode]+"<br>"+data.http_code+data.error);
                callback.call(null, data);
            } else {
                // success
                // console.log(source, action_string, params, data);
                if (data.errcode) {
                    messagesBar.show_error("ERROR: '"+source+" "+action_string+"' for <b>"+params.path+"</b><br>"+
                        serverComm.human_status[data.errcode]);
                }
                callback.call(null, data);
            }
        });
    }
};
