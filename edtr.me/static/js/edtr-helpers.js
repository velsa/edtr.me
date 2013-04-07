//
// For lame IE
//
if (!window.console) console = {log: function() {}};

if(typeof String.prototype.trim !== 'function') {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, '');
  };
}

//
// Javascript extensions
//
// adds .startsWith(text) to any string
if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str){
        return this.slice(0, str.length) == str;
    };
}
// adds .endsWith(text) to any string
if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}
// counts number of strings (s1) in string
if (typeof String.prototype.count !== 'function') {
    String.prototype.count=function(s1) {
        return (this.length - this.replace(new RegExp(s1,"g"), '').length) / s1.length;
    };
}
// adds .format(text) to any string
// "{0} is dead, but {1} is alive! {0} {2}".format("ASP", "ASP.NET")
// outputs
// ASP is dead, but ASP.NET is alive! ASP {2}
if (typeof String.prototype.format != 'function') {
    String.prototype.format = function() {
      var args = arguments;
      return this.replace(/\{(\d+)\}/g, function(match, number) {
        return typeof args[number] != 'undefined' ? args[number] : match;
      });
    };
}

// Capitalize each word in string
String.prototype.capitalize = function() {
    return this.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
};

// Converts dashed name into human readable string
String.prototype.humanReadable = function() {
    return this.replace(/[-_]/g, ' ').capitalize();
};

// An advanced version of indexOf, which allows regexp
String.prototype.regexIndexOf = function(regex, startpos) {
    var indexOf = this.substring(startpos || 0).search(regex);
    return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
};

// adds element any array
if (!Array.prototype.push) {
    Array.prototype.push = function(elem) {
        this[this.length]=elem;
    };
}


//
// Search helpers
//
// var search_words_attr = "";
// var search_words = [];
// var set_search_words = function(text) {
//     search_words = [];
//     search_words_attr = '[';
//     //var arr_words = text.split(/\s+/);
//     var arr_words = text.split(/\W+/);
//     var seen_words = {};
//     for (var i=0; i < arr_words.length; i++) {
//         //if (arr_words[i].match(/^\w+$/g)) {
//         if (arr_words[i] != "") {
//             if (!seen_words[arr_words[i]]) {
//                 seen_words[arr_words[i]] = true;
//                 search_words.push(arr_words[i]);
//                 search_words_attr += '"'+arr_words[i]+'"';
//                 if (i != arr_words.length-1)
//                     search_words_attr += ',';
//                 else
//                     search_words_attr += ']';
//             }
//         }
//     }
// };


//
// Misc helpers for modals, codemirror, registration, etc
//
var edtrHelper = {
    username_chars:     "!@#$%^&*()+=[]\\\';,/{}|\":<>?",
    filename_chars:     "!@#$%^&*()[]\\\';,/{}|\":<>?",

    check_invalid_chars:    function(ichars, name){
        for (var i = 0; i < name.length; i++) {
            if (ichars.indexOf(name.charAt(i)) != -1) {
                return true;
            }
        }
        return false;
    },

    check_valid_username:   function(username) {
        return !this.check_invalid_chars(this.username_chars, username);
    },

    check_valid_filename:   function(filename) {
        return !this.check_invalid_chars(this.filename_chars, filename);
    },

    // Get extension from file path or filename
    // Will return:
    //      null if no ext in filename or filename is ''
    //      actual extension if filename has one
    //      ('' if filename is in form 'somename.')
    get_filename_ext:       function(filename) {
        //ext = (/[.]/.exec(filename)) ? /[^.]+$/.exec(filename) : undefined;
        //ext = filename.split('.').pop();
        var ext = /^.+\.([^.]*)$/.exec(filename);
        if (ext)
            return ext[1];
        else
            return null;
    },

    // Strip extension from file path or filename
    // Will return:
    //      null if no bare part in filename (e.g. '.gif' or '')
    //      filename without extension otherwise
    get_filename_bare:       function(filename) {
        var bare = /^(.+)\.[^.]*$/.exec(filename);
        if (bare)
            return bare[1];
        else
            return null;
    },

    // Extract path from full filename path
    // Will return:
    //      null if no path precedes filename (e.g. 'filename.ext' or '')
    //      path of filename WITHOUT trailing '/' otherwise
    //      e.g:
    //      '/dir1/filename' -> '/dir1'
    //      '/filename' -> '/'
    get_filename_path:       function(filename) {
        if (filename[0] !== '/')
            return null;
        var path = /^(.+)\/[^\/]*$/.exec(filename);
        if (path)
            return path[1];
        else
            return "/";
    },

    // Extract filename from file path
    // Will return:
    //      null if filename ends with '/'
    //      filename any path parts
    //      e.g:
    //      '/dir1/filename.ext' -> 'filename.ext'
    //      'filename.ext' -> 'filename.ext'
    get_filename:       function(filename) {
        if (filename[0] !== '/')
            return filename;
        var name = /^.*\/([^\/]+)$/.exec(filename);
        if (name)
            return name[1];
        else
            return null;
    },

    // Strip root path from filename path
    // root and filename should have NO trailing '/' !
    //
    // Will return:
    //      null if filename is not part of root (e.g. '/dir2', '/dir1/filename.ext')
    //      e.g:
    //      '/dir1', /dir1/dir2/filename' -> '/dir2/filename'
    //      '/', '/filename' -> '/filename'
    get_relative_to_root:       function(root, filename) {
        if (filename[0] !== '/')
            return root === '/' ? root + filename : root + '/' + filename;
        if (filename.indexOf(filename) === -1) {
            return null;
        }
        else {
            var relative = filename.substr(root.length);
            if (relative[0] !== "/")
                return "/"+relative;
            else
                return relative;
        }
    }
};
