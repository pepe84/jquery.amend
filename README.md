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
* __create__: function(params, callback) to save a new amendment
* __t__ (optional): function(text) to translate statuses and other stuff
* __attrname__ (optional): html attribute containing text id ("data-reference" by default)
* __index__ (optional): selector to attach original text index (using headers with id)
* __style__ (optional): custom class names for form elements (see default opts)

###data###

A list of amendments, each amendment should contain:
 
* __id__: amendment unique id
* __reference__: original text id
* __amendment__: new text
* __reason__: amendment's justification
* __author__: username
* __status__: "pending", "approved" or "rejected"

***

##HTML and style##

* HTML should contain only headers and paragraphs identified by custom attribute (see an example at _index.html_)
* CSS could be customized using _style_ config and library specific selectors (see _jquery.amend.css_)

***

##Available translations##

* "Awaiting review"
* "Amendment approved"
* "Amendment rejected"
* "Reason"
* "sent by"
* "anonymous"
* "amendment"
* "amendments"
* "Send"
* "Cancel"
* "Delete text"
* "Name"
* "Confirm"
* "+"
* "Add new text inside"