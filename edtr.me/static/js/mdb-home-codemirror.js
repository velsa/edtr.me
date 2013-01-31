// IMPORTANT:
// replace CodeMirrors isWordChar() with this function
// for smarter word detection (includes markdown tags)
// var isWordChar = function ( ch ) {
//     return '/[\w\*\.:#/+\-`~]/'.test(ch) || ch.toUpperCase() != ch.toLowerCase();
// }

// Class definition
function edtrCodemirror(content_type, content) {
    //
    // CALLBACKS (must be defined BEFORE usage !)
    //
    
    this.hide_codemirror = function() {
        $this.is_hidden = true;
        $this.set_saved_state("SAVED");
        //$('#cme_wide_toggle').html("&nbsp;");
        edtrSplitters.hide_editor();
        $this.dom_elem.show().attr("disabled", "true");
    };

    this.toggle_width = function() {
        edtrSplitters.toggle_sidebar();
    };

    this.toggle_fullscreen = function() {
        if (!$this.is_codemirror_fullscreen) {
            $this.is_codemirror_fullscreen = true;
            edtrSplitters.hide_sidebar();
            edtrSplitters.hide_preview();
        } else {
            $this.is_codemirror_fullscreen = false;
            edtrSplitters.show_sidebar();
            edtrSplitters.show_preview();
        }
        // if ($this.is_codemirror_fullscreen) {
        //     $this.out_of_fullscreen();
        //     return;
        // }
        // var scroller = $this.cm_editor.getScrollerElement();
        // if (scroller.className.search(/\bCodeMirror-fullscreen\b/) === -1) {
        //     scroller.className += " CodeMirror-fullscreen";
        //     scroller.style.height = "100%";
        //     scroller.style.width = "100%";
        //     $this.cm_editor.refresh();
        //     $this.is_codemirror_fullscreen = true;
        // } else {
        //     $this.out_of_fullscreen();
        // }
    };

    // this.out_of_fullscreen = function() {
    //     var scroller = $this.cm_editor.getScrollerElement();
    //     if (scroller.className.search(/\bCodeMirror-fullscreen\b/) !== -1) {
    //         scroller.className = scroller.className.replace(" CodeMirror-fullscreen", "");
    //         scroller.style.height = '';
    //         scroller.style.width = '';
    //         $this.cm_editor.refresh();
    //     }
    //     $this.is_codemirror_fullscreen = false;
    // };

    this.replace_selection = function (text) {
        $this.cm_editor.replaceSelection(text);
        $this.cm_editor.focus();
    };

    //
    // TOOLBAR
    //

    // Bold, Italic and Code toolbar icons
    // TODO: bold and italic should be set via settings
    this.toggle_bold = function() { $this.toggle_markup("**"); };
    this.toggle_italic = function() { $this.toggle_markup("_"); };
    this.toggle_code = function() { $this.toggle_markup("`"); };
    this.toggle_markup = function(markup) {
        var mlen = markup.length;
        if ($this.cm_editor.somethingSelected()) {
            // Check if we need to remove the bold markup
            var sel = $this.cm_editor.getSelection();
            if (sel.substring(0, mlen) == markup) {
                //console.log(sel,mlen,markup);
                sel = sel.substring(mlen);
                if (sel.substr(sel.length-mlen, mlen) == markup) {
                    sel = sel.substring(0, sel.length-mlen);
                }
                $this.cm_editor.replaceSelection(sel);
            } else {
                $this.cm_editor.replaceSelection(markup+$this.cm_editor.getSelection()+markup);
            }
        } else {
            // Simply insert markup and place cursor int the middle
            $this.cm_editor.replaceRange(markup+$this.cm_editor.getSelection()+markup,
                $this.cm_editor.getCursor("start"));
            var pos = $this.cm_editor.getCursor("start");
            $this.cm_editor.setCursor(pos.line, pos.ch - mlen);
            //console.log("POS "+ pos['ch']);
        }
        $this.cm_editor.focus();
    };

    // Rotate Header
    this.rotate_header = function() {
        if ($this.cm_editor.somethingSelected()) {
            // TODO: Idea: when smth is selected, use underscore header styling
        }
        // Check if we need to remove the bold markup
        var cur = $this.cm_editor.getCursor(true),
            line = $this.cm_editor.getLine(cur.line),
            new_header = "",
            space_after_left_header = "",
            space_before_right_header = "",
            cur_shift;
        for (var i=0; i < 7; i++)
            if (line[i] != '#') break;
        if (i < 6) {
            for (var k=0; k<=i; k++)
                new_header += '#';
            cur_shift = 1;
        } else {
            cur_shift = -6;
        }
        //console.log(new_header);
        var sub_line = line.substr(i);
        if (sub_line[0] != ' ' && sub_line[0] != '\t')
            space_after_left_header = ' ';
        for (i=sub_line.length-1; i >= 0; i--)
            if (sub_line[i] != '#') break;
        sub_line = sub_line.substr(0, i+1);
        if (sub_line[i] != ' ' && sub_line[i] != '\t')
            space_before_right_header = ' ';
        var new_line =  new_header + space_after_left_header +
                        sub_line +
                        space_before_right_header + new_header;

        $this.cm_editor.setLine(cur.line, new_line);
        $this.cm_editor.setCursor(cur.line, cur.ch + cur_shift);
        $this.cm_editor.focus();
    };

    // Unordered List
    this.unordered_list = function() {
        if ($this.cm_editor.somethingSelected()) {
            //cm_editor.indentSelection("prev");
            var lines = CodeMirror.splitLines($this.cm_editor.getSelection());
            for (var i=0; i<lines.length; i++) {
                if (lines[i]) {
                    if (/^\s*[*\-+]\s+/.test(lines[i]))
                        lines[i] = lines[i].replace(/^(\s*)([*\-+]\s+)(.*)$/,"$1$3");
                    else if (/^\s*[0-9]+\.\s+/.test(lines[i]))
                        lines[i] = lines[i].replace(/^(\s*)([0-9]+\.\s+)(.*)$/,"$1"+$this.list_character+" $3");
                    else
                        lines[i] = lines[i].replace(/^(\s*)(.*)$/,"$1"+$this.list_character+" $2");
                }
            }
            $this.cm_editor.replaceSelection(lines.join("\n"));
        } else {
            var cur = $this.cm_editor.getCursor(true);
            var line = $this.cm_editor.getLine(cur.line);
            if (!line)
                $this.cm_editor.setLine(cur.line, $this.list_character + ' ');
            else
                $this.cm_editor.setLine(cur.line, line + '\n' + $this.list_character + ' ');
        }
    };

    // Ordered List
    this.ordered_list = function() {
        if ($this.cm_editor.somethingSelected()) {
            var lines = CodeMirror.splitLines($this.cm_editor.getSelection());
            for (var i=0; i<lines.length; i++) {
                if (lines[i]) {
                    if (/^\s*[0-9]+\.\s+/.test(lines[i]))
                        lines[i] = lines[i].replace(/^(\s*)([0-9]+\.\s+)(.*)$/,"$1$3");
                    else if (/^\s*[*\-+]\s+/.test(lines[i]))
                        lines[i] = lines[i].replace(/^(\s*)([*\-+]\s+)(.*)$/,"$1"+(i+1)+". $3");
                    else
                        lines[i] = lines[i].replace(/^(\s*)(.*)$/,"$1"+(i+1)+". $2");
                }
            }
            $this.cm_editor.replaceSelection(lines.join("\n"));
        } else {
            var cur = $this.cm_editor.getCursor(true);
            var line = $this.cm_editor.getLine(cur.line);
            if (!line)
                $this.cm_editor.setLine(cur.line, "1. ");
            else
                $this.cm_editor.setLine(cur.line, line + "\n1. ");
        }
    };

    // Blockquote
    this.blockquote = function() {
        if ($this.cm_editor.somethingSelected()) {
            //$this.cm_editor.indentSelection("prev");
            var lines = CodeMirror.splitLines($this.cm_editor.getSelection());
            for (var i=0; i<lines.length; i++) {
                if (lines[i]) {
                    if (/^\s*>\s+/.test(lines[i]))
                        lines[i] = lines[i].replace(/^(\s*)(>\s+)(.*)$/,"$1$3");
                    else
                        lines[i] = lines[i].replace(/^(\s*)(.*)$/,"$1"+'>'+" $2");
                }
            }
            $this.cm_editor.replaceSelection(lines.join("\n"));
        } else {
            var cur = $this.cm_editor.getCursor(true);
            var line = $this.cm_editor.getLine(cur.line);
            if (!line)
                $this.cm_editor.setLine(cur.line, '> ');
            else
                $this.cm_editor.setLine(cur.line, line + '\n> ');
        }
    };

    this.divider_hr = function() {
        var sel='';
        if ($this.cm_editor.somethingSelected()) {
            // Insert divider BEFORE selection
            sel = $this.cm_editor.getSelection();
        }
        $this.cm_editor.replaceSelection('\n***\n\n'+sel);
        var end_pos = $this.cm_editor.getCursor(false);
        $this.cm_editor.setSelection(end_pos, end_pos);
        $this.cm_editor.focus();
    };

    // Image URL
    this.insert_image_url = function() {
        $this.smart_insert_url(1);
    };
    // URL
    this.insert_url = function() {
        $this.smart_insert_url(0);
    };
    // Image or URL
    // is_img should be 1 or 0 (NOT true or false !)
    this.smart_insert_url = function(is_img) {
        // Default is to place cursor inside curly brackets
        // (the url itself)
        var sel = "", step=3+is_img;
        if ($this.cm_editor.somethingSelected()) {
            // Replace selection and place cursor in
            // square brackets (image description)
            sel = $this.cm_editor.getSelection();
            step = 1+is_img;
        }
        var img_char = is_img ? '!': '';
        $this.cm_editor.replaceSelection(img_char+'[]('+sel+')');
        var pos = $this.cm_editor.getCursor(true);
        $this.cm_editor.setCursor( pos.line, pos.ch+step);
        $this.cm_editor.focus();
    };

    // Tab - insert tab, or move selection
    this.tab = function() {
        if ($this.cm_editor.somethingSelected()) {
            CodeMirror.commands.indentMore($this.cm_editor);
        } else {
            var cur = $this.cm_editor.getCursor();
            var line = $this.cm_editor.getLine(cur.line);
            var pad_str = $this.tab_character;
            if (cur.ch) {
                // Calculate pos in line with respect to tab characters
                var ins_pos = 0;
                for (var i=0; i < cur.ch; i++)
                    if (line[i] == '\t') ins_pos += $this.tab_spaces.length;
                    else ins_pos++;
                var pad_spaces = $this.tab_spaces.length - (ins_pos % $this.tab_spaces.length);
                if (pad_spaces != $this.tab_spaces.length)
                    pad_str = $this.tab_spaces.substr(0, pad_spaces);
            }
            var new_line = line.substring(0, cur.ch)+pad_str+line.substring(cur.ch);
            $this.cm_editor.setLine(cur.line, new_line);
            $this.cm_editor.setCursor(cur.line, cur.ch+pad_str.length);
        }
        $this.cm_editor.focus();
    };

    // Shift-Tab - shift back selection or line
    this.shift_tab = function() {
        CodeMirror.commands.indentLess($this.cm_editor);
    };

    // Custom new line handling - smart list indents
    this.custom_new_line = function() {
        CodeMirror.commands.newlineAndIndent($this.cm_editor);
        // Handle lists
        var cur = $this.cm_editor.getCursor();
        var prev_indented = $this.cm_editor.getLine(cur.line-1).substr(cur.ch);
        // Unordered lists and blockquotes
        if (/^[*\-+>]\s+/.test(prev_indented)) {
            // See if we have an empty list bullet or blockquote tag
            // Also make sure that new line text is empty
            if (/^[*\-+>] $/.test(prev_indented) &&
                $this.cm_editor.getLine(cur.line).length === 0) {
                // In such case we consider $this to be the end of
                // a list or blockquote and remove the last tag
                $this.cm_editor.setCursor(cur.line-1, 0);
                //CodeMirror.commands.killLine($this.cm_editor);
                $this.cm_editor.removeLine(cur.line);
            } else {
                $this.cm_editor.replaceSelection(prev_indented[0]+" ", "end");
            }
        } else {
            // Ordered lists
            if (/^[0-9]+\.\s+/.test(prev_indented)) {
                var prev_num = prev_indented.match(/^[0-9]+/);
                if (/^[0-9]+\. $/.test(prev_indented)) {
                    $this.cm_editor.setCursor(cur.line-1, 0);
                    //CodeMirror.commands.killLine($this.cm_editor);
                    $this.cm_editor.removeLine(cur.line);
                } else {
                    $this.cm_editor.replaceSelection((parseInt(prev_num, 10)+1)+". ", "end");
                }
            }
        }
    };



    //
    // EDITOR BUTTONS
    //
    // PREVIEW BUTTON: Preview HTML
    this.preview_codemirror = function () {
        console.log($.cookie('mdb_preview_url'));
        window.open($.cookie('mdb_preview_url')+
            "?reload="+(new Date()).getTime(), '');
        //return false;
    };

    // Callbacks, which are called by get_server_result()
    this.save_failed = function(message) {
        $this.set_saved_state("NOT SAVED");
        messagesBar.show_error(message);
    };
    this.saved_ok = function(message) {
        $this.set_saved_state("SAVED");
        messagesBar.show_notification(message);
    };
    // SAVE BUTTON: Save Markdown to Dropbox
    this.save_codemirror = function () {
        var text = cm_editor.getValue();
        $this.set_saved_state("SAVING");
        $.post("/async/save/", {
            db_path: $.cookie('mdb_current_dbpath'),
            content: text
        }, function(data) {
            if (data.status != 'success') {
                // Serious error
                $this.save_failed(data.message);
            } else {
                // Wait for result from server
                serverComm.get_server_result(data.task_id,
                    $this.saved_ok, $this.save_failed);
            }
        }).error(function(data) {
                messagesBar.show_error("Can't communicate with server ! Please refresh the page.");
            });
        //return false;
    };



    //
    // Scroll preview-container to corresponding anchor
    //
    this.scroll_to_anchor = function() {
        var line_num = $this.cm_editor.getCursor(true).line+1;
        if ($this.cur_line !== line_num) {
            $this.cur_line = line_num;
            var i,
                anchor_num=0,
                prev_anchor_num=0,
                next=0,
                ratio=0,
                preview_offset = $this.aTags.first().position().top,
                aTag=null;
            // Find anchor, corresponding to line_num
            for (i=0; i < $this.aTags.size(); i++) {
                anchor_num = parseInt($this.aTags.get(i).name, 10);
                if (anchor_num == line_num) {
                    break;
                }
                if (anchor_num > line_num){
                    if (i > 0) {
                        // Scroll in between the two anchors
                        ratio = (line_num-prev_anchor_num)/(anchor_num-prev_anchor_num);
                        preview_offset -= Math.abs($this.aTags.slice(i).position().top -
                            $this.aTags.slice(i-1).position().top) * ratio;
                        --i;
                    }
                    break;
                }
                prev_anchor_num = anchor_num;
            }
            // The anchor to scroll to
            // If we're at the last tag - adjust to it
            if (i == $this.aTags.size()) --i;
            aTag = $this.aTags.slice(i);
            if (aTag !== null && aTag.length) {
                var new_pos;
                new_pos = Math.max(0,
                        Math.abs(aTag.position().top-preview_offset) - 20);
                if (new_pos !== $this.preview_pos) {
                    $this.preview_pos = new_pos;
                    $this.preview_elem.scrollTop(new_pos);
                }
            }
        }
    };

    //
    // Text in CodeMirror changed
    //
    // This function will be called VERY OFTEN !
    this.on_change = function(inst, change_obj) {
        // console.log($this.saved_state);
        if ($this.saved_state == 2) {
            $this.set_saved_state("NOT SAVED");
        }
        // Update preview on timer (no need for preview when in fullscreen)
        if (!$this.is_codemirror_fullscreen && !$this.is_timer) {
            $this.is_timer = true;
            setTimeout(function() {
                // Generate preview
                $this.preview_elem.html(marked($this.cm_editor.getValue()));
                // Get anchors from generated preview
                $this.aTags = $this.preview_elem.find("a.marked-anchor");
                $this.scroll_to_anchor();
                $this.is_timer = false;
            }, 100);
        }
    };


    // TODO: Use this to open clicked urls (Ctrl-Click)
    this.on_cursor_activity = function(inst) {
        // console.log("cursor");
        $this.cm_editor.matchHighlight("CodeMirror-matchhighlight");
        $this.scroll_to_anchor();
    };

    // TODO: bind Alt-M to set/remove markers on gutter
    // TODO: and Alt-Shift-M to jump over markers
    this.on_gutter_clicked = function(inst, n) {
        var info = $this.cm_editor.lineInfo(n);
        if (info.markerText)
            $this.cm_editor.clearMarker(n);
        else
            $this.cm_editor.setMarker(n, "<span style=\"color: #add8e6;\">&gt;</span> %N%");
    };

    //
    // INITIALIZATION (constructor)
    //
    this.is_codemirror_fullscreen=      false;
    this.is_hidden=          true;
    this.is_saved=           true;
    this.tab_character=                 "\t";
    this.tab_spaces=                    Array(4).join(" "); // should equal to tab_character
    this.list_character=                "-";
    this.cm_editor=                     null;
    this.dom_elem=                      null;
    this.preview_elem=                  null;
    this.content_type=                  null;
    this.saved_state=                   -1; // 0 - not saved, 1 - saving, 2 - saved
    
    // store pointer to ourselves to be able
    // to access object from callbacks
    var $this=this;

    if (content_type !== "markdown") {
        messagesBar.show_error("ERROR: content "+content_type+" is not supported");
        return false;
    }
    
    // If content_type changed it means that home-tree has replaced
    // editor's HTML and preview-container
    // TODO: do we need to remove previous codemirror's bindings ?
    if (this.content_type !== content_type) {
        this.dom_elem = $(".cme-textarea");
        //console.log(this.dom_elem);
        this.content_type = content_type;

        this.preview_container = $(".preview-container");
        this.preview_elem = this.preview_container.contents().find('body');
        /* Allows last line to be positioned above the bottom */
        this.preview_elem.css("margin-bottom", "90px");
        this.preview_elem_head = this.preview_container.contents().find('head');
        // TODO: load this from settings
        this.preview_elem_head.
            append("<link rel=\"stylesheet\" href=\"/static/css/md_preview/github.css?reload=" +
                (new Date()).getTime() + "\">");

        //$(".preview-area");

        // Timer for updating preview
        this.is_timer = false;
        if (this.timerID !== undefined && this.timerID)
            clearTimeout(this.timerID);
        this.timerID = null;

        // tab_character and tab_spaces for padding
        
        // TODO: Get those from folder/general settings
        // tab_character = "\t";
        // tab_spaces = "";
        // list_character = "-";
        //for (var i=0; i<4; i++) tab_spaces += " ";
        var cm_settings = {
            // TODO: all settings should accord to content_type
            mode:               "gfm", // "gfm" is broken ?!

            // TODO: Get those from folder/general settings
            // gutter:             true,
            // fixedGutter:        true,
            lineNumbers:        true,
            lineWrapping:       true,
            matchBrackets:      true,
            pollInterval:       300,
            undoDepth:          500,
            theme:              "eclipse", //solarized light",
            indentUnit:         this.tab_spaces.length,
            tabSize:            this.tab_spaces.length, // should be the same !
            indentWithTabs:     true,
            electricChars:      false,
            autoCloseTags:      true,   // TODO: apparently works only in text/html mode
                                        // makw it work in gfm mode as well

            // TODO = find Mac equivalents
            extraKeys: {
                // General
                "Ctrl-F11":     this.toggle_width,
                //"F11":          toggle_fullscreen,  TODO = fix layout for fullscreen
                "Esc":          this.out_of_fullscreen,
                // File
                "Ctrl-S":       this.save_codemirror,
                // Edit
                "Tab":          this.tab,
                "Shift-Tab":    this.shift_tab,
                "Enter":        this.custom_new_line,
                // Markdown
                "Meta-H":       this.rotate_header,
                "Ctrl-B":       this.toggle_bold,
                "Ctrl-I":       this.toggle_italic,
                "Ctrl-K":       this.toggle_code,

                "Ctrl-U":       this.unordered_list,
                "Ctrl-O":       this.ordered_list,
                "Ctrl-Q":       this.blockquote,

                "Ctrl-D":       this.divider_hr,

                "Ctrl-G":       this.insert_image_url,
                "Ctrl-L":       this.insert_url
            }
        };

        this.cm_editor = CodeMirror.fromTextArea(this.dom_elem.get(0), cm_settings);

        // .ON events
        this.cm_editor.on("change", this.on_change);
        this.cm_editor.on("cursorActivity", this.on_cursor_activity);
        // onGutterClick:      this.on_gutter_clicked,

        // Hides original text area, just in case
        this.dom_elem.hide();

        // Set default options for marked
        marked.setOptions({
          gfm:              true,
          tables:           false,
          breaks:           true,
          pedantic:         false,
          sanitize:         false
        });

        // Add bootstrap class to codemirror so it will behave
        // correctly on resizes
        //$('.CodeMirror-wrap').addClass('span9');
    } else {
        // TODO: do we need to do anything else if editor is of the same type ?
    }

    // Show codemirror
    //$('#cme_wide_toggle').html(toggle_left);

    // ON CLICK Toolbar handlers
    $('#tbb_header').on("click", this.rotate_header);
    $('#tbb_bold').on("click", this.toggle_bold);
    $('#tbb_italic').on("click", this.toggle_italic);
    $('#tbb_code').on("click", this.toggle_code);
    // --
    $('#tbb_ulist').on("click", this.unordered_list);
    $('#tbb_olist').on("click", this.ordered_list);
    $('#tbb_quote').on("click", this.blockquote);
    // --
    $('#tbb_divider').on("click", this.divider_hr);
    // --
    $('#tbb_image_url').on("click", this.insert_image_url);
    $('#tbb_url').on("click", this.insert_url);
    // ----
    $('#tbb_width').on("click", this.toggle_width);
    $('#tbb_fullscreen').on("click", this.toggle_fullscreen);

    // And buttons
    $('#btn_preview').on("click", this.preview_codemirror);
    $('#btn_save').on("click", this.save_codemirror);

    // TOOLTIPS for toolbar
    // TODO: THOSE DON'T WORK BECAUSE #editor_area is overflow: hidden
    $(".cme-toolbar-tooltip").tooltip({ placement: "top", html: true, delay: { show: 1000, hide: 300 } });
    // And buttons
    $(".cme-button-tooltip").tooltip({ placement: "bottom", delay: { show: 800, hide: 300 } });

    this.cm_editor.setValue(content);//search_words.join("\n"));
    this.cm_editor.focus();

    // Set correct flags
    this.is_hidden = false;
    this.set_saved_state("SAVED");

    return this;
}

//var toggle_left = "&lt;&lt;";
//var toggle_right = "&gt;&gt;";

// SAVE state helpers: changes state while saving
edtrCodemirror.prototype.set_saved_state = function(saved) {
    if (saved == "SAVED") {
        this.saved_state = 2;
        this.is_saved = true;
        $('#btn_save_text').text("SAVED");
        $('#btn_save').removeClass("btn-success").attr('disabled', 'disabled');
    } else if (saved == "SAVING") {
        this.saved_state = 1;
        this.is_saved = false;
        $('#btn_save_text').text("saving...");
        $('#btn_save').removeClass("btn-success").attr('disabled', 'disabled');
    } else { // "NOT SAVED"
        this.saved_state = 0;
        this.is_saved = false;
        $('#btn_save_text').text("Save");
        $('#btn_save').addClass("btn-success").removeAttr('disabled');
    }
};
