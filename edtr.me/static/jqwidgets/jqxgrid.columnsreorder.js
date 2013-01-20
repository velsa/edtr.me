/*
jQWidgets v2.6.0 (2012-Dec-27)
Copyright (c) 2011-2013 jQWidgets.
License: http://jqwidgets.com/license/
*/

(function(a){a.extend(a.jqx._jqxGrid.prototype,{getcolumnindex:function(b){var c=this.getcolumn(b);var d=this.columns.records.indexOf(c);return d},setcolumnindex:function(c,g,h){var f=this.getcolumn(c);if(f.pinned){return}if(f.hidden){return}var j=this.columns.records.indexOf(f);this.columns.records.splice(j,1);this.columns.records.splice(g,0,f);var d=0;var l=this.headerZIndex;this.columnsrow.children().detach();var i=this.toThemeProperty("jqx-grid-cell");i+=" "+this.toThemeProperty("jqx-grid-cell-pinned");if(this.filterrow){a(this.filterrow.children()[0]).children().detach();this.filterrow[0].cells=[]}var k=this;var b=null;if(k.filterrow!=undefined){var b=a(k.filterrow.children()[0])}this.columnsrow[0].cells=[];var e=false;a.each(this.columns.records,function(m,p){var n=this.uielement;k.columnsrow.append(n);n.css("z-index",l--);var o=this.width;n.css("left",d);k.columnsrow[0].cells[k.columnsrow[0].cells.length]=n[0];if(k.filterrow){var q=a('<div style="overflow: hidden; position: absolute; height: 100%;" class="'+i+'"></div>');b.append(q);q.css("left",d);q.css("z-index",l+1);q.width(this.width);q[0].left=d;q.append(this._filterwidget);k.filterrow[0].cells[k.filterrow[0].cells.length]=q[0]}if(this.hidden){e=true}if(!(this.hidden&&this.hideable)){d+=o}});var f=this._columns[j];this._columns.splice(j,1);this._columns.splice(g,0,f);this._raiseEvent(24,{columntext:f.text,datafield:f.datafield,oldindex:j,newindex:g});if(h==false){return}if(e){this.prerenderrequired=true;this.rendergridcontent(true)}else{this._updatecolumnwidths();this._updatecellwidths()}if(this._updatefilterrowui&&this.filterable&&this.showfilterrow){this._updatefilterrowui()}this._renderrows(this.virtualsizeinfo)},_pinnedColumnsLength:function(){var b=0;a.each(this.columns.records,function(){if(this.pinned){b++}});return b},_handlecolumnsreorder:function(){var d=this;var g=-1;var c=false;if(!d.columnsreorder){return}var f="mousemove.reorder"+this.element.id;var e="mousedown.reorder"+this.element.id;var h="mouseup.reorder"+this.element.id;var b=false;if(this.isTouchDevice()){b=true;f=a.jqx.mobile.getTouchEventName("touchmove")+".reorder"+this.element.id;e=a.jqx.mobile.getTouchEventName("touchstart")+".reorder"+this.element.id;h=a.jqx.mobile.getTouchEventName("touchend")+".reorder"+this.element.id}this.removeHandler(a(document),f);this.addHandler(a(document),f,function(j){if(d.reordercolumn!=null){var k=parseInt(j.pageX);var r=parseInt(j.pageY);if(b){var o=d.getTouches(j);var n=o[0];if(n!=undefined){k=parseInt(n.pageX);r=parseInt(n.pageY)}}var m=d.host.offset();var s=parseInt(m.left);var t=parseInt(m.top);if(d.dragmousedownoffset==undefined||d.dragmousedownoffset==null){d.dragmousedownoffset={left:0,top:0}}var q=parseInt(k)-parseInt(d.dragmousedownoffset.left);var i=parseInt(r)-parseInt(d.dragmousedownoffset.top);d.reordercolumn.css({left:q+"px",top:i+"px"});c=false;if(k>=s&&k<=s+d.host.width()){if(r>=t&&r<=t+d.host.height()){c=true}}g=-1;if(c){d.reordercolumnicon.removeClass(d.toThemeProperty("jqx-grid-dragcancel-icon"));d.reordercolumnicon.addClass(d.toThemeProperty("jqx-grid-drag-icon"));var p=d.columnsheader.offset();var l=p.top+d.columnsheader.height();if(d.columnsdropline!=null){if(r>=p.top&&r<=l){g=d._handlereordercolumnsdroplines(k)}else{d.columnsdropline.fadeOut("slow")}}}else{if(d.columnsdropline!=null){d.columnsdropline.fadeOut("slow")}d.reordercolumnicon.removeClass(d.toThemeProperty("jqx-grid-drag-icon"));d.reordercolumnicon.addClass(d.toThemeProperty("jqx-grid-dragcancel-icon"))}if(b){j.preventDefault();j.stopPropagation();return false}}});this.columnsbounds=new Array();this.removeHandler(a(document),e);this.addHandler(a(document),e,function(j){a(document.body).addClass("jqx-disableselect");d.columnsbounds=new Array();var l=d.host.offset().left;var k=d.host.offset().top;if(d.showtoolbar){k+=d.toolbarheight}if(d.groupable){k+=d.groupsheaderheight}var i=0;a.each(d.columns.records,function(m){if(this.hidden){d.columnsbounds[d.columnsbounds.length]={top:k,column:this,left:l,width:0,height:2+d.rowsheight};return true}if(i==0){l+=parseInt(this.uielement[0].style.marginLeft);if(isNaN(l)){l=parseInt(d.host.offset().left)-d.hScrollInstance.value}}i++;d.columnsbounds[d.columnsbounds.length]={top:k,column:this,left:l,width:this.width,height:2+d.columnsheight};l+=this.width})});this.removeHandler(a(document),h);this.addHandler(a(document),h,function(i){a(document.body).removeClass("jqx-disableselect");var l=parseInt(i.pageX);var s=parseInt(i.pageY);if(b){var o=d.getTouches(i);var n=o[0];l=parseInt(n.pageX);s=parseInt(n.pageY)}var m=d.host.offset();var u=parseInt(m.left);var v=parseInt(m.top);var j=d.groupsheader.height();if(d.showtoolbar){v+=d.toolbarheight}d.columndragstarted=false;d.dragmousedown=null;if(d.reordercolumn!=null){var k=a.data(d.reordercolumn[0],"reorderrecord");var w=d.columns.records.indexOf(d.getcolumn(k));d.reordercolumn.remove();d.reordercolumn=null;var p=d.groups.length;p+=d._pinnedColumnsLength();if(k!=null){if(c){if(g!=-1){var q=g.index;if(q>=p){var r=d.columns.records[q];if(r!=undefined){var t=d.columns.records.indexOf(d.getcolumn(r.datafield));if(r.datafield==null){var t=d.columns.records.indexOf(d.getcolumnbytext(r.text))}if(w<t){if(g.position=="before"){d.setcolumnindex(k,t-1)}else{d.setcolumnindex(k,t)}}else{if(w>t){d.setcolumnindex(k,t)}}}}}}if(d.columnsdropline!=null){d.columnsdropline.remove();d.columnsdropline=null}}}})},getcolumnbytext:function(c){var b=null;if(this.columns.records){a.each(this.columns.records,function(){if(this.text==c){b=this;return false}})}return b},_handlereordercolumnsdroplines:function(g){var b=this;var f=-1;var d=b.groups.length;d+=b._pinnedColumnsLength();var e=parseInt(b.host.offset().left);var c=e+b.host.width();a.each(b.columnsbounds,function(h){if(h>=d){if(this.width==0){return true}if(g<=this.left+this.width/2){if(g>c){b.columnsdropline.fadeOut();return false}b.columnsdropline.css("left",parseInt(this.left)+"px");b.columnsdropline.css("top",parseInt(this.top)+"px");b.columnsdropline.height(this.height);b.columnsdropline.fadeIn("slow");f={index:h,position:"before"};return false}else{if(g>=this.left+this.width/2){if(this.left+this.width>c){b.columnsdropline.fadeOut();return false}b.columnsdropline.css("left",1+this.left+this.width);b.columnsdropline.css("top",this.top);b.columnsdropline.height(this.height);b.columnsdropline.fadeIn("slow");f={index:h,position:"after"}}}}});return f},_createreordercolumn:function(c,e,h){var g=this;var f=e;if(g.reordercolumn){g.reordercolumn.remove()}if(g.columnsdropline){g.columnsdropline.remove()}g.reordercolumn=a("<div></div>");var j=c.clone();g.reordercolumn.css("z-index",999999);j.css("border-width","1px");j.css("opacity","0.4");var i=a(j.find("."+g.toThemeProperty("jqx-grid-column-menubutton")));if(i.length>0){i.css("display","none")}var b=a(j.find(".icon-close"));if(b.length>0){b.css("display","none")}g.reordercolumnicon=a('<div style="z-index: 9999; position: absolute; left: 100%; top: 50%; margin-left: -18px; margin-top: -7px;"></div>');g.reordercolumnicon.addClass(g.toThemeProperty("jqx-grid-drag-icon"));g.reordercolumn.css("float","left");g.reordercolumn.css("position","absolute");var d=g.host.offset();j.width(c.width()+16);g.reordercolumn.append(j);g.reordercolumn.height(c.height());g.reordercolumn.width(j.width());g.reordercolumn.append(g.reordercolumnicon);a(document.body).append(g.reordercolumn);j.css("margin-left",0);j.css("left",0);j.css("top",0);g.reordercolumn.css("left",f.left+g.dragmousedown.left);g.reordercolumn.css("top",f.top+g.dragmousedown.top);if(h!=undefined&&h){g.columnsdropline=a('<div style="z-index: 9999; display: none; position: absolute;"></div>');g.columnsdropline.width(2);g.columnsdropline.addClass(g.toThemeProperty("jqx-grid-group-drag-line"));a(document.body).append(g.columnsdropline)}},_handlecolumnsdragreorder:function(c,f){if(this.reordercolumn){this.reordercolumn.remove()}if(this.columnsdropline){this.columnsdropline.remove()}this.dragmousedown=null;this.dragmousedownoffset=null;this.columndragstarted=false;this.reordercolumn=null;var g=this;var e;var b=false;if(this.isTouchDevice()){b=true}var d="mousedown.drag";var e="mousemove.drag";if(b){d=a.jqx.mobile.getTouchEventName("touchstart")+".drag";e=a.jqx.mobile.getTouchEventName("touchmove")+".drag"}else{this.addHandler(f,"dragstart",function(h){return false})}this.addHandler(f,d,function(j){if(false==c.draggable){return true}var i=j.pageX;var h=j.pageY;if(b){var k=g.getTouches(j);var m=k[0];i=m.pageX;h=m.pageY}g.dragmousedown={left:i,top:h};var l=a(j.target).offset();g.dragmousedownoffset={left:parseInt(i)-parseInt(l.left),top:parseInt(h-l.top)};return true});this.addHandler(f,e,function(j){if(!c.draggable){return true}if(undefined==c.datafield){return true}if(c.pinned){return true}if(g.dragmousedown){var i=j.pageX;var h=j.pageY;if(b){var l=g.getTouches(j);var n=l[0];if(n!=undefined){i=n.pageX;h=n.pageY}}e={left:i,top:h};if(!g.columndragstarted&&g.reordercolumn==null){var k=Math.abs(e.left-g.dragmousedown.left);var m=Math.abs(e.top-g.dragmousedown.top);if(k>3||m>3){g._createreordercolumn(f,e,true);a.data(g.reordercolumn[0],"reorderrecord",c.datafield)}}}})}})})(jQuery);