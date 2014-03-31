jquery.amend
============

jQuery plugin to add amendments to a text

***

##Requirements##
* text clearly divided into identified parts (using custom attribute)
* persistance system to store data (__create__ and __delete__ functions)
* [google-diff-match-patch library](http://code.google.com/p/google-diff-match-patch/) to visualize amendments

##How to use##
```
$(selector).amend(options, data);
```

###options###
* __attrname__ (optional): html attribute containing text id ("data-reference" by default)
* __auto__ (optional): show amend form when user clicks on text (false by default)
* __container__ (optional): custom amendments container (optional)
* __listeners__: collection of listeners (see _Events_ section)
* __statuses__ (optional): custom amendment status map (see default opts)
* __style__ (optional): custom class names for form elements (see default opts)
* __t__ (optional): translate function with text as 1st argument and tag as 2nd (optional)

###data###

A list of amendments, each amendment should contain:
 
* __id__: amendment unique id
* __reference__: original text id
* __amendment__: new text
* __reason__: amendment's justification
* __author__: username
* __status__: "pending", "approved" or "rejected"

***

##Events##

* __jqa-toggle__: listens to expand/collapse amendments trigger
* __jqa-render__: listens to render amendments trigger
* __jqa-counter__: triggered when amendments counter is updated
* __jqa-new__: listens to add amendment / new text trigger
* __jqa-ready__: triggered when amend / new text form is rendered
* __jqa-submit__: triggered when data form is submitted
* __jqa-cancel__: triggered when any form is canceled
* __jqa-confirm__: triggered when confirm form is submitted
* __jqa-success__: triggered when success callback ends

***

##HTML and style##

* HTML should contain only headers and paragraphs identified by custom attribute (see an example at _index.html_)
* CSS could be customized using _style_ config and library specific selectors (see _jquery.amend.css_)

***

##Available translations##

* "Add new text inside"
* "Send"
* "Cancel"
* "Delete text"
* "Amendment"
* "Reason"
* "Name"
* "Confirm"
* "sent by"
* "anonymous"