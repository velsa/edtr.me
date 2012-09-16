var is_codemirror_fullscreen = false;
var is_codemirror_hidden = true;
var is_codemirror_saved = true;
var is_codemirror_wide = false;
var tab_character, tab_spaces;
var list_character;

// IMPORTANT:
// replace CodeMirrors isWordChar() with this function
// for smarter word detection (includes markdown tags)
function isWordChar(ch) {
    return /[\w\*\.:#/+\-`~]/.test(ch) || ch.toUpperCase() != ch.toLowerCase();
}

var create_codemirror = function() {
    // tab_character and tab_spaces for padding
    // TODO: Get those from folder/general settings
    tab_character = "\t";
    tab_spaces = "";
    list_character = "-";
    for (var i=0; i<4; i++) tab_spaces += " ";
    var cm_editor = CodeMirror.fromTextArea(
        document.getElementById("md_textarea"),
        {
            mode:               "gfm",
            onChange:           onCMChange,

            // TODO: Get those from folder/general settings
            gutter:             true,
            fixedGutter:        true,
            lineNumbers:        true,
            lineWrapping:       true,
            matchBrackets:      true,
            pollInterval:       300,
            undoDepth:          500,
            theme:              "default",
            indentUnit:         4, //tab_character.length,
            tabSize:            4, // should be the same !
            indentWithTabs:     true,

            onGutterClick:      gutter_clicked,
            onCursorActivity:   cursor_activity,

            extraKeys: {
                // General
                "Ctrl-F11":     toggle_width,
                //"F11":          toggle_fullscreen,  TODO: fix layout for fullscreen
                "Esc":          out_of_fullscreen,
                // File
                "Ctrl-S":       save_codemirror,
                // Edit
                "Tab":          tab,
                "Shift-Tab":    shift_tab,
                "Enter":        custom_new_line,
                // Markdown
                "Ctrl-H":       rotate_header,
                "Ctrl-B":       toggle_bold,
                "Ctrl-I":       toggle_italic,
                "Ctrl-K":       toggle_code,

                "Ctrl-U":       unordered_list,
                "Ctrl-O":       ordered_list,
                "Ctrl-Q":       blockquote,

                "Ctrl-D":       divider_hr,

                "Ctrl-G":       insert_image_url,
                "Ctrl-L":       insert_url
            }
        });

    // Add bootstrap class to codemirror so it will behave
    // correctly on resizes
    is_codemirror_wide = false;
    $('.CodeMirror-wrap').addClass('span9');

    // Set default flags
    is_codemirror_hidden = false;
    is_codemirror_fullscreen = false;
    set_saved_state("SAVED");

    // Show codemirror
    //$('#cme_wide_toggle').html(toggle_left);
    $("#md_textarea").hide();
    $("#editor_toolbar, .CodeMirror, #btn_save, #btn_preview").show();

    // ONCLICK Toolbar handlers
    $('#tbb_header').click(rotate_header);
    $('#tbb_bold').click(toggle_bold);
    $('#tbb_italic').click(toggle_italic);
    $('#tbb_code').click(toggle_code);
    // --
    $('#tbb_ulist').click(unordered_list);
    $('#tbb_olist').click(ordered_list);
    $('#tbb_quote').click(blockquote);
    // --
    $('#tbb_divider').click(divider_hr);
    // --
    $('#tbb_image_url').click(insert_image_url);
    $('#tbb_url').click(insert_url);
    // ----
    $('#tbb_width').click(toggle_width);
    $('#tbb_fullscreen').click(toggle_fullscreen);

    // And buttons
    $('#btn_preview').click(preview_codemirror);
    $('#btn_save').click(save_codemirror);

    // TOOLTIPS for toolbar
    $(".has_tooltip_below").tooltip({ placement: "bottom", delay: { show: 1000, hide: 300 } });
    // And buttons
    $(".has_tooltip").tooltip({ delay: { show: 800, hide: 300 } });

    return cm_editor;
};

//var toggle_left = "&lt;&lt;";
//var toggle_right = "&gt;&gt;";

var hide_codemirror = function() {
    is_codemirror_hidden = true;
    set_saved_state("SAVED");
    //$('#cme_wide_toggle').html("&nbsp;");
    $("#editor_toolbar, .CodeMirror, #btn_save, #btn_preview").hide();
    $("#md_textarea").show().attr("disabled", "true");
};

var toggle_width = function() {
    if (is_codemirror_hidden)
        return;
    if (!is_codemirror_wide) {
        is_codemirror_wide = true;
        //$('#cme_wide_toggle').html(toggle_right);
        $("#left_sidebar").hide();
        $('.CodeMirror-wrap, #cme_buttonbar, #cme_toolbar').removeClass('span9').addClass('span12');
        cm_editor.focus();
    } else {
        is_codemirror_wide = false;
        //$('#cme_wide_toggle').html(toggle_left);
        $("#left_sidebar").show();
        $('.CodeMirror-wrap, #cme_buttonbar, #cme_toolbar').removeClass('span12').addClass('span9');
        cm_editor.focus();
    }
};

var toggle_fullscreen = function() {
    if (is_codemirror_fullscreen) {
        out_of_fullscreen();
        return;
    }
    var scroller = cm_editor.getScrollerElement();
    if (scroller.className.search(/\bCodeMirror-fullscreen\b/) === -1) {
        scroller.className += " CodeMirror-fullscreen";
        scroller.style.height = "100%";
        scroller.style.width = "100%";
        cm_editor.refresh();
        is_codemirror_fullscreen = true;
    } else {
        out_of_fullscreen();
    }
};

var out_of_fullscreen = function() {
    var scroller = cm_editor.getScrollerElement();
    if (scroller.className.search(/\bCodeMirror-fullscreen\b/) !== -1) {
        scroller.className = scroller.className.replace(" CodeMirror-fullscreen", "");
        scroller.style.height = '';
        scroller.style.width = '';
        cm_editor.refresh();
    }
    is_codemirror_fullscreen = false;
};

//
// Text in CodeMirror changed
//
// We use local var in addition to cookie for speedup
// This function will be called VERY OFTEN !
var __saved_state; // 0 - not saved, 1 - saving, 2 - saved
var onCMChange = function() {
    if (__saved_state == 2) {
        set_saved_state("NOT SAVED");
    }
    //console.log("changed");
};


//
// TOOLBAR
//
var toggle_markup = function(markup) {
    var mlen = markup.length;
    if (cm_editor.somethingSelected()) {
        // Check if we need to remove the bold markup
        var sel = cm_editor.getSelection();
        if (sel.substring(0, mlen) == markup) {
            sel = sel.substring(mlen);
            if (sel.substr(sel.length-mlen, mlen) == markup) {
                sel = sel.substring(0, sel.length-mlen);
            }
            cm_editor.replaceSelection(sel);
        } else {
            cm_editor.replaceSelection(markup+cm_editor.getSelection()+markup);
        }
    } else {
        cm_editor.replaceRange(markup+cm_editor.getSelection()+markup,
            cm_editor.getCursor(true));
        var pos = cm_editor.getCursor(true);
        cm_editor.setCursor( pos['line'], pos['ch']-mlen);
        //console.log("POS "+ pos['ch']);
    }
    cm_editor.focus();
};

// Bold, Italic and Code toolbar icons
var toggle_bold = function() {toggle_markup("**") };
var toggle_italic = function() {toggle_markup("*") };
var toggle_code = function() {toggle_markup("`") };

// Rotate Header
var rotate_header = function() {
    if (cm_editor.somethingSelected()) {
        // TODO: Idea: when smth is selected, use underscore header styling
    }
    // Check if we need to remove the bold markup
    var cur = cm_editor.getCursor(true);
    var line = cm_editor.getLine(cur['line']);
    var new_header = "";
    var cur_shift;
    for (var i=0; i < 7; i++) if (line[i] != '#') break;
    if (i < 6) {
        for (var k=0; k<=i; k++)
            new_header += '#'
        cur_shift = 1;
    } else {
        cur_shift = -6;
    }
    //console.log(new_header);
    var sub_line = line.substr(i);
    if (sub_line[0] != ' ' && sub_line[0] != '\t')
        new_header += ' ';
    var new_line = new_header + sub_line;
    cm_editor.setLine(cur['line'], new_line);
    cm_editor.setCursor(cur['line'], cur['ch']+cur_shift);
    cm_editor.focus();
};

// Unordered List
var unordered_list = function() {
    if (cm_editor.somethingSelected()) {
        //cm_editor.indentSelection("prev");
        var lines = CodeMirror.splitLines(cm_editor.getSelection());
        for (var i=0; i<lines.length; i++) {
            if (lines[i]) {
                if (/^\s*[*\-+]\s+/.test(lines[i]))
                    lines[i] = lines[i].replace(/^(\s*)([*\-+]\s+)(.*)$/,"$1$3");
                else if (/^\s*[0-9]+\.\s+/.test(lines[i]))
                    lines[i] = lines[i].replace(/^(\s*)([0-9]+\.\s+)(.*)$/,"$1"+list_character+" $3");
                else
                    lines[i] = lines[i].replace(/^(\s*)(.*)$/,"$1"+list_character+" $2");
            }
        }
        cm_editor.replaceSelection(lines.join("\n"));
    } else {
        var cur = cm_editor.getCursor(true);
        var line = cm_editor.getLine(cur.line);
        if (!line)
            cm_editor.setLine(cur.line, list_character + ' ');
        else
            cm_editor.setLine(cur.line, line + '\n' + list_character + ' ');
    }
};

// Ordered List
var ordered_list = function() {
    if (cm_editor.somethingSelected()) {
        var lines = CodeMirror.splitLines(cm_editor.getSelection());
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
        cm_editor.replaceSelection(lines.join("\n"));
    } else {
        var cur = cm_editor.getCursor(true);
        var line = cm_editor.getLine(cur.line);
        if (!line)
            cm_editor.setLine(cur.line, "1. ");
        else
            cm_editor.setLine(cur.line, line + "\n1. ");
    }
};

// Blockquote
var blockquote = function() {
    if (cm_editor.somethingSelected()) {
        //cm_editor.indentSelection("prev");
        var lines = CodeMirror.splitLines(cm_editor.getSelection());
        for (var i=0; i<lines.length; i++) {
            if (lines[i]) {
                if (/^\s*>\s+/.test(lines[i]))
                    lines[i] = lines[i].replace(/^(\s*)(>\s+)(.*)$/,"$1$3");
                else
                    lines[i] = lines[i].replace(/^(\s*)(.*)$/,"$1"+'>'+" $2");
            }
        }
        cm_editor.replaceSelection(lines.join("\n"));
    } else {
        var cur = cm_editor.getCursor(true);
        var line = cm_editor.getLine(cur.line);
        if (!line)
            cm_editor.setLine(cur.line, '> ');
        else
            cm_editor.setLine(cur.line, line + '\n> ');
    }
};

var divider_hr = function() {
    var sel='';
    if (cm_editor.somethingSelected()) {
        // Insert divider BEFORE selection
        sel = cm_editor.getSelection();
    }
    cm_editor.replaceSelection('\n***\n\n'+sel);
    var end_pos = cm_editor.getCursor(false);
    cm_editor.setSelection(end_pos, end_pos);
    cm_editor.focus();
};

// Image URL
var insert_image_url = function() {
    smart_insert_url(1);
};
// URL
var insert_url = function() {
    smart_insert_url(0);
};
// Image URL or URL
// is_img should be 1 or 0 (NOT true or false !)
var smart_insert_url = function(is_img) {
    // Default is to place cursor inside curly brackets
    // (the url itself)
    var sel = "", step=3+is_img;
    if (cm_editor.somethingSelected()) {
        // Replace selection and place cursor in
        // square brackets (image description)
        sel = cm_editor.getSelection();
        step = 1+is_img;
    }
    var img_char = is_img ? '!': '';
    cm_editor.replaceSelection(img_char+'[]('+sel+')');
    var pos = cm_editor.getCursor(true);
    cm_editor.setCursor( pos['line'], pos['ch']+step);
    cm_editor.focus();
};

// Tab - insert tab, or move selection
var tab = function() {
    if (cm_editor.somethingSelected()) {
        CodeMirror.commands.indentMore(cm_editor);
    } else {
        var cur = cm_editor.getCursor();
        var line = cm_editor.getLine(cur.line);
        var pad_str = tab_character;
        if (cur.ch) {
            // Calculate pos in line with respect to tab characters
            var ins_pos = 0;
            for (var i=0; i < cur.ch; i++)
                if (line[i] == '\t') ins_pos += tab_spaces.length;
                else ins_pos++;
            var pad_spaces = tab_spaces.length - (ins_pos % tab_spaces.length);
            if (pad_spaces != tab_spaces.length)
                pad_str = tab_spaces.substr(0, pad_spaces);
        }
        var new_line = line.substring(0, cur.ch)+pad_str+line.substring(cur.ch);
        cm_editor.setLine(cur.line, new_line);
        cm_editor.setCursor(cur.line, cur.ch+pad_str.length);
    }
    cm_editor.focus();
};
// Shift-Tab - shift back selection or line
var shift_tab = function() {
    CodeMirror.commands.indentLess(cm_editor);
};

// Custom new line handling - smart list indents
var custom_new_line = function() {
    CodeMirror.commands.newlineAndIndent(cm_editor);
    // Handle lists
    var cur = cm_editor.getCursor();
    var prev_indented = cm_editor.getLine(cur.line-1).substr(cur.ch);
    // Unordered lists and blockquotes
    if (/^[*\-+>]\s+/.test(prev_indented)) {
        // See if we have an empty list bullet or blockquote tag
        // Also make sure that new line text is empty
        if (/^[*\-+>] $/.test(prev_indented) &&
            cm_editor.getLine(cur.line).length == 0) {
            // In such case we consider this to be the end of
            // a list or blockquote and remove the last tag
            cm_editor.setCursor(cur.line-1, 0);
            CodeMirror.commands.killLine(cm_editor);
            cm_editor.removeLine(cur.line);
        } else {
            cm_editor.replaceSelection(prev_indented[0]+" ", "end");
        }
    } else {
        // Ordered lists
        if (/^[0-9]+\.\s+/.test(prev_indented)) {
            var prev_num = prev_indented.match(/^[0-9]+/);
            if (/^[0-9]+\. $/.test(prev_indented)) {
                cm_editor.setCursor(cur.line-1, 0);
                CodeMirror.commands.killLine(cm_editor);
                cm_editor.removeLine(cur.line);
            } else {
                cm_editor.replaceSelection((parseInt(prev_num)+1)+". ", "end");
            }
        }
    }
};

// TODO: bind Ctrl-M to set/remove markers on gutter
// TODO: and Shift-Ctrl-M to jump over markers
var gutter_clicked = function(cm, n) {
    var info = cm.lineInfo(n);
    if (info.markerText)
        cm.clearMarker(n);
    else
        cm.setMarker(n, "<span style=\"color: #add8e6;\">●</span> %N%");
};

// TODO: Use this to open clicked urls (Ctrl-Click)
var cursor_activity = function() {
    cm_editor.matchHighlight("CodeMirror-matchhighlight");
};

//
// CODEMIRROR BUTTONS
//
// PREVIEW BUTTON: Preview HTML
var preview_codemirror = function () {
    console.log($.cookie('mdb_preview_url'));
    window.open($.cookie('mdb_preview_url')+
        "?reload="+(new Date()).getTime(), '');
    //return false;
};

// Callbacks, which are called by get_server_result()
var save_failed = function(message) {
    set_saved_state("NOT SAVED");
    show_error(message);
};
var saved_ok = function(message) {
    set_saved_state("SAVED");
    show_notification(message);
};
// SAVE BUTTON: Save Markdown to Dropbox
var save_codemirror = function () {
    var text = cm_editor.getValue();
    set_saved_state("SAVING");
    $.post("/async/save/", {
        db_path: $.cookie('mdb_current_dbpath'),
        content: text
    }, function(data) {
        if (data['status'] != 'success') {
            // Serious error
            save_failed(data['message']);
        } else {
            // Wait for result from server
            get_server_result(data['task_id'], saved_ok, save_failed);
        }
    }).error(function(data) {
            show_error("Can't communicate with server ! Please refresh the page.");
        });
    //return false;
};

// SAVE state helpers: changes state while saving
var set_saved_state = function(saved) {
    if (saved == "SAVED") {
        __saved_state = 2;
        is_codemirror_saved = true;
        $('#btn_save_text').text("SAVED");
        $('#btn_save').removeClass("btn-success").attr('disabled', 'disabled');
    } else if (saved == "SAVING") {
        __saved_state = 1;
        is_codemirror_saved = false;
        $('#btn_save_text').text("saving...");
        $('#btn_save').removeClass("btn-success").attr('disabled', 'disabled');
    } else { // "NOT SAVED"
        __saved_state = 0;
        is_codemirror_saved = false;
        $('#btn_save_text').text("Save");
        $('#btn_save').addClass("btn-success").removeAttr('disabled');
    }
};
