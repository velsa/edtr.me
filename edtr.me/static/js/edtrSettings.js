//
// Holds all settings, which other objects use
// Syncs settings with server
// NOTE: this object uses knockout to interact with dom via data-bind
//
var edtrSettings = {
    file_meta: {
        author:         ko.observable(""),
        title:          ko.observable(""),
        date:           ko.observable(""),
        tags:           ko.observable(""),
        style:          ko.observable(""),
        slug:           ko.observable("")
    },

    init:                   function (root_dom) {
        // ko.applyBindings(edtrSettings, root_dom);
    }
};
