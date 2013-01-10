//
// Javascript extensions
//
// adds .startsWith(text) to any string
if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str){
        return this.slice(0, str.length) == str;
    };
}
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
    check_valid_username:   function (username) {
        return !this.check_invalid_chars(this.username_chars, username);
    },
    check_valid_filename:   function (filename) {
        return !this.check_invalid_chars(this.filename_chars, filename);
    },
    get_filename_ext:       function (filename) {
        //ext = (/[.]/.exec(filename)) ? /[^.]+$/.exec(filename) : undefined;
        //ext = filename.split('.').pop();
        ext = /^.+\.([^.]*)$/.exec(filename);
        // Will return:
        //      null if no ext in filename
        //      actual extension if filename has one
        //      ("" if filename is in form 'somename.')
        if (ext)
            return ext[1];
        else
            return null;
    }
};
