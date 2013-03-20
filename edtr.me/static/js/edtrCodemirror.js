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

    // this.hide_codemirror = function() {
    //     self.is_hidden = true;
    //     self.set_tab_state("SAVED");
    //     //$('#cme_wide_toggle').html("&nbsp;");
    //     edtrSplitters.hide_editor();
    //     self.dom_elem.show().attr("disabled", "true");
    // };

    // Change toolbar button to reflect left sidebar (lsb) state
    this._update_toolbar_width_button = function() {
        if (edtrSplitters.lsb_is_visible) {
            self.dom_toolbar.find(".edtr-toolbar-img-left").show();
            self.dom_toolbar.find(".edtr-toolbar-img-right").hide();
            self._update_toolbar_fullscreen_button();
        } else {
            self.dom_toolbar.find(".edtr-toolbar-img-left").hide();
            self.dom_toolbar.find(".edtr-toolbar-img-right").show();
            self._update_toolbar_fullscreen_button();
        }
    };

    this.toggle_width = function() {
        edtrSplitters.toggle_sidebar();
        // HACK: have to call refresh twice, because codemirror throws error
        self.cm_editor.refresh();
        setTimeout(self.cm_editor.refresh, 500);
    };

    // Change toolbar button to reflect preview state
    this._update_toolbar_height_button = function() {
        if (edtrSplitters.preview_is_visible) {
            self.dom_toolbar.find(".edtr-toolbar-img-down").show();
            self.dom_toolbar.find(".edtr-toolbar-img-up").hide();
            self._update_toolbar_fullscreen_button();
        } else {
            self.dom_toolbar.find(".edtr-toolbar-img-down").hide();
            self.dom_toolbar.find(".edtr-toolbar-img-up").show();
            self._update_toolbar_fullscreen_button();
        }
    };
    this.toggle_height = function() {
        edtrSplitters.toggle_preview();
        // HACK: have to call refresh twice, because codemirror throws error
        self.cm_editor.refresh();
        setTimeout(self.cm_editor.refresh, 500);
    };

    // Change toolbar button to reflect fullscreen state
    this._update_toolbar_fullscreen_button = function() {
        if (edtrSplitters.lsb_is_visible || edtrSplitters.preview_is_visible) {
            self.dom_toolbar.find(".edtr-toolbar-img-out").show();
            self.dom_toolbar.find(".edtr-toolbar-img-in").hide();
        } else {
            self.dom_toolbar.find(".edtr-toolbar-img-out").hide();
            self.dom_toolbar.find(".edtr-toolbar-img-in").show();
        }
    };
    this.toggle_fullscreen = function() {
        // requestFullScreen is really nice but it blocks too many keys (shortcuts, Esc, etc..)
        // requestFullScreen(document.body);
        if (edtrSplitters.lsb_is_visible || edtrSplitters.preview_is_visible) {
            edtrSplitters.hide_sidebar();
            edtrSplitters.hide_preview();
        } else {
            edtrSplitters.show_sidebar();
            edtrSplitters.show_preview();
        }
        // HACK: have to call refresh twice, because codemirror throws error
        self.cm_editor.refresh();
        setTimeout(self.cm_editor.refresh, 500);
    };

    //
    // Insert tree node as link into the document
    // Depending on node type, we insert it as url or image
    //
    this.insert_node = function(node, node_type) {
        // TODO: Calculate node's relative path
        // we must know the root dir for current file (defined in folder settings)
        // right now '/' is the default root for all files, but as dirs become
        // sites, we need to pass this new root to editor
        var root_path = "/",
            rel_path = edtrHelper.get_relative_to_root(root_path, node.id);
            alt_text = edtrHelper.get_filename_bare(node.name);
        if (!rel_path) {
            messagesBar.show_notification_warning(node.id+" is not part of "+root_path);
            return false;
        }
        switch (node_type) {
            case "markdown":
                // Change extension to html
                var bare = edtrHelper.get_filename_bare(rel_path);
                self.smart_insert_url(0, bare+".html", alt_text);
                break;
            case "html":
                self.smart_insert_url(0, rel_path, alt_text);
                break;
            case "image":
                self.smart_insert_url(1, rel_path, alt_text);
                break;
            case "javascript":
                var text = '<script src="'+rel_path+'"></script>';
                self.cm_editor.replaceSelection(text);
                self.cm_editor.focus();
                break;
            default:
                messagesBar.show_notification_warning("Unsupported type: "+node_type);
                break;
        }
        return true;
    };

    //
    // TOOLBAR
    //

    // Bold, Italic and Code toolbar icons
    // TODO: bold and italic should be set via settings
    this.toggle_bold = function() { self.toggle_markup("**"); };
    this.toggle_italic = function() { self.toggle_markup("_"); };
    this.toggle_code = function() {
        // If selection spans one or more lines, apply code block markup
        if (self.cm_editor.somethingSelected() &&
            CodeMirror.splitLines(self.cm_editor.getSelection()).length > 1)
            self.toggle_code_block();
        else
            self.toggle_markup("`");
    };
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

    // We get here if something is selected and selection spans one or more lines
    this.toggle_code_block = function() {
        var sel = self.cm_editor.getSelection(),
            cb_markup = "~~~";
        if (sel.startsWith(cb_markup)) {
            // Remove codeblock markup
            var lines = CodeMirror.splitLines(sel);
            lines.splice(0, 1);
            // Sanity check - see if we have ending markup
            if (lines[lines.length-2] === cb_markup)
                lines.splice(lines.length-2, 1);
            self.cm_editor.replaceSelection(lines.join("\n"));
        } else {
            // Apply codeblock markup
            // Note: we expect sel to ALWAYS end with new line
            // (that's how Codemirror works now at least)
            self.cm_editor.replaceSelection(cb_markup+"\n"+sel+cb_markup+"\n");
        }
    };

    // Rotate Header
    this.rotate_header = function() {
        if (self.cm_editor.somethingSelected()) {
            // TODO: Idea: when smth is selected, use underscore header styling
        }
        var cur = self.cm_editor.getCursor(true),
            line = self.cm_editor.getLine(cur.line),
            max_header = "######",
            new_header = "",
            space_after_left_header = "",
            cur_shift;
        // Calculate current header size
        for (var i=0; i < max_header.length+1; i++)
            if (line[i] !== '#') break;
        if (i < max_header.length) {
            // Increasing header markup
            new_header = max_header.substr(0, i+1);
            // Shift cursor right
            cur_shift = 1;
        } else {
            // Removing header markup, shift cursor left
            cur_shift = -max_header.length;
        }
        // Cut old header
        var new_line = line.substr(i);
        if (new_header.length) {
            // Add space after header markup
            if (new_line[0] != ' ' && new_line[0] != '\t') {
                new_header += ' ';
                cur_shift++;
            }
            new_header += new_line;
        }
        else {
            // Header was removed, also remove previously appended space
            new_header += new_line.substr(1);
            cur_shift--;
        }
        self.cm_editor.setLine(cur.line, new_header);
        self.cm_editor.setCursor(cur.line, cur.ch + cur_shift);
        self.cm_editor.focus();
    };

    // Unordered List
    this.unordered_list = function() {
        if (self.cm_editor.somethingSelected()) {
            //cm_editor.indentSelection("prev");
            var lines = CodeMirror.splitLines(self.cm_editor.getSelection());
            for (var i=0; i <lines.length; i++) {
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
            for (var i=0; i <lines.length; i++) {
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
            for (var i=0; i < lines.length; i++) {
                if (lines[i]) {
                    if (/^\s*>\s+/.test(lines[i]))
                        lines[i] = lines[i].replace(/^(\s*)(> )(.*)$/,"$1$3");
                    else
                        lines[i] = "> " + lines[i];
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

    // Insert image URL
    this.insert_image_url = function() {
        self.smart_insert_url(1);
    };
    // Insert URL
    this.insert_url = function() {
        self.smart_insert_url(0);
    };
    // Insert image URL or URL
    // is_img should be 1 or 0 (NOT true or false !)
    this.smart_insert_url = function(is_img, url, alt_text) {
        // step adjusts the cursor position after replaceSelection()
        // Default is to place cursor inside curly brackets (the url itself)
        // but if url was passed, we set cursor to the end of selection
        var sel = "", step=3+is_img;
        if (typeof url === "undefined")
            url = "";
        else
            step += url.length+1;
        if (self.cm_editor.somethingSelected()) {
            // Replace selection and place cursor in
            // square brackets (image description)
            alt_text = self.cm_editor.getSelection();
        } else {
            if (typeof alt_text === "undefined")
                alt_text = is_img === 1 ? 'image': 'link';
        }
        var img_char = is_img === 1 ? '!': '';
        self.cm_editor.replaceSelection(img_char+'['+alt_text+']('+url+')');
        var pos = self.cm_editor.getCursor(true);
        self.cm_editor.setCursor( pos.line, pos.ch+alt_text.length+step);
        self.cm_editor.focus();
    };

    // Tab - insert tab, or move selection
    this.tab = function() {
        if (self.cm_editor.somethingSelected()) {
            CodeMirror.commands.indentMore(self.cm_editor);
        } else {
            var cur = self.cm_editor.getCursor();
            var line = self.cm_editor.getLine(cur.line);
            var pad_str = edtrSettings.general.editor.indent_with_tabs() ?
                self.tab_character : self.tab_spaces;
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
                CodeMirror.commands.killLine(self.cm_editor);
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
                    CodeMirror.commands.killLine(self.cm_editor);
                    self.cm_editor.removeLine(cur.line);
                } else {
                    self.cm_editor.replaceSelection((parseInt(prev_num, 10)+1)+". ", "end");
                }
            }
        }
    };

    //  function edtr_search_mode (query) {
    //     if (typeof query == "string") {
    //         return { token: function (stream) {
    //             if (stream.match(query)) return "cme-search-selection";
    //             stream.next();
    //             if (!stream.skipTo(query.charAt(0)))
    //                 stream.skipToEnd();
    //             }};
    //     } else {
    //         return { token: function (stream) {
    //             if (stream.match(query)) return "cme-search-selection";
    //             while (!stream.eol()) {
    //                 stream.next();
    //                 if (stream.match(query, false)) break;
    //             }
    //         }};
    //     }
    // }

    // Show find dialog (over the save/preview/publish buttons)
    this.show_find = function(cm) {
        // Hide all buttons and show search input field
        self.dom_buttonbar.find(".cme-buttons").hide();
        self.dom_buttonbar.find(".cme-search").show();
        // Focus and select text in input fields
        self.bb_state = self.BB_STATES.SEARCH;
        // if (self.search_state)
        //     self.cm_editor.removeOverlay(self.search_state.overlay);
        // If text is selected - use it for search
        if (self.cm_editor.somethingSelected())
            self.dom_search_input.val(self.cm_editor.getSelection());
        self.dom_search_input.focus().select();
        self.search_state = {
            query:              self.dom_search_input.val(),
            igore_case:         true,
            wrap:               false,
            posFrom:            self.cm_editor.getCursor("end"),
            posTo:              self.cm_editor.getCursor("end"),
            kc_posFrom:         self.cm_editor.getCursor("end"),
            kc_posTo:           self.cm_editor.getCursor("end"),
            keeping_cursor:     true,   // true when searching without moving cursor
            visible:            true,   // true when search dialog is visible
            first_time:         true    // HACK: used to ignore first search_update_query()
                                        // which is called when search input is shown
        };
        // debugger;
        // self.search_state.overlay = edtr_search_mode(self.search_state.query);
        // self.cm_editor.addOverlay(self.search_state.overlay);//, {opaque: "cme-search-selection"});
    };

    // Show replace dialog (over the save/preview/publish buttons)
    this.show_replace = function(cm) {
        // Show find dom elements and initialize search_state
        self.show_find();
        // And replace dom elements near it
        self.dom_buttonbar.find(".cme-replace").show();
        // Increase buttonbar size and decrease editor size accordingly
        var row_height = self.dom_buttonbar.find("tr").height() + 4;
        self.dom_buttonbar.height(self.dom_buttonbar.height()+row_height);
        self.dom_editor.css({bottom: self.dom_buttonbar.height()+2}); // see style.css
        self.bb_state = self.BB_STATES.REPLACE;
    };

    // Leave various modes (search, replace)
    this.process_esc = function() {
        if (self.bb_state === self.BB_STATES.SEARCH ||
            self.bb_state === self.BB_STATES.REPLACE) {
            // Restore buttonbar and editor size accordingly
            if (self.bb_state === self.BB_STATES.REPLACE) {
                var row_height = self.dom_buttonbar.find("tr").height() + 4;
                self.dom_buttonbar.height(self.dom_buttonbar.height()-row_height);
                self.dom_editor.css({bottom: self.dom_buttonbar.height()+2}); // see style.css
                self.dom_buttonbar.find(".cme-replace").hide();
            }
            // Hide search input field and show buttons
            self.search_state.visible = false;
            self.dom_buttonbar.find(".cme-search").hide();
            self.dom_buttonbar.find(".cme-buttons").show();
            self.bb_state = self.BB_STATES.BUTTONS;
            // if (self.search_state) {
            //     self.cm_editor.removeOverlay(self.search_state.overlay);
            //     self.search_state = null;
            // }
        }
        self.focus();
    };

    //
    // UI methods
    //
    // Toggle case sensitivity
    this.search_toggle_case = function(elem) {
        // IMPORTANT: when "active" class is NOT present - button is pushed down
        if (self.search_state) {
            self.search_state.igore_case = ($(elem).hasClass("active"));
            self.search_find(false, true);
        }
    };
    // Toggle search wrapping
    this.search_toggle_wrap = function(elem) {
        // IMPORTANT: when "active" class is NOT present - button is pushed down
        if (self.search_state) {
            self.search_state.wrap = ! ($(elem).hasClass("active"));
            self.search_find(false, true);
        }
    };
    // Find next match
    this.search_find_next = function(elem) {
        if (self.search_state) {
            self.search_find(false, false);
            self.dom_search_input.focus();
        }
    };
    // Find previous match
    this.search_find_previous = function(elem) {
        if (self.search_state) {
            self.search_find(true, false);
            self.dom_search_input.focus();
        }
    };
    // Replace active selection
    this.search_replace = function(elem) {
        if (self.search_state && self.cm_editor.somethingSelected()) {
            self.cm_editor.replaceSelection(self.dom_replace_input.val());
            self.dom_search_input.focus();
        }
    };

    // Find text in codemirror
    // Called from search input on.keyup
    this.search_update_query = function() {
        // First time here (search dialog was just shown)
        if (self.search_state.first_time) {
            self.search_state.first_time = false;
        } else {
            self.search_state.query = self.dom_search_input.val();
            // self.search_state.keeping_cursor = true;
            self.search_find(false, true);
        }
    };

    // Find next or previous occurrence of query
    // Called from search input on.keydown:
    //      Up:         reverse = true
    //      Enter/Down: reverse = false
    //  If keep_cursor is true - search_state.pos is NOT updated
    this.search_find = function(reverse, keep_cursor) {
        // console.log(self.search_state.query);
        function getSearchCursor(cm, query, pos) {
            // Heuristic: if the query string is all lowercase, do a case insensitive search.
            // return self.cm_editor.getSearchCursor(query, pos, typeof query == "string" && query == query.toLowerCase());
            return self.cm_editor.getSearchCursor(query, pos, typeof query == "string" && self.search_state.igore_case);
        }
        function parseQuery(query) {
            var isRE = query.match(/^\/(.*)\/([a-z]*)$/);
            return isRE ? new RegExp(isRE[1], isRE[2].indexOf("i") == -1 ? "" : "i") : query;
        }
        var query = parseQuery(self.search_state.query);
        self.cm_editor.operation(function() {
            // Stop keeping cursor, we start from beginning or end of match, depending on direction
            if (!keep_cursor && self.search_state.keeping_cursor === true) {
                if (reverse)
                    self.search_state.posTo = self.search_state.posFrom = self.search_state.kc_posFrom;
                else
                    self.search_state.posTo = self.search_state.posFrom = self.search_state.kc_posTo;
            }
            // Update keeping cursor state
            self.search_state.keeping_cursor = keep_cursor;
            // If we're keeping cursor - first clear selection
            if (keep_cursor)
                self.cm_editor.setCursor(self.search_state.kc_posFrom);
            var cursor = getSearchCursor(self.cm_editor, query,
                    reverse ? self.search_state.posFrom : self.search_state.posTo);
            // If not found - wrap around
            if (!cursor.find(reverse)) {
                if (!self.search_state.wrap)
                    return;
                cursor = getSearchCursor(self.cm_editor, query,
                    reverse ?   CodeMirror.Pos(self.cm_editor.lastLine()) :
                                CodeMirror.Pos(self.cm_editor.firstLine(), 0));
                if (!cursor.find(reverse)) {
                    return;
                }
            }
            // Highlight match
            self.cm_editor.setSelection(cursor.from(), cursor.to());
            // Update search state
            if (!keep_cursor) {
                self.search_state.posFrom   = cursor.from();
                self.search_state.posTo     = cursor.to();
            } else {
                self.search_state.kc_posFrom   = cursor.from();
                self.search_state.kc_posTo     = cursor.to();
            }
        });
    };

    //
    // EDITOR BUTTONS
    //
    // PREVIEW BUTTON: Preview HTML
    this.preview_codemirror = function() {
        console.log($.cookie('mdb_preview_url'));
        window.open($.cookie('mdb_preview_url')+
            "?reload="+(new Date()).getTime(), '');
        //return false;
    };

    //
    // Scroll preview-container to corresponding anchor
    // if force is true - scrolling is forced even if we are on the same line
    // this helps restoring preview position after changing stylesheets
    //
    this.scroll_to_anchor = function(force) {
        // getCursor lines start from 0, while aTags ids start from 1
        var line_num = self.cm_editor.getCursor(true).line+1-self.tabs[self.current_tab].metadata.lines;
        //console.log(line_num);
        if (line_num > 0 &&
            (line_num !== self.cur_line || force)) {
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
                        Math.abs(aTag.position().top-preview_offset) - 90);
                if (new_pos !== self.preview_pos || force) {
                    self.preview_pos = new_pos;
                    self.dom_preview_body.scrollTop(new_pos);
                }
            }
        }
    };

    this.update_live_preview = function(force_scroll) {
        // Update preview on timer (only when preview is visible)
        if (edtrSplitters.preview_is_visible && !self.is_preview_timer) {
            self.is_preview_timer = true;
            this.preview_timer_id = setTimeout(function() {
                self.is_preview_timer = false;
                // Parse metadata
                self.parse_tab_metadata(self.current_tab);
                // Generate preview
                self.dom_preview_body.html(marked(self.tabs[self.current_tab].metadata.content));
                // self.dom_preview_body.html(self.showdown.makeHtml(self.tabs[self.current_tab].metadata.content));
                // Get anchors from generated preview
                self.aTags = self.dom_preview_body.find("a.marked-anchor");
                self.scroll_to_anchor(force_scroll);
            }, 100);
        }
    },


    // Select correct theme based on available metadata and general settings
    // type === "theme":        get preview theme
    // type === "theme_code":   get preview code theme
    this._get_theme = function(type) {
        var theme = edtrSettings.general.preview[type](),
            fix_path = true,
            cur_tab = self.tabs[self.current_tab],
            meta_key = type === "theme" ? "style" : "codestyle";
        // Metadata style has precedence over general settings
        if (cur_tab.metadata && cur_tab.metadata.data[meta_key]) {
            var user_theme = cur_tab.metadata.data[meta_key].toLowerCase();
            if (user_theme.endsWith(".css")) {
                // TODO: append real user preview path to .css file
                var user_path = edtrHelper.get_filename_path(cur_tab.node.id);
                if (user_path === '/') user_path = "";
                theme = "http://preview.user.edtr.me/"+user_path+"/"+user_theme;
                fix_path = false;
            } else {
                // If theme is one of the preset ones - use it, otherwise we fallback to
                // theme set in general settings
                if ($.inArray(user_theme, edtrSettings.general.preview[type+"_list"]()) !== -1)
                    theme = user_theme;
            }
        }
        if (fix_path)
            theme = "/static/css/preview_"+type+"/" + theme + ".css";

        return theme;
    },

    // Update head element in preview iframe with correct stylesheets
    this.update_preview_theme   = function() {
        // Compile template for preview head element (do it only once)
        if (!self.preview_head_template) {
            self.preview_head_template = _.template($("#preview_head_template").html());
        }

        // Don't do anything if we have no opened tabs
        if (!self.tabs.length) return;

        // Cancel previous preview timer
        if (self.is_preview_timer) {
            self.is_preview_timer = false;
            clearTimeout(self.preview_timer_id);
        }

        // Update stylesheet in preview iframe
        self.dom_preview_head.html(self.preview_head_template({
            theme_url:          self._get_theme("theme"),
            theme_code_url:     self._get_theme("theme_code"),
            reload_hash:        (new Date()).getTime(),
            script_start:       '<script type="text/javascript">',
            script_end:         '</script>'
        }));

        self.update_live_preview(true);
    };

    //
    // Text in CodeMirror changed
    //
    // This function will be called VERY OFTEN !
    this.on_change = function(inst, change_obj) {
        // console.log(self.saved_state);
        if (self.tabs[self.current_tab].state === self.TAB_STATES.SAVED) {
            self.set_tab_state(self.TAB_STATES.NOT_SAVED);
        }
        // Metadata will also be parsed in update_live_preview() on timer,
        // to optimize number of calls to it
        self.update_live_preview(false);
    };

    // Parse metadata in provided text (string)
    //
    // returns object with:
    //      status:     true - success, false - error in metadata
    //      lines:      # of lines in metadata
    //      content:    content without metadata text AND without the new line after it
    //      text:       metadata text WITH the new line at the end
    //      data:       { key: value, ... } array of metadata
    //
    this.parse_metadata = function(text) {
        var i = 0, eol,
            line, j, key, val,
            status = true, lines = 0, content = text, data = {};
        while (i < text.length) {
            // Get next line
            eol = text.indexOf("\n", i);
            if (eol === -1) eol = text.length;
            line = text.substr(i, eol-i);
            // Last line of metadata - new line
            if (!line.length) {
                i++;
                lines++;
                break;
            }
            // Line with no text - consider it an empty line
            if (line.match(/^\s*$/)) {
                i = eol + 1;
                break;
            }
            // See if metadata is in correct format
            if(!line.match(/^ *[a-zA-Z0-9_]+\s*:/)) {
                break;
            }
            // Find key:value
            j = line.indexOf(":");
            if (j === -1) {
                // TODO: should we discard ALL metadata and set content to text ?
                // (also set lines to 0)
                status = false;
                break;
            }
            // Add key/value pair to data
            key = text.substr(i, j).trim().toLowerCase().replace(/-/g, "_");
            data[key] = text.substr(i+j+1, eol-i-j-1).trim();
            // console.log(JSON.stringify(data));
            i = eol+1;
            lines++;
        }

        return {
            status:     status,
            lines:      lines,
            content:    text.substr(i),
            text:       text.substr(0, i),
            data:       data
        };
    };

    //
    // Parse metadata at the beginning of markdown file in specified tab
    // and update values in tab object
    //      index       tab index to parse metadata for
    //
    // TODO: optimize:  save all metadata as string and on each parse compare it to the text
    //                  and see if it has changed or text has more metadata after the match
    //
    this.parse_tab_metadata = function(index) {
        // Store old metadata to compare with new one
        var old_metadata = self.tabs[index].metadata;
        self.tabs[index].metadata = self.parse_metadata(self.tabs[index].doc.getValue());
        var data = self.tabs[index].metadata.data;

        // Some changes in metadata may require a preview update
        if (!old_metadata ||
            old_metadata.data.codestyle !== data.codestyle ||
            old_metadata.data.style !== data.style) {
            self.update_preview_theme();
        }
        // Some changes in metadata may require changing marked behavior
        // and preview update obviously
        if (data.header_anchors)
            this.marked_options.headerAnchors =
                _.map(data.header_anchors.split(","), function(el) { return parseInt(el, 10); });
        else
            this.marked_options.headerAnchors = null;
        marked.setOptions(this.marked_options);
        if (!old_metadata ||
            old_metadata.data.header_anchors !== data.header_anchors) {
            self.update_live_preview(false);
        }
    };

    // Show modal for convenient meta-data editing
    this.edit_tab_metadata = function() {
        var key, ko_meta, prefix="meta_",
            cur_tab = self.tabs[self.current_tab];

        // Clear file_meta (its a temp object)
        for (key in edtrSettings.file_meta) {
            if (key.startsWith(prefix))
                edtrSettings.file_meta[key]("");
        }
        // Copy parsed meta into view model
        for (key in cur_tab.metadata.data) {
            ko_meta = edtrSettings.file_meta[prefix+key];
            if (ko_meta)
                ko_meta(cur_tab.metadata.data[key]);
        }
        edtrSettings.file_meta_modal(cur_tab.node.id, function(args) {
            if (args.button === "ok") {
                // Update changed values in metadata text and add new key:value pairs
                // at the bottom
                var old_meta_lines = cur_tab.metadata.lines,
                    key, meta_key, pos, val_pos, text, append_space;

                // Remove empty line from bottom of metadata to be able to append to it
                pos = cur_tab.metadata.text.search(/\n\s*\n/gm);
                text = cur_tab.metadata.text.substr(0, pos);
                text += "\n";
                // Go through dialog keys
                for (key in edtrSettings.file_meta) {
                    if (key.startsWith(prefix)) {
                        // Search for key in metadata text
                        meta_key = key.replace(prefix, "");
                        rex = new RegExp("^ *"+meta_key+"\\s*:", "mi");
                        pos = text.search(rex);
                        append_space = " ";
                        // If not found - append it
                        if (pos < 0) {
                            // But only if its value is not empty
                            if (!edtrSettings.file_meta[key]().length)
                                continue;
                            meta_key = meta_key.replace(/_/g, ' ').capitalize().replace(/ /g, '_');
                            text += meta_key+":"+append_space+edtrSettings.file_meta[key]()+"\n";
                            cur_tab.metadata.lines++;
                        } else {
                            // Found - replace value skipping all the indentation
                            val_start = text.indexOf(":", pos) + 1;
                            val_start = text.regexIndexOf(/[^ \t]/, val_start);
                            if (text[val_start] !== "\n")
                                append_space = "";
                            val_end = text.indexOf("\n", val_start);
                            text = text.substr(0, val_start) +
                                append_space +
                                edtrSettings.file_meta[key]() +
                                text.substr(val_end);
                        }
                    }
                }
                cur_tab.metadata.text = text + "\n";
                cur_tab.doc.replaceRange(cur_tab.metadata.text,
                    {line: 0, ch: 0},
                    {line: old_meta_lines+1, ch: 0});
                self.focus();
            } else if (args.button === "cancel") {
                // Modal canceled
                // Should we do anything here ?
            }
        });
    };

    // Tab state helper: changes tab state to saved, saving, published, etc...
    this.set_tab_state = function(state) {
        var cur_tab = self.tabs[self.current_tab];
        // If no state passed - update buttons to reflect current state
        if (state === undefined)
            state = cur_tab.state;
        switch (state) {
            case self.TAB_STATES.SAVED:
                cur_tab.state = state;
                // TODO: add draft/published/unpublished text to button
                cur_tab.dom_elem.find("a").removeClass("not-saved");
                self.dom_save_btn_text.text("SAVED ("+
                    edtrSettings.PUB_STATUS[cur_tab.node.pub_status]+")");
                self.dom_save_btn.removeClass("btn-success").tooltip("hide").attr('disabled', 'disabled');
                break;
            case self.TAB_STATES.SAVING:
                cur_tab.state = state;
                self.dom_save_btn_text.text("saving draft...");
                self.dom_save_btn.removeClass("btn-success").attr('disabled', 'disabled');
                break;
            case self.TAB_STATES.NOT_SAVED:
                cur_tab.state = state;
                cur_tab.dom_elem.find("a").addClass("not-saved");
                self.dom_save_btn_text.text("Save Draft");
                self.dom_save_btn.addClass("btn-success").removeAttr('disabled');
                break;
            default:
                messagesBar.show_internal_error("edtrCodemirror.set_tab_state", "unknown state "+state);
                break;
        }
    };

    // TODO: Use this to open clicked urls (Ctrl-Click)
    this.on_cursor_activity = function(inst) {
        // console.log("cursor");
        // self.cm_editor.highlightMatches("CodeMirror-matchhighlight");
        self.scroll_to_anchor(false);
    };

    this._make_marker = function() {
      var marker = document.createElement("div");
      marker.innerHTML = "●"; //"<span style=\"color: #add8e6;\">&gt;</span>
      marker.className = "gutter-bookmark";
      return marker;
    };

    // Toggle bookmark in gutter on mouse click in gutter
    this.on_gutter_clicked = function(n, gutter) {
        var info = self.cm_editor.lineInfo(n);
        self.cm_editor.setGutterMarker(n, "bookmarks", info.gutterMarkers ? null : self._make_marker());
        // self.toggle_bookmark(null, {line: n, ch: 0});
    };

    // Remove bookmark at specified pos from array
    // returns number of bookmarks left on the same line
    // this._remove_bookmark = function(pos) {
    //     var left = 0;
    //     for (var i in self.bookmarks) {
    //         if (bookmarks[i].lines[0].markedSpans[0].from === pos.ch)
    //             break;
    //     }
    //     return left;
    // };

    // Toggle bookmark in gutter on keyboard shortcut
    this.toggle_bookmark = function(inst, pos) {
        // if (pos === undefined)
        //     pos = self.cm_editor.getCursor(true);
        // var marks = self.cm_editor.findMarksAt(pos);
        // console.log(marks);
        // if (!marks.length) {
        //     // No bookmarks at this pos - set one
        //     self.bookmarks.push(self.cm_editor.setBookmark(pos));
        //     // And set gutter
        //     self.cm_editor.setGutterMarker(pos.line, "bookmarks", self._make_marker());
        // } else {
        //     // There is already a bookmark at this position, clear it
        //     marks[0].clear();
        //     // Returns number of bookmarks left on the same line
        //     // If it was the last one - clear gutter
        //     if (self._remove_bookmark(pos) === 0)
        //         self.cm_editor.setGutterMarker(pos.line, "bookmarks", null);

        //     for (var i in marks) {
        //         // small HACK - null is passed instead of inst by on_gutter_clicked()
        //         // in this case we clear ALL marks
        //         if (inst === null ||
        //             marks[i].lines[0].markedSpans[0].from === pos.ch) {
        //             marks[i].clear();
        //             // When last mark is cleared - clear gutter
        //             if (inst === null || marks.length === 1)
        //                 self.cm_editor.setGutterMarker(pos.line, "bookmarks", null);
        //             break;
        //         }
        //     }
        //     // No marks at this pos, set new one
        //     if (i === marks.length) {
        //         self.cm_editor.setBookmark(pos);
        //         // Gutter should already be set
        //     }
        // }
    };

    // SAVE BUTTON and Ctrl-S:
    // Save contents of current tab and launch callback self.on_saved() when done
    // callback parameter will be true if saved ok and false if not
    this.save_codemirror = function() {
        var cur_tab = self.tabs[self.current_tab];
        // File is already saved or in the process of being saved
        if (cur_tab.state === self.TAB_STATES.SAVED) {
            if (self.on_saved) self.on_saved.call(this, true);
            return;
        }
        if (cur_tab.state === self.TAB_STATES.SAVING) {
            if (self.on_saved) self.on_saved.call(this, false);
            return;
        }
        // Update state, show backdrop and rotating wheel in tree
        self.set_tab_state(self.TAB_STATES.SAVING);
        self.dom_elem.find(".file-saving").show();
        edtrTree.show_loading_node(cur_tab.node, true);
        serverComm.action("dropbox", "save_file",
            {
                path:       cur_tab.node.id,
                content:    cur_tab.doc.getValue()
            }, function(data) {
                // Clear backdrop and rotating wheel in tree
                self.dom_elem.find(".file-saving").hide();
                edtrTree.show_loading_node(cur_tab.node, false);
                if (data.errcode) {
                    // Serious error
                    self.set_tab_state(self.TAB_STATES.NOT_SAVED);
                    messagesBar.show_error(serverComm.human_status[data.errcode]);
                    if (self.on_saved) self.on_saved.call(this, false);
                } else {
                    // Update node with new server data (dropbox meta)
                    edtrTree._update_tree_node(cur_tab.node, data.meta);
                    // When saving markdown file we're get new (possibly updated) content
                    // with metadata at the top
                    if (data.markdown_content) {
                        var cur = cur_tab.doc.getCursor();
                        cur_tab.doc.setValue(data.markdown_content);
                        cur_tab.doc.setCursor(cur);
                        self.parse_tab_metadata(self.current_tab);
                    }
                    self.set_tab_state(self.TAB_STATES.SAVED);
                    messagesBar.show_notification("Saved "+cur_tab.node.id);
                    if (self.on_saved) self.on_saved.call(this, true);
                }
            }
        );
    };

    // SAVE BUTTON and Ctrl-S:
    // Save contents of current tab and launch callback self.on_saved() when done
    // callback parameter will be true if saved ok and false if not
    this.publish_codemirror = function() {
        var cur_tab = self.tabs[self.current_tab];
        // Prepare callback to publish when save has completed
        self.on_saved = function(is_success) {
            // Imitate file action in tree
            if (is_success) {
                edtrTree.file_action("publish_file",
                    edtrHelper.get_filename_path(cur_tab.node.id),
                    cur_tab.node.name, cur_tab.node.name);
            }
        };
        // And launch save
        self.save_codemirror();
    };

    // Show confirmation dialog to replace existing tab with new content
    // and call callback with true to confirm replacement and false to cancel
    this.confirm_replace_tab = function(node, callback) {
        var index = self.find_tab(node.id, true);
        if (index === -1) return;

        // Tab is in saving mode - cancel request
        if (self.tabs[index].state === self.TAB_STATES.SAVING) {
            callback.call(null, false);
            return;
        }

        // If unsaved tab is not current - first show it to user
        if (self.tabs[self.current_tab].node.id !== node.id)
            self.switch_tab(node.id);

        // User is trying to open the already opened file
        // we don't care if the tab is saved or not and always ask for confirmation (???)
        modalDialog.params = {
            action:         "replace_cancel",
            template_vars: {
                filename:       node.id,
                is_saved:       self.tabs[index].state === self.TAB_STATES.SAVED
            }
        };
        modalDialog.params.callback = function(args) {
            if (args.button === "replace") {
                // Confirm replace
                callback.call(null, true);
            } else {
                // Cancel replace
                callback.call(null, false);
            }
        };
        modalDialog.show_confirm_modal();
    };

    // Add new tab with given content
    // We expect content_type to be one of the supported types
    this.add_tab                = function(tree_node, content_type, content) {
        // Sanity checks
        if (!tree_node) {
            messagesBar.show_internal_error("edtrCodemirror.add_tab", "no node ?! ");
            return;
        }
        if (content === undefined || content === null) {
            messagesBar.show_internal_error("edtrCodemirror.add_tab", "no content ?! ");
            return;
        }
        // See if we have this tab already opened
        var index = -1;
        index = self.find_tab(tree_node.id);
        if (index !== -1) {
            // Tab is in saving mode - ignore request
            if (self.tabs[index].state === self.TAB_STATES.SAVING)
                return;

            // Tab exists, but we expect confirm_replace_tab() to be already called
            // so we replace the document

            // Switch active tab
            self.switch_tab(tree_node.id);

            self.tabs[index].doc.setValue(content);
            self.tabs[index].node = tree_node;
            self.parse_tab_metadata(index);
        } else {
            // No tabs ? Hide stub and show real editor
            if (!self.tabs.length) {
                self.dom_elem.find(".edtr-stub-editor").hide();
                self.dom_elem.find(".edtr-editor").show();
            }

            // Clear current active tab
            self.dom_tabs_ul.find("li").removeClass("active");
            // Create new active tab
            // debugger;
            var li = $("<li>")
                    .addClass("tab")
                    .addClass("active")
                    .attr("data-node-id", tree_node.id),
                icon = $("<img>")
                    .attr("src", tree_node.icon),
                a = $("<a>")
                    .addClass("editor-tab")
                    .attr("href", "#")
                    .attr("title", tree_node.id)
                    .attr("display", "inline")
                    // .attr("data-toggle", "tab")
                    .text(tree_node.name),
                close_button = $("<span>")
                    .addClass("editor-tab-close")
                    .html("&#215;") // multiplication sign
                    ;
            icon.prependTo(a);
            close_button.appendTo(a);
            a.appendTo(li);
            self.dom_tabs_ul.append(li);

            // TODO: set mode according to content_type
            var cm_doc = CodeMirror.Doc(content, "gfm");
            self.tabs.push( {
                dom_elem:       li,
                doc:            cm_doc,
                node:           tree_node,
                content_type:   content_type
            });
            cm_doc.setValue(content);
            // TODO: do we need to to anything with old_doc ?
            var old_doc = self.cm_editor.swapDoc(cm_doc);
            // if (self.tabs.length > 1)
            //     self.tabs[self.current_tab].doc = old_doc;
            self.current_tab = self.tabs.length-1;

            self.parse_tab_metadata(self.current_tab);
        }

        // Clear undo history, thus disallowing to undo setValue()
        self.cm_editor.clearHistory();
        self.cm_editor.focus();

        // Change tree icon to reflect that file was opened for editing
        edtrTree.update_node_icon(self.tabs[self.current_tab].node, "editing");
        self.set_tab_state(self.TAB_STATES.SAVED);

        self.update_preview_theme();
        self.update_live_preview(true);
    };

    // Find tab in tabs array by node id
    // Returns tab index in array if found, -1 if not found
    // If show_error is provided and true - we show message when tab is not found
    this.find_tab              = function(node_id, show_error) {
        // Find the tab
        for (var i=0; i < self.tabs.length; i++) {
            if (self.tabs[i].node && self.tabs[i].node.id === node_id)
                break;
        }
        // Sanity check
        if (i === self.tabs.length) {
            if (show_error)
                messagesBar.show_internal_error("edtrCodemirror.find_tab", "can't find tab for "+node_id);
            return -1;
        }
        return i;
    };

    // Switch tab to specfied filename
    // If is_force is provided - we perform switch, even if node_id is the same
    // Needed for close_tab()
    this.switch_tab             = function(node_id, is_force) {
        // Should we do anything when active tab is clicked ?
        if (self.tabs[self.current_tab].node.id === node_id && !is_force)
            return;
        var index = self.find_tab(node_id, true);
        if (index === -1) return;

        // Cancel previous preview timer
        if (this.is_preview_timer) {
            self.is_preview_timer = false;
            clearTimeout(this.preview_timer_id);
        }

        // Clear current active tab
        self.dom_tabs_ul.find("li").removeClass("active");
        // Set new active tab and change Doc in CodeMirror
        self.dom_tabs_ul.find("li[data-node-id='"+node_id+"']").addClass("active");
        self.current_tab = index;
        self.cm_editor.swapDoc(self.tabs[self.current_tab].doc);

        // Update dom to reflect state of the new tab
        self.set_tab_state();

        // Update preview for new tab
        self.update_preview_theme();
        self.update_live_preview(true);
    },

    // Close tab by node id
    // IMPORTANT: We expect the user confirmation to be already processed
    // If show_error is provided and false - we DON'T show message when tab is not found
    // Default is TO SHOW the error message
    this.close_tab              = function(node_id, show_error) {
        // if (self.tabs.length === 1) {
        //     messagesBar.show_notification_warning("Removal of last tab is not implemented yet.");
        //     return;
        // }
        // Default is to show error when tab is not found
        if (show_error === undefined) show_error = true;
        var index = self.find_tab(node_id, show_error), change_active = false;
        if (index === -1) return;
        var dom_li = self.dom_tabs_ul.find("li[data-node-id='"+node_id+"']");

        // When closing active tab - change active to previous tab
        // or next tab if closing the first tab
        if (dom_li.hasClass("active"))
            change_active = true;

        // Save node to update its icon later
        var saved_node = self.tabs[index].node;

        // Remove tab node, item from tabs array and adjust current tab index
        dom_li.remove();
        self.tabs.splice(index, 1);
        if (self.current_tab > 0) self.current_tab--;

        // Removed last tab - hide editor and preview
        if (!self.tabs.length) {
            self.dom_elem.find(".edtr-editor").hide();
            self.dom_elem.find(".edtr-stub-editor").show();
            // self.dom_preview_head.html("");
            self.dom_preview_body.html("");
        }
        else if (change_active) {
            self.switch_tab(self.tabs[self.current_tab].node.id, true);
        }

        // Change icon in tree
        edtrTree.update_node_icon(saved_node);
    };

    // Switch tab on click
    // $(this) referes to clicked <li>
    this.on_tab_click           = function(event) {
        self.switch_tab($(this).data("node-id"));
    },

    // Process right click
    this.on_tab_mousedown        = function(event) {
        // Right click - simulate edtrTree context menu
        if (event.which === 3) {
            var index = self.find_tab($(this).data("node-id"), true);
            if (index === -1) return;
            if (self.tabs[index].node)
                edtrTree.on_right_click(event, null, self.tabs[index].node);
        }

        return false;
    },

    // Close tab on close button click
    // $(this) referes to clicked <span>
    this.on_tab_close_click      = function(event) {
        // Prevents jQuery from calling on_tab_click()
        event.stopPropagation();

        var node_id = $(this).parent().parent().data("node-id"),
            index = self.find_tab(node_id, true);
        if (index === -1) return;

        // Ignore close while saving
        if (self.tabs[index].state === self.TAB_STATES.SAVING)
            return;

        // If text was not saved, ask confirmation from user to close it
        if (self.tabs[index].state === self.TAB_STATES.SAVED) {
            self.close_tab(node_id);
        } else {
            // Closing tab, that is not current - first show it to user
            if (self.tabs[self.current_tab].node.id !== node_id)
                self.switch_tab(node_id);
            // Confirmation dialog
            modalDialog.params = {
                action:         "save_continue_lose",
                template_vars: {
                    filename:      node_id
                }
            };
            modalDialog.params.callback = function(args) {
                if (args.button === "save") {
                    // Prepare callback
                    self.on_saved = function(is_saved) {
                        if (is_saved)
                            self.close_tab(node_id);
                    };
                    self.save_codemirror();
                } else if (args.button === "lose") {
                    self.close_tab(node_id);
                } else {
                    // Cancel close
                }
            };
            modalDialog.show_confirm_modal();
        }
    },

    this.init                   = function(dom_container, dom_preview) {
        //
        // INITIALIZATION (constructor)
        //
        this.is_hidden                  = false;
        this.is_preview_timer           = false;
        this.preview_timer_id           = null;
        // TODO: Get those from folder/general settings
        this.tab_character              = "\t";
        this.tab_spaces                 = Array(4+1).join(" "); // should equal to tab_character + 1
        this.list_character             = "-";

        // Document Tabs
        this.tabs                       = [];
        this.current_tab                = 0;

        // Tab states
        this.TAB_STATES = {
            NOT_SAVED:          0,
            SAVING:             1,
            SAVED:              2,
            PUBLISHED:          3
        };

        // Buttons bar state
        this.BB_STATES = {
            BUTTONS:            0,
            SEARCH:             1,
            REPLACE:            2
        };
        // Default is buttons
        this.bb_state = this.BB_STATES.BUTTONS,

        // Cache dom elements
        this.dom_elem           = dom_container;
        this.dom_tabs           = dom_container.find(".editor-tabs");
        this.dom_toolbar        = dom_container.find(".editor-toolbar");
        this.dom_editor         = dom_container.find(".editor-area");
        this.dom_buttonbar      = dom_container.find(".editor-buttons");
        this.dom_search_input   = dom_container.find(".cme-search .search-input");
        this.dom_replace_input  = dom_container.find(".cme-search .replace-input");
        this.dom_tabs_ul        = this.dom_tabs.find("ul");
        this.dom_save_btn       = this.dom_elem.find('#btn_save');
        this.dom_save_btn_text  = this.dom_elem.find('#btn_save_text');
        // Preview iframe
        this.dom_preview        = dom_preview;
        // We use contents() to search within iframe
        this.dom_preview_body   = this.dom_preview.contents().find('body');
        this.dom_preview_head   = this.dom_preview.contents().find('head');

        /* Allows last line to be positioned above the bottom */
        this.dom_preview_body.css("margin-bottom", "90px");

        // TODO: get those from general settings
        var cm_settings = {
            // TODO: all settings should accord to content_type
            mode:               "gfm",
            lineWrapping:       edtrSettings.general.editor.line_wrapping(),
            matchBrackets:      true,
            pollInterval:       300,
            undoDepth:          500,
            theme:              edtrSettings.general.editor.theme(),
            indentUnit:         this.tab_spaces.length,
            tabSize:            this.tab_spaces.length, // should be the same !
            indentWithTabs:     edtrSettings.general.editor.indent_with_tabs(),
            electricChars:      false,
            lineNumbers:        true,
            gutters:            [ "CodeMirror-linenumbers" ], //"bookmarks"],

            // Addons
            // highlightSelectionMatches: {minChars: 3, style: "matchhighlight"},
            autoCloseTags:      true,   // TODO: apparently works only in text/html mode
                                        // make it work in gfm mode as well
            autoCloseBrackets:  edtrSettings.general.editor.auto_close_brackets(),

            // Markdown
            fencedCodeBlocks:   true,

            // TODO: find Mac equivalents
            extraKeys: {
                // General
                "Shift-Ctrl-W": this.toggle_width,
                "Shift-Ctrl-H": this.toggle_height,
                "Shift-Ctrl-Alt-W": this.toggle_fullscreen,
                // "Esc":          this.out_of_fullscreen,

                // File
                "Ctrl-S":       this.save_codemirror,
                "Cmd-S":        this.save_codemirror,
                "Ctrl-M":       this.edit_tab_metadata,

                // Edit
                "Tab":          this.tab,
                "Shift-Tab":    this.shift_tab,
                "Enter":        this.custom_new_line,

                // Search / Navigation
                "Ctrl-F":       this.show_find,
                "Cmd-F":        this.show_find,
                "Ctrl-Alt-F":   this.show_replace,
                "Cmd--Alt-F":   this.show_replace,
                "Shift-Ctrl-B": this.toggle_bookmark,

                // Leaves various modes
                "Esc":          this.process_esc,

                // Markdown
                "Ctrl-H":       this.rotate_header,
                "Ctrl-B":       this.toggle_bold,
                "Ctrl-I":       this.toggle_italic,
                "Ctrl-K":       this.toggle_code,

                "Ctrl-U":       this.unordered_list,
                "Ctrl-1":       this.ordered_list,
                "Ctrl-Q":       this.blockquote,

                // "Ctrl-D":       this.divider_hr,

                "Ctrl-G":       this.insert_image_url,
                "Ctrl-L":       this.insert_url
            }
        };

        this.cm_editor = CodeMirror.fromTextArea(dom_container.find(".cme-textarea").get(0), cm_settings);

        // .ON events
        this.cm_editor.on("change", this.on_change);
        this.cm_editor.on("cursorActivity", this.on_cursor_activity);
        this.cm_editor.on("gutterClick", this.on_gutter_clicked);

        // Handle document tabs
        // delegate() monitors dom changes
        // we also disable text selection to avoid weird UI look
        this.dom_tabs_ul.delegate("li", "click", this.on_tab_click).disableSelection();
        this.dom_tabs_ul.delegate("li", "mousedown", this.on_tab_mousedown)
            .delegate("li", 'contextmenu', function(e){ e.preventDefault(); });
        this.dom_tabs_ul.delegate(".editor-tab-close", "click", this.on_tab_close_click);

        // Handle edtrSplitters events by registering callbacks
        edtrSplitters.on_sidebar_toggled = self._update_toolbar_width_button;
        edtrSplitters.on_preview_toggled = self._update_toolbar_height_button;

        //
        // Subscribe to various settings
        //
        var i = 0;
        this.ko_sub = [];
        // Change preview stylesheet
        this.ko_sub[i++] = edtrSettings.general.preview.theme.subscribe(this.update_preview_theme);
        this.ko_sub[i++] = edtrSettings.general.preview.theme_code.subscribe(this.update_preview_theme);
        // Change editor font size
        this.ko_sub[i++] = edtrSettings.general.editor.font_size.subscribe(function(new_size) {
            $(".CodeMirror-scroll").css("font-size", edtrSettings.general.editor.font_size()+"px");
        });
        // Show/hide toolbar
        this.ko_sub[i++] = edtrSettings.general.editor.show_toolbar.subscribe(function(state) {
            if (edtrSettings.general.editor.show_toolbar()) {
                self.dom_editor.css("top", self.dom_tabs.height()+self.dom_toolbar.height()+"px");
                self.dom_toolbar.show();
            } else {
                self.dom_editor.css("top", self.dom_tabs.height()+"px");
                self.dom_toolbar.hide();
            }
        });

        // Subscription to all options follows the same pattern
        // key is edtrSettings.general.editor observable
        // value is codemirror option
        var options = {
            theme:                  "theme",
            line_numbers:           "lineNumbers",
            auto_close_brackets:    "autoCloseBrackets",
            hl_current_line:        "styleActiveLine",
            indent_with_tabs:       "indentWithTabs",
            line_wrapping:          "lineWrapping"
        };
        var _update_option = function(val) {
            self.cm_editor.setOption(options[this], edtrSettings.general.editor[this]());
        };
        for (var o in options) {
            this.ko_sub[i++] = edtrSettings.general.editor[o].subscribe(_update_option, o);
        }

        // Fire all callbacks to update editor with correct settings
        for (i = 0; i < this.ko_sub.length; i++)
            this.ko_sub[i].callback();

        // Hides original text area, just in case
        // this.dom_elem.hide();

        // Build list of languages that hljs supports
        this.hljs_languages = [];
        for (var lang in hljs.LANGUAGES)
            this.hljs_languages.push(lang);

        // Set default options for marked
        this.marked_options = {
            gfm:            true,
            tables:         false,
            breaks:         true,
            pedantic:       false,
            sanitize:       false,
            smartLists:     true,
            highlight:      function(code, lang) {
                if (lang && self.hljs_languages.indexOf(lang) !== -1)
                    return hljs.highlight(lang, code).value;
                else
                    return hljs.highlightAuto(code).value;
            }
        };
        marked.setOptions(this.marked_options);

        this.showdown = new Showdown.converter( {extensions: [ "github" ] } );

        // Actions for toolbar and buttonbar buttons
        this.dom_elem.find(".cme-button").on("click", function(event) {
            self[$(this).data("action")].apply(self, $(this));
            // Since all actions perform operations on text - get focus back to editor
            self.focus();
        });

        // Search on any text (keyup)
        // Special search navigation (keydown):
        //      next on Enter/Down, previous on Up and leave search mode on Esc
        this.dom_search_input
        .on("keyup", function(event) {
            switch (event.which) {
                case 27: // Esc
                    self.process_esc();
                    break;
                case 13:
                case 40:
                case 38:
                    // Ignore events processed in keydown
                    break;
                default:
                    self.search_update_query();
                    break;
            }
        })
        .on("keydown", function(event) {
            // Those events need to be processed on keydown to allow prevention of default action
            switch (event.which) {
                case 13: // Enter
                case 40: // Down
                    event.preventDefault();
                    self.search_find(false, false);
                    break;
                case 38: // Up
                    event.preventDefault();
                    self.search_find(true, false);
                    break;
            }
        });

        // Update search position if search dialog is visible
        $(self.cm_editor.getScrollerElement()).on("mouseup keyup", function(event) {
            if (self.search_state && self.search_state.visible) {
                self.search_state.posFrom = self.search_state.posTo =
                self.search_state.kc_posFrom = self.search_state.kc_posTo =
                    self.cm_editor.getCursor("end");
            }
        });

        // TOOLTIPS for toolbar and buttons (default is tooltip on top of element)
        this.dom_elem.find(".cme-button-tooltip").tooltip({
            placement: "top", html: true, delay: { show: 1000, hide: 300 }
        });
        this.dom_elem.find(".cme-button-tooltip-left").tooltip({
            placement: "left", html: true, delay: { show: 1500, hide: 300 }
        });
        this.dom_elem.find(".cme-button-tooltip-bottom").tooltip({
            placement: "bottom", html: true, delay: { show: 800, hide: 300 }
        });

        // this.update_preview_theme();

        return this;
    };

    // store pointer to ourselves to be able
    // to access object from callbacks
    var self=this;
    return this;
}

//var toggle_left = "&lt;&lt;";
//var toggle_right = "&gt;&gt;";
