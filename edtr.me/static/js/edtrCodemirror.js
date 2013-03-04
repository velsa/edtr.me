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

    this.toggle_width = function() {
        edtrSplitters.toggle_sidebar();
        // HACK: have to call refresh twice, because codemirror throws error
        self.cm_editor.refresh();
        setTimeout(self.cm_editor.refresh, 500);
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
                alt_text = is_img ? 'image': 'link';
        }
        var img_char = is_img ? '!': '';
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


    //
    // Parse metadata at the beginning of markdown file (and others as well ?)
    // returns:
    //      status:     0 - success, 1 - metadata not found, 2 - error in metadata
    //      lines:      # of lines in metadata
    //      content:    content without metadata AND without the new line after metadata
    //      data:       { key: value, ... } array of metadata
    //
    // TODO: optimize:  save all metadata as string and on each parse compare it to the text
    //                  and see if it has changed or text has more metadata after the match
    //
    this.parse_metadata = function(text) {
        var i = 0, eol,
            line, j, key, val,
            status = 0, lines = 0, content = text, data = {};
        debugger;
        while (i < text.length) {
            // Get next line
            eol = text.indexOf("\n", i);
            if (eol === -1) eol = text.length;
            line = text.substr(i, eol-i);
            // debugger;
            if (!line.length) {
                content = text.substr(i+1);
                break;
            }
            // if(line[0] === " " || line[0] === "\t") {
            //     content = text.substr(i);
            //     break;
            // }
            j = line.indexOf(":");
            if (j === -1) {
                status = 2;
                content = text.substr(i);
                break;
            }
            data[text.substr(i, j).trim()] = text.substr(i+j+1, eol-i-j-1).trim();
            // console.log(JSON.stringify(data));
            i = eol+1;
            lines++;
        }
        return {
            status:     status,
            lines:      lines,
            content:    content,
            data:       data
        };
    };

    // Show modal for convenient meta-data editing
    this.edit_metadata = function() {
        var key, ko_meta, prefix="meta_";

        // Clear file_meta (its a temp object)
        for (key in edtrSettings.file_meta) {
            if (key.startsWith(prefix))
                edtrSettings.file_meta[key]("");
        }
        // Copy parsed meta into view model
        for (key in self.tabs[self.current_tab].metadata.data) {
            ko_meta = edtrSettings.file_meta[prefix+key.toLowerCase()];
            if (ko_meta)
                ko_meta(self.tabs[self.current_tab].metadata.data[key]);
        }
        edtrSettings.file_meta_modal(self.tabs[self.current_tab].node.id, function(args) {
            if (args.button === "ok") {
                // TODO: Save metadata into codemirror's text
                var metadata_text = "", max_key_length=0, key;

                // Find longest key
                for (key in edtrSettings.file_meta) {
                    if (key.startsWith(prefix) && key.length > max_key_length)
                        max_key_length = key.length;
                }
                // Create aligned metadata text
                for (key in edtrSettings.file_meta) {
                    // Ignore knockout and validator fields
                    if (!key.startsWith(prefix)) continue;
                    // Add meta key only if it has value
                    ko_meta = edtrSettings.file_meta[key];
                    if (ko_meta().length) {
                        // Align value with spaces
                        metadata_text += key.replace(prefix, "").capitalize() + ":" +
                            Array(max_key_length-key.length+2+4).join(" ") +
                            ko_meta() + "\n";
                    }
                }
                // Always end metadata with new line
                if (metadata_text.length)
                    metadata_text += "\n";
                self.cm_editor.setValue(metadata_text + self.tabs[self.current_tab].metadata.content);
            } else if (args.button === "cancel") {
                // Modal canceled
                // Should we do anything here ?
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
    //
    this.scroll_to_anchor = function() {
        var line_num = self.cm_editor.getCursor(true).line-self.tabs[self.current_tab].metadata.lines;
        if (line_num > 0&& line_num !== self.cur_line) {
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
                if (new_pos !== self.preview_pos) {
                    self.preview_pos = new_pos;
                    self.dom_preview_body.scrollTop(new_pos);
                }
            }
        }
    };

    this.update_live_preview = function() {
        // Update preview on timer (no need for preview when in fullscreen)
        if (!self.is_codemirror_fullscreen && !self.is_preview_timer) {
            self.is_preview_timer = true;
            this.preview_timer_id = setTimeout(function() {
                self.is_preview_timer = false;
                // Parse metadata
                self.tabs[self.current_tab].metadata = self.parse_metadata(self.cm_editor.getValue());
                // Generate preview
                self.dom_preview_body.html(marked(self.tabs[self.current_tab].metadata.content));
                // Get anchors from generated preview
                self.aTags = self.dom_preview_body.find("a.marked-anchor");
                self.scroll_to_anchor();
            }, 100);
        }
    },

    //
    // Text in CodeMirror changed
    //
    // This function will be called VERY OFTEN !
    this.on_change = function(inst, change_obj) {
        // console.log(self.saved_state);
        if (self.tabs[self.current_tab].state === self.TAB_STATE.SAVED) {
            self.set_tab_state(self.TAB_STATE.NOT_SAVED);
        }
        self.update_live_preview();
    };

    // Tab state helper: changes tab state to saved, saving, published, etc...
    this.set_tab_state = function(state) {
        // If no state passed - update buttons to reflect current state
        if (state === undefined)
            state = self.tabs[self.current_tab].state;
        switch (state) {
            case self.TAB_STATE.SAVED:
                self.tabs[self.current_tab].state = state;
                // TODO: add draft/published/unpublished text to button
                self.tabs[self.current_tab].dom_elem.find("a").removeClass("not-saved");
                self.dom_save_btn_text.text("SAVED ("+"draft"+")");
                self.dom_save_btn.removeClass("btn-success").tooltip("hide").attr('disabled', 'disabled');
                break;
            case self.TAB_STATE.SAVING:
                self.tabs[self.current_tab].state = state;
                self.dom_save_btn_text.text("saving draft...");
                self.dom_save_btn.removeClass("btn-success").attr('disabled', 'disabled');
                break;
            case self.TAB_STATE.NOT_SAVED:
                self.tabs[self.current_tab].state = state;
                self.tabs[self.current_tab].dom_elem.find("a").addClass("not-saved");
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
        self.scroll_to_anchor();
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
    // Save codemirror's contents and launch callback when done
    // callback parameter will be true if saved ok and false if not
    this.save_codemirror = function() {
        // File is already saved or in the process of being saved
        if (self.tabs[self.current_tab].state !== self.TAB_STATE.NOT_SAVED)
            return;
        // Update state, show backdrop and rotating wheel in tree
        self.set_tab_state(self.TAB_STATE.SAVING);
        self.dom_elem.find(".file-saving").show();
        edtrTree.show_loading_node(self.tabs[self.current_tab].node, true);
        serverComm.action("dropbox", "save_file",
            {
                path: self.tabs[self.current_tab].node.id,
                content: self.cm_editor.getValue()
            }, function(data) {
                // Clear backdrop and rotating wheel in tree
                self.dom_elem.find(".file-saving").hide();
                edtrTree.show_loading_node(self.tabs[self.current_tab].node, false);
                if (data.status > serverComm.max_success_status) {
                    // Serious error
                    self.set_tab_state(self.TAB_STATE.NOT_SAVED);
                    if (data.status === 6)
                        messagesBar.show_notification_warning(serverComm.human_status[data.status]);
                    else
                        messagesBar.show_error(serverComm.human_status[data.status]);
                    if (self.on_saved)
                        self.on_saved.call(this, false);
                } else {
                    self.set_tab_state(self.TAB_STATE.SAVED);
                    messagesBar.show_notification("Saved "+self.tabs[self.current_tab].node.id);
                    if (self.on_saved)
                        self.on_saved.call(this, true);
                }
            });
    };

    // Show confirmation dialog to replace existing tab with new content
    // and call callback with true to confirm replacement and false to cancel
    this.confirm_replace_tab = function(node, callback) {
        var index = self.find_tab(node.id, true);
        if (index === -1) return;

        // Tab is in saving mode - cancel request
        if (self.tabs[index].state === self.TAB_STATE.SAVING) {
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
                is_saved:       self.tabs[index].state === self.TAB_STATE.SAVED
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
        if (!tree_node) {
            messagesBar.show_internal_error("edtrCodemirror.add_tab", "no node ?! ");
            return;
        }
        if (!content) {
            messagesBar.show_internal_error("edtrCodemirror.add_tab", "no content ?! ");
            return;
        }
        // See if we have this tab already opened
        var index = self.find_tab(tree_node.id);
        if (index !== -1) {
            // Tab is in saving mode - ignore request
            if (self.tabs[index].state === self.TAB_STATE.SAVING)
                return;

            // Tab exists, but we expect confirm_replace_tab() to be already called
            // so we replace the document

            // Switch active tab
            self.switch_tab(tree_node.id);

            self.tabs[index].doc.setValue(content);
            self.tabs[index].metadata = self.parse_metadata(content);
            self.tabs[index].node = tree_node;
        } else {
            // Clear current active tab
            self.dom_tabs_ul.find("li").removeClass("active");
            // Create new active tab
            // debugger;
            icon_url = tree_node.icon;
            var li = $("<li>")
                    .addClass("tab")
                    .addClass("active")
                    .attr("data-node-id", tree_node.id),
                icon = $("<img>")
                    .attr("src", icon_url),
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
                content_type:   content_type,
                metadata:       self.parse_metadata(content)
            });
            cm_doc.setValue(content);
            var old_doc = self.cm_editor.swapDoc(cm_doc);
            // if (self.tabs.length > 1)
            //     self.tabs[self.current_tab].doc = old_doc;
            self.current_tab = self.tabs.length-1;

            // Change tree icon to reflect that file was opened for editing
            edtrTree.update_node_icon(self.tabs[self.current_tab].node, "editing");
        }

        // Clear undo history, thus disallowing to undo setValue()
        self.cm_editor.clearHistory();
        self.cm_editor.focus();

        self.set_tab_state(self.TAB_STATE.SAVED);
        // Cancel previous preview timer
        if (self.is_preview_timer) {
            self.is_preview_timer = false;
            clearTimeout(self.preview_timer_id);
        }
        self.update_live_preview();
    };

    // Find tab in tabs array by node id
    // Returns tab index in array if found, -1 if not found
    this.find_tab              = function(node_id, show_error) {
        // Find the tab
        for (var i=0; i < self.tabs.length; i++) {
            if (self.tabs[i].node.id === node_id)
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
        this.update_live_preview();
    },

    // Close tab by node id
    // We expect the user confirmation to be already processed
    this.close_tab              = function(node_id) {
        if (self.tabs.length === 1) {
            messagesBar.show_notification_warning("Removal of last tab is not implemented yet.");
            return;
        }
        // debugger;
        var index = self.find_tab(node_id, true), change_active = false;
        if (index === -1) return;
        var dom_li = self.dom_tabs_ul.find("li[data-node-id='"+node_id+"']");

        // When closing active tab - change active to previous tab or next tab
        // if closing the first tab
        if (dom_li.hasClass("active"))
            change_active = true;

        // Change icon in tree
        edtrTree.update_node_icon(self.tabs[index].node);

        // Remove tab node, item from tabs array and adjust current tab index
        dom_li.remove();
        self.tabs.splice(index, 1);
        if (self.current_tab > 0) self.current_tab--;

        if (change_active) {
            self.switch_tab(self.tabs[self.current_tab].node.id, true);
        }

    };

    // Switch tab on click
    // $(this) referes to clicked <li>
    this.on_tab_click           = function(event) {
        self.switch_tab($(this).data("node-id"));
    },

    // Switch tab on click
    // $(this) referes to clicked <li>
    this.on_tab_mousedown        = function(event) {
        // Right click - simulate edtrTree context menu
        if (event.which === 3) {
            var index = self.find_tab($(this).data("node-id"), true);
            if (index === -1) return;
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
        if (self.tabs[index].state === self.TAB_STATE.SAVING)
            return;

        // If text was not saved, ask confirmation from user to close it
        if (self.tabs[index].state === self.TAB_STATE.SAVED) {
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

    this.update_preview_theme   = function() {
        var prev_css = self.dom_preview_head.find("link[rel=stylesheet]");
        self.dom_preview_head.
            append("<link rel=\"stylesheet\" href=\"/static/css/md_preview/" +
                edtrSettings.general.preview.theme() +
                ".css?reload=" +
                (new Date()).getTime() + "\">");
        prev_css.remove();
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

        // Document Tabs
        this.tabs                       = [];
        this.current_tab                = 0;

        // Tab states
        this.TAB_STATE = {
            PUBLISHED:          3,
            SAVED:              2,
            SAVING:             1,
            NOT_SAVED:          0
        };

        // Cache dom elements
        this.dom_elem           = dom_container;
        this.dom_tabs           = dom_container.find(".editor-tabs");
        this.dom_toolbar        = dom_container.find(".editor-toolbar");
        this.dom_editor         = dom_container.find(".editor-area");
        this.dom_textarea       = dom_container.find(".cme-textarea");
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
        this.update_preview_theme();

        // TODO: get those from general settings
        var cm_settings = {
            // TODO: all settings should accord to content_type
            mode:               "gfm",
            lineWrapping:       true,
            matchBrackets:      true,
            pollInterval:       300,
            undoDepth:          500,
            theme:              edtrSettings.general.editor.theme(),
            indentUnit:         this.tab_spaces.length,
            tabSize:            this.tab_spaces.length, // should be the same !
            indentWithTabs:     true,
            electricChars:      false,
            lineNumbers:        true,
            gutters:            [ "CodeMirror-linenumbers" ], //"bookmarks"],

            // Addons
            highlightSelectionMatches: {minChars: 3, style: "matchhighlight"},
            autoCloseTags:      true,   // TODO: apparently works only in text/html mode
                                        // make it work in gfm mode as well
            autoCloseBrackets:  edtrSettings.general.editor.auto_close_brackets(),

            // TODO: find Mac equivalents
            extraKeys: {
                // General
                "Ctrl-W":       this.toggle_width,
                "Shift-Ctrl-W": this.toggle_fullscreen,
                // "Esc":          this.out_of_fullscreen,

                // File
                "Ctrl-S":       this.save_codemirror,
                "Ctrl-M":       this.edit_metadata,

                // Edit
                "Tab":          this.tab,
                "Shift-Tab":    this.shift_tab,
                "Enter":        this.custom_new_line,

                // Search / Navigation
                "Shift-Ctrl-B": this.toggle_bookmark,

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

        this.cm_editor = CodeMirror.fromTextArea(this.dom_textarea[0], cm_settings);

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

        //
        // Subscribe to various settings
        //
        var i = 0;
        this.ko_sub = [];
        // Change preview stylesheet
        this.ko_sub[i++] = edtrSettings.general.preview.theme.subscribe(this.update_preview_theme);
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
            auto_close_brackets:    "autoCloseBrackets"
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

        return this;
    };

    // store pointer to ourselves to be able
    // to access object from callbacks
    var self=this;
    return this;
}

//var toggle_left = "&lt;&lt;";
//var toggle_right = "&gt;&gt;";
