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

    this.focus = function() {
        self.cm_editor.focus();
    },

    this.hide_codemirror = function() {
        self.is_hidden = true;
        self.set_saved_state("SAVED");
        //$('#cme_wide_toggle').html("&nbsp;");
        edtrSplitters.hide_editor();
        self.dom_elem.show().attr("disabled", "true");
    };

    this.toggle_width = function() {
        edtrSplitters.toggle_sidebar();
    };

    this.toggle_fullscreen = function() {
        if (!self.is_codemirror_fullscreen) {
            self.is_codemirror_fullscreen = true;
            edtrSplitters.hide_sidebar();
            edtrSplitters.hide_preview();
        } else {
            self.is_codemirror_fullscreen = false;
            edtrSplitters.show_sidebar();
            edtrSplitters.show_preview();
        }
        // if (self.is_codemirror_fullscreen) {
        //     self.out_of_fullscreen();
        //     return;
        // }
        // var scroller = self.cm_editor.getScrollerElement();
        // if (scroller.className.search(/\bCodeMirror-fullscreen\b/) === -1) {
        //     scroller.className += " CodeMirror-fullscreen";
        //     scroller.style.height = "100%";
        //     scroller.style.width = "100%";
        //     self.cm_editor.refresh();
        //     self.is_codemirror_fullscreen = true;
        // } else {
        //     self.out_of_fullscreen();
        // }
    };

    // this.out_of_fullscreen = function() {
    //     var scroller = self.cm_editor.getScrollerElement();
    //     if (scroller.className.search(/\bCodeMirror-fullscreen\b/) !== -1) {
    //         scroller.className = scroller.className.replace(" CodeMirror-fullscreen", "");
    //         scroller.style.height = '';
    //         scroller.style.width = '';
    //         self.cm_editor.refresh();
    //     }
    //     self.is_codemirror_fullscreen = false;
    // };

    this.replace_selection = function (text) {
        self.cm_editor.replaceSelection(text);
        self.cm_editor.focus();
    };

    //
    // TOOLBAR
    //

    // Bold, Italic and Code toolbar icons
    // TODO: bold and italic should be set via settings
    this.toggle_bold = function() { self.toggle_markup("**"); };
    this.toggle_italic = function() { self.toggle_markup("_"); };
    this.toggle_code = function() { self.toggle_markup("`"); };
    this.toggle_markup = function(markup) {
        var mlen = markup.length;
        if (self.cm_editor.somethingSelected()) {
            // Check if we need to remove the bold markup
            var sel = self.cm_editor.getSelection();
            if (sel.substring(0, mlen) === markup) {
                //console.log(sel,mlen,markup);
                sel = sel.substring(mlen);
                if (sel.substr(sel.length-mlen, mlen) === markup) {
                    sel = sel.substring(0, sel.length-mlen);
                }
                self.cm_editor.replaceSelection(sel);
            } else {
                self.cm_editor.replaceSelection(markup+self.cm_editor.getSelection()+markup);
            }
        } else {
            // Simply insert markup and place cursor int the middle
            self.cm_editor.replaceRange(markup+self.cm_editor.getSelection()+markup,
                self.cm_editor.getCursor("start"));
            var pos = self.cm_editor.getCursor("start");
            self.cm_editor.setCursor(pos.line, pos.ch - mlen);
            //console.log("POS "+ pos['ch']);
        }
        self.cm_editor.focus();
    };

    // Rotate Header
    this.rotate_header = function() {
        if (self.cm_editor.somethingSelected()) {
            // TODO: Idea: when smth is selected, use underscore header styling
        }
        // Check if we need to remove the bold markup
        var cur = self.cm_editor.getCursor(true),
            line = self.cm_editor.getLine(cur.line),
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

        self.cm_editor.setLine(cur.line, new_line);
        self.cm_editor.setCursor(cur.line, cur.ch + cur_shift);
        self.cm_editor.focus();
    };

    // Unordered List
    this.unordered_list = function() {
        if (self.cm_editor.somethingSelected()) {
            //cm_editor.indentSelection("prev");
            var lines = CodeMirror.splitLines(self.cm_editor.getSelection());
            for (var i=0; i<lines.length; i++) {
                if (lines[i]) {
                    if (/^\s*[*\-+]\s+/.test(lines[i]))
                        lines[i] = lines[i].replace(/^(\s*)([*\-+]\s+)(.*)$/,"$1$3");
                    else if (/^\s*[0-9]+\.\s+/.test(lines[i]))
                        lines[i] = lines[i].replace(/^(\s*)([0-9]+\.\s+)(.*)$/,"$1"+self.list_character+" $3");
                    else
                        lines[i] = lines[i].replace(/^(\s*)(.*)$/,"$1"+self.list_character+" $2");
                }
            }
            self.cm_editor.replaceSelection(lines.join("\n"));
        } else {
            var cur = self.cm_editor.getCursor(true);
            var line = self.cm_editor.getLine(cur.line);
            if (!line)
                self.cm_editor.setLine(cur.line, self.list_character + ' ');
            else
                self.cm_editor.setLine(cur.line, line + '\n' + self.list_character + ' ');
        }
    };

    // Ordered List
    this.ordered_list = function() {
        if (self.cm_editor.somethingSelected()) {
            var lines = CodeMirror.splitLines(self.cm_editor.getSelection());
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
            self.cm_editor.replaceSelection(lines.join("\n"));
        } else {
            var cur = self.cm_editor.getCursor(true);
            var line = self.cm_editor.getLine(cur.line);
            if (!line)
                self.cm_editor.setLine(cur.line, "1. ");
            else
                self.cm_editor.setLine(cur.line, line + "\n1. ");
        }
    };

    // Blockquote
    this.blockquote = function() {
        if (self.cm_editor.somethingSelected()) {
            //self.cm_editor.indentSelection("prev");
            var lines = CodeMirror.splitLines(self.cm_editor.getSelection());
            for (var i=0; i<lines.length; i++) {
                if (lines[i]) {
                    if (/^\s*>\s+/.test(lines[i]))
                        lines[i] = lines[i].replace(/^(\s*)(>\s+)(.*)$/,"$1$3");
                    else
                        lines[i] = lines[i].replace(/^(\s*)(.*)$/,"$1"+'>'+" $2");
                }
            }
            self.cm_editor.replaceSelection(lines.join("\n"));
        } else {
            var cur = self.cm_editor.getCursor(true);
            var line = self.cm_editor.getLine(cur.line);
            if (!line)
                self.cm_editor.setLine(cur.line, '> ');
            else
                self.cm_editor.setLine(cur.line, line + '\n> ');
        }
    };

    this.divider_hr = function() {
        var sel='';
        if (self.cm_editor.somethingSelected()) {
            // Insert divider BEFORE selection
            sel = self.cm_editor.getSelection();
        }
        self.cm_editor.replaceSelection('\n***\n\n'+sel);
        var end_pos = self.cm_editor.getCursor(false);
        self.cm_editor.setSelection(end_pos, end_pos);
        self.cm_editor.focus();
    };

    // Image URL
    this.insert_image_url = function() {
        self.smart_insert_url(1);
    };
    // URL
    this.insert_url = function() {
        self.smart_insert_url(0);
    };
    // Image or URL
    // is_img should be 1 or 0 (NOT true or false !)
    this.smart_insert_url = function(is_img) {
        // Default is to place cursor inside curly brackets
        // (the url itself)
        var sel = "", step=3+is_img;
        if (self.cm_editor.somethingSelected()) {
            // Replace selection and place cursor in
            // square brackets (image description)
            sel = self.cm_editor.getSelection();
            step = 1+is_img;
        }
        var img_char = is_img ? '!': '';
        self.cm_editor.replaceSelection(img_char+'[]('+sel+')');
        var pos = self.cm_editor.getCursor(true);
        self.cm_editor.setCursor( pos.line, pos.ch+step);
        self.cm_editor.focus();
    };

    // Tab - insert tab, or move selection
    this.tab = function() {
        if (self.cm_editor.somethingSelected()) {
            CodeMirror.commands.indentMore(self.cm_editor);
        } else {
            var cur = self.cm_editor.getCursor();
            var line = self.cm_editor.getLine(cur.line);
            var pad_str = self.tab_character;
            if (cur.ch) {
                // Calculate pos in line with respect to tab characters
                var ins_pos = 0;
                for (var i=0; i < cur.ch; i++)
                    if (line[i] === '\t') ins_pos += self.tab_spaces.length;
                    else ins_pos++;
                var pad_spaces = self.tab_spaces.length - (ins_pos % self.tab_spaces.length);
                if (pad_spaces != self.tab_spaces.length)
                    pad_str = self.tab_spaces.substr(0, pad_spaces);
            }
            var new_line = line.substring(0, cur.ch)+pad_str+line.substring(cur.ch);
            self.cm_editor.setLine(cur.line, new_line);
            self.cm_editor.setCursor(cur.line, cur.ch+pad_str.length);
        }
        self.cm_editor.focus();
    };

    // Shift-Tab - shift back selection or line
    this.shift_tab = function() {
        CodeMirror.commands.indentLess(self.cm_editor);
    };

    // Custom new line handling - smart list indents
    this.custom_new_line = function() {
        CodeMirror.commands.newlineAndIndent(self.cm_editor);
        // Handle lists
        var cur = self.cm_editor.getCursor();
        var prev_indented = self.cm_editor.getLine(cur.line-1).substr(cur.ch);
        // Unordered lists and blockquotes
        if (/^[*\-+>]\s+/.test(prev_indented)) {
            // See if we have an empty list bullet or blockquote tag
            // Also make sure that new line text is empty
            if (/^[*\-+>] $/.test(prev_indented) &&
                self.cm_editor.getLine(cur.line).length === 0) {
                // In such case we consider self to be the end of
                // a list or blockquote and remove the last tag
                self.cm_editor.setCursor(cur.line-1, 0);
                //CodeMirror.commands.killLine(self.cm_editor);
                self.cm_editor.removeLine(cur.line);
            } else {
                self.cm_editor.replaceSelection(prev_indented[0]+" ", "end");
            }
        } else {
            // Ordered lists
            if (/^[0-9]+\.\s+/.test(prev_indented)) {
                var prev_num = prev_indented.match(/^[0-9]+/);
                if (/^[0-9]+\. $/.test(prev_indented)) {
                    self.cm_editor.setCursor(cur.line-1, 0);
                    //CodeMirror.commands.killLine(self.cm_editor);
                    self.cm_editor.removeLine(cur.line);
                } else {
                    self.cm_editor.replaceSelection((parseInt(prev_num, 10)+1)+". ", "end");
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

    //
    // Scroll preview-container to corresponding anchor
    //
    this.scroll_to_anchor = function() {
        var line_num = self.cm_editor.getCursor(true).line+1;
        if (self.cur_line !== line_num) {
            self.cur_line = line_num;
            var i,
                anchor_num=0,
                prev_anchor_num=0,
                next=0,
                ratio=0,
                preview_offset,
                aTag=null;
            if (!self.aTags.size())
                return;
            preview_offset = self.aTags.first().position().top;
            // Find anchor, corresponding to line_num
            for (i=0; i < self.aTags.size(); i++) {
                anchor_num = parseInt(self.aTags.get(i).name, 10);
                if (anchor_num === line_num) {
                    break;
                }
                if (anchor_num > line_num){
                    if (i > 0) {
                        // Scroll in between the two anchors
                        ratio = (line_num-prev_anchor_num)/(anchor_num-prev_anchor_num);
                        preview_offset -= Math.abs(self.aTags.slice(i).position().top -
                            self.aTags.slice(i-1).position().top) * ratio;
                        --i;
                    }
                    break;
                }
                prev_anchor_num = anchor_num;
            }
            // The anchor to scroll to
            // If we're at the last tag - adjust to it
            if (i === self.aTags.size()) --i;
            aTag = self.aTags.slice(i);
            if (aTag !== null && aTag.length) {
                var new_pos;
                new_pos = Math.max(0,
                        Math.abs(aTag.position().top-preview_offset) - 20);
                if (new_pos !== self.preview_pos) {
                    self.preview_pos = new_pos;
                    self.dom_preview_body.scrollTop(new_pos);
                }
            }
        }
    };

    //
    // Text in CodeMirror changed
    //
    // This function will be called VERY OFTEN !
    this.on_change = function(inst, change_obj) {
        console.log(self.saved_state);
        if (self.saved_state === 2) {
            self.set_saved_state("NOT SAVED");
        }
        // Update preview on timer (no need for preview when in fullscreen)
        if (!self.is_codemirror_fullscreen && !self.is_preview_timer) {
            self.is_preview_timer = true;
            setTimeout(function() {
                // Generate preview
                self.dom_preview_body.html(marked(self.cm_editor.getValue()));
                // Get anchors from generated preview
                self.aTags = self.dom_preview_body.find("a.marked-anchor");
                self.scroll_to_anchor();
                self.is_preview_timer = false;
            }, 100);
        }
    };

    // SAVE state helpers: changes state while saving
    this.set_saved_state = function(saved) {
        if (saved === "SAVED") {
            this.saved_state = 2;
            this.is_saved = true;
            this.dom_save_btn_text.text("SAVED");
            this.dom_save_btn.removeClass("btn-success").tooltip("hide").attr('disabled', 'disabled');
        } else if (saved === "SAVING") {
            this.saved_state = 1;
            this.is_saved = false;
            this.dom_save_btn_text.text("saving...");
            this.dom_save_btn.removeClass("btn-success").attr('disabled', 'disabled');
        } else { // "NOT SAVED"
            this.saved_state = 0;
            this.is_saved = false;
            this.dom_save_btn_text.text("Save");
            this.dom_save_btn.addClass("btn-success").removeAttr('disabled');
        }
    };

    // TODO: Use this to open clicked urls (Ctrl-Click)
    this.on_cursor_activity = function(inst) {
        // console.log("cursor");
        self.cm_editor.matchHighlight("CodeMirror-matchhighlight");
        self.scroll_to_anchor();
    };

    // TODO: bind Alt-M to set/remove markers on gutter
    // TODO: and Alt-Shift-M to jump over markers
    this.on_gutter_clicked = function(inst, n) {
        var info = self.cm_editor.lineInfo(n);
        if (info.markerText)
            self.cm_editor.clearMarker(n);
        else
            self.cm_editor.setMarker(n, "<span style=\"color: #add8e6;\">&gt;</span> %N%");
    };

    // SAVE BUTTON and Ctrl-S:
    // Save codemirror's contents and launch callback when done
    // callback parameter will be true if saved ok and false if not
    this.save_codemirror = function() {
        if (self.saved_state !== 0)
            return;
        self.set_saved_state("SAVING");
        // TODO: show spinning wheel in tab
        self.dom_elem.find(".file-saving").show();
        edtrTree.show_loading_node(self.node, true);
        serverComm.action("dropbox", "save_file",
            {
                path: self.node.id,
                content: self.cm_editor.getValue()
            }, function(status) {
                self.dom_elem.find(".file-saving").hide();
                edtrTree.show_loading_node(self.node, false);
                if (status > serverComm.max_success_status) {
                    // Serious error
                    self.set_saved_state("NOT SAVED");
                    if (status === 6)
                        messagesBar.show_notification_warning(serverComm.human_status[status]);
                    else
                        messagesBar.show_error(serverComm.human_status[status]);
                    if (self.on_saved)
                        self.on_saved.call(this, false);
                } else {
                    self.set_saved_state("SAVED");
                    messagesBar.show_notification("Saved "+self.node.id);
                    if (self.on_saved)
                        self.on_saved.call(this, true);
                }
            });
    };

    // Add new tab with given content
    this.add_tab                = function(tree_node, content_type, content) {
        if (content_type !== "markdown") {
            messagesBar.show_error("ERROR: content "+content_type+" is not supported");
            return false;
        }
        
        // If content_type changed it means that home-tree has replaced
        // editor's HTML and preview-container
        // TODO: do we need to remove previous codemirror's bindings ?
        //if (self.content_type !== content_type) {

        // TODO: node should be part of the tabs array
        this.node           = tree_node;
        this.content_type   = content_type;
        this.cm_editor.setValue(content);
        this.cm_editor.focus();

        this.set_saved_state("SAVED");
        if (this.preview_timer_id)
            clearTimeout(this.preview_timer_id);
    };

    this.init                   = function(dom_container, dom_preview) {
        //
        // INITIALIZATION (constructor)
        //
        this.is_codemirror_fullscreen   = false;
        this.is_hidden                  = false;
        this.is_preview_timer           = false;
        this.preview_timer_id           = null;
        // TODO: Get those from folder/general settings
        this.tab_character              = "\t";
        this.tab_spaces                 = Array(4).join(" "); // should equal to tab_character
        this.list_character             = "-";
        
        // Cache dom elements
        this.dom_elem           = dom_container;
        this.dom_textarea       = dom_container.find(".cme-textarea");
        this.dom_save_btn       = this.dom_elem.find('#btn_save');
        this.dom_save_btn_text  = this.dom_elem.find('#btn_save_text');
        // Preview iframe
        this.dom_preview        = dom_preview;
        // We use contents() to search within iframe
        this.dom_preview_body   = this.dom_preview.contents().find('body');
        this.dom_preview_head   = this.dom_preview.contents().find('head');

        /* Allows last line to be positioned above the bottom */
        this.dom_preview_body.css("margin-bottom", "90px");
        // TODO: load this from settings
        this.dom_preview_head.
            append("<link rel=\"stylesheet\" href=\"/static/css/md_preview/github.css?reload=" +
                (new Date()).getTime() + "\">");


        // TODO: get those from general settings
        var cm_settings = {
            // TODO: all settings should accord to content_type
            mode:               "gfm",
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
                                        // make it work in gfm mode as well

            // TODO: find Mac equivalents
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

        this.cm_editor = CodeMirror.fromTextArea(this.dom_textarea[0], cm_settings);

        // .ON events
        this.cm_editor.on("change", this.on_change);
        this.cm_editor.on("cursorActivity", this.on_cursor_activity);
        // onGutterClick:      this.on_gutter_clicked,

        // Hides original text area, just in case
        // this.dom_elem.hide();

        // Set default options for marked
        marked.setOptions({
          gfm:              true,
          tables:           false,
          breaks:           true,
          pedantic:         false,
          sanitize:         false
        });

        //
        // Toolbar handlers
        //
        this.dom_elem.find('#tbb_header').on("click", this.rotate_header);
        this.dom_elem.find('#tbb_bold').on("click", this.toggle_bold);
        this.dom_elem.find('#tbb_italic').on("click", this.toggle_italic);
        this.dom_elem.find('#tbb_code').on("click", this.toggle_code);
        // --
        this.dom_elem.find('#tbb_ulist').on("click", this.unordered_list);
        this.dom_elem.find('#tbb_olist').on("click", this.ordered_list);
        this.dom_elem.find('#tbb_quote').on("click", this.blockquote);
        // --
        this.dom_elem.find('#tbb_divider').on("click", this.divider_hr);
        // --
        this.dom_elem.find('#tbb_image_url').on("click", this.insert_image_url);
        this.dom_elem.find('#tbb_url').on("click", this.insert_url);
        // ----
        this.dom_elem.find('#tbb_width').on("click", this.toggle_width);
        this.dom_elem.find('#tbb_fullscreen').on("click", this.toggle_fullscreen);

        // Buttons
        this.dom_elem.find('#btn_preview').on("click", this.preview_codemirror);
        this.dom_elem.find('#btn_save').on("click", this.save_codemirror);

        // TOOLTIPS for toolbar
        this.dom_elem.find(".cme-toolbar-tooltip").tooltip({ placement: "top", html: true, delay: { show: 1000, hide: 300 } });
        // And buttons
        this.dom_elem.find(".cme-button-tooltip").tooltip({ placement: "bottom", delay: { show: 800, hide: 300 } });

        this.set_saved_state("SAVED");

        return this;
    };

    // store pointer to ourselves to be able
    // to access object from callbacks
    var self=this;
    return this;
}

//var toggle_left = "&lt;&lt;";
//var toggle_right = "&gt;&gt;";
