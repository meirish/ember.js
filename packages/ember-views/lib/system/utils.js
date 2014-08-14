/* globals XMLSerializer */

import Ember from 'ember-metal/core'; // Ember.assert
import jQuery from 'ember-views/system/jquery';

/**
@module ember
@submodule ember-views
*/

/* BEGIN METAMORPH HELPERS */

// Internet Explorer prior to 9 does not allow setting innerHTML if the first element
// is a "zero-scope" element. This problem can be worked around by making
// the first node an invisible text node. We, like Modernizr, use &shy;

var needsShy = typeof document !== 'undefined' && (function() {
  var testEl = document.createElement('div');
  testEl.innerHTML = "<div></div>";
  testEl.firstChild.innerHTML = "<script></script>";
  return testEl.firstChild.innerHTML === '';
})();

// IE 8 (and likely earlier) likes to move whitespace preceeding
// a script tag to appear after it. This means that we can
// accidentally remove whitespace when updating a morph.
var movesWhitespace = typeof document !== 'undefined' && (function() {
  var testEl = document.createElement('div');
  testEl.innerHTML = "Test: <script type='text/x-placeholder'></script>Value";
  return testEl.childNodes[0].nodeValue === 'Test:' &&
          testEl.childNodes[2].nodeValue === ' Value';
})();

// Use this to find children by ID instead of using jQuery
var findChildById = function(element, id) {
  if (element.getAttribute('id') === id) { return element; }

  var len = element.childNodes.length, idx, node, found;
  for (idx=0; idx<len; idx++) {
    node = element.childNodes[idx];
    found = node.nodeType === 1 && findChildById(node, id);
    if (found) { return found; }
  }
};

var setInnerHTMLWithoutFix = function(element, html) {
  if (needsShy) {
    html = '&shy;' + html;
  }

  var matches = [];
  if (movesWhitespace) {
    // Right now we only check for script tags with ids with the
    // goal of targeting morphs.
    html = html.replace(/(\s+)(<script id='([^']+)')/g, function(match, spaces, tag, id) {
      matches.push([id, spaces]);
      return tag;
    });
  }

  element.innerHTML = html;

  // If we have to do any whitespace adjustments do them now
  if (matches.length > 0) {
    var len = matches.length, idx;
    for (idx=0; idx<len; idx++) {
      var script = findChildById(element, matches[idx][0]);
      var node = document.createTextNode(matches[idx][1]);
      script.parentNode.insertBefore(node, script);
    }
  }

  if (needsShy) {
    var shyElement = element.firstChild;
    while (shyElement.nodeType === 1 && !shyElement.nodeName) {
      shyElement = shyElement.firstChild;
    }
    if (shyElement.nodeType === 3 && shyElement.nodeValue.charAt(0) === "\u00AD") {
      shyElement.nodeValue = shyElement.nodeValue.slice(1);
    }
  }
};

/* END METAMORPH HELPERS */

function setInnerHTMLTestFactory(tagName, childTagName, ChildConstructor) {
  return function() {
    var el = document.createElement(tagName);
    setInnerHTMLWithoutFix(el, '<' + childTagName + '>Content</' + childTagName + '>');
    return el.firstChild instanceof ChildConstructor;
  };
}


var innerHTMLTags = {
  // IE 8 and earlier don't allow us to do innerHTML on select
  select: function() {
    var el = document.createElement('select');
    setInnerHTMLWithoutFix(el, '<option value="test">Test</option>');
    return el.options.length === 1;
  },

  // IE 9 and earlier don't allow us to set innerHTML on col, colgroup, frameset,
  // html, style, table, tbody, tfoot, thead, title, tr.
  col:      setInnerHTMLTestFactory('col',      'span',  window.HTMLSpanElement),
  colgroup: setInnerHTMLTestFactory('colgroup', 'col',   window.HTMLTableColElement),
  frameset: setInnerHTMLTestFactory('frameset', 'frame', window.HTMLFrameElement),
  table:    setInnerHTMLTestFactory('table',    'tbody', window.HTMLTableSectionElement),
  tbody:    setInnerHTMLTestFactory('tbody',    'tr',    window.HTMLTableRowElement),
  tfoot:    setInnerHTMLTestFactory('tfoot',    'tr',    window.HTMLTableRowElement),
  thead:    setInnerHTMLTestFactory('thead',    'tr',    window.HTMLTableRowElement),
  tr:       setInnerHTMLTestFactory('tr',       'td',    window.HTMLTableCellElement)
};

var canSetInnerHTML = function(tagName) {
  tagName = tagName.toLowerCase();
  var canSet = innerHTMLTags[tagName];

  if (typeof canSet === 'function') {
    canSet = innerHTMLTags[tagName] = canSet();
  }

  return canSet === undefined ? true : canSet;
};

export function setInnerHTML(element, html) {
  var tagName = element.tagName;

  if (canSetInnerHTML(tagName)) {
    setInnerHTMLWithoutFix(element, html);
  } else {
    // Firefox versions < 11 do not have support for element.outerHTML.
    var outerHTML = element.outerHTML || new XMLSerializer().serializeToString(element);
    Ember.assert("Can't set innerHTML on "+element.tagName+" in this browser", outerHTML);

    var startTag = outerHTML.match(new RegExp("<"+tagName+"([^>]*)>", 'i'))[0];
    var endTag = '</'+tagName+'>';

    var wrapper = document.createElement('div');
    jQuery(startTag + html + endTag).appendTo(wrapper);
    element = wrapper.firstChild;
    while (element.tagName !== tagName) {
      element = element.nextSibling;
    }
  }

  return element;
}

export function isSimpleClick(event) {
  var modifier = event.shiftKey || event.metaKey || event.altKey || event.ctrlKey;
  var secondaryClick = event.which > 1; // IE9 may return undefined

  return !modifier && !secondaryClick;
}
