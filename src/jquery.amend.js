/**
 * jquery.amend.js is a plugin to manage amendments for any text divided 
 * into clearly identified parts (using custom attribute). It requires a 
 * persistance system to store data and google-diff-match-patch library 
 * (http://code.google.com/p/google-diff-match-patch/) to visualize amendments.
 * 
 * Plugin configuration must cointain the following properties
 * to work properly:
 *
 * - create: function(params, callback) to save a new amendment
 * - delete: function(id, callback) to delete an amendment
 * - t: function(text) to translate statuses and other stuff
 * - attrname: html attribute containing text id ("data-reference" by default)
 *
 * Amendments should have this data structure:
 *
 * - id: amendment unique id
 * - reference: original text id
 * - amendment: new text
 * - reason: amendment's justification
 * - author: username
 * - status: "pending", "approved" or "rejected"
 *
 * HTML should contain only headers and paragraphs identified by custom attr
 * and CSS could be customized using library specific selectors.
 */

(function(window,document,$,undefined) {
  'use strict';

  var error, defaultOpts, validateOpts;

  error = function(msg) {
    throw new Error('ERROR: jquery.amend: ' + msg);
  };

  defaultOpts = {
    'create': null,
    'delete': null,
    't': function(text) { return text; },
    'attrname': 'data-reference'
  };

  validateOpts = function(options) {
    if (!(options && $.isPlainObject(options))) {
      return false;
    }
    $.each(options, function(name) {
      if (defaultOpts[name] === undefined) {
        return error('Unknown option: "' + name + '"');
      } else if (!$.isFunction(options[name])) {
        return error('Option "' + name + '" is not a function.');
      }
    });
    return true;
  };

  var AmendManager = (function() {

    function AmendManager(element, options, json) {
      // Initialize configuration    
      this.target = element;
      validateOpts(options);
      $.extend(defaultOpts, options);
      this.api = {
        'create': defaultOpts['create'],
        'delete': defaultOpts['delete']
      };
      this.t = defaultOpts['t'];
      this.attrname = defaultOpts['attrname'];
      
      // System constants
      this.statuses = {
        'pending':  this.t('Awaiting review'),
        'approved': this.t('Amendment approved'),
        'rejected': this.t('Amendment rejected')
      };
      this.dmp = new diff_match_patch();
      
      // Preprocess data
      var data = {};
      for (var i in json) {
        // Initialize list
        if (!data[json[i]['reference']]) {
          data[json[i]['reference']] = [];
        }
        // Add element
        data[json[i]['reference']].push(json[i]);
      }
      
      // Start amendments system
      this.initHtml(data);
      this.initEvents();
    }
    
    /**
     * Initialize HTML
     * 
     * TODO Iterate amendments and use data-reference to add them to p
     */
    AmendManager.prototype.initHtml = function(data) {
      
      var self = this;
      
      // Add amendments to original text
      
      $('*[' + this.attrname + ']', this.target).each(function() {
        
        var ref = $(this).attr(self.attrname);
        
        if (data[ref] !== undefined) {
          self.renderAmendments(this, data[ref]);
        }
      });
    };
    
    /**
     * Render amendment
     */
    AmendManager.prototype.renderAmendments = function(node, list) {
      // Basic checks
      if (!list instanceof Array || !list.length) {
        return;
      }
      
      var $node = $(node),
          original = $node.html(),
          $container = $node.next(),
          $counter = $('.show-amendments', $container),
          $div = $('.amendments', $container),
          $ul;
          
      if (!$container.hasClass('amendments-container')) {
        // Build actions container
        $container = $('<div>', {
          'class': 'amendments-container'
        });
        
        // Build link
        $counter = $('<a>', {
          'href': '#',
          'class': 'show-amendments closed'
        });
        
        // Build amendments list
        $div = $('<div>', {
          'class': 'amendments'
        }).hide();
        
        // Manage events
        $counter.click(function(event) {
          $(this).toggleClass('opened').toggleClass('closed');
          $($div).slideToggle();
          // Avoid follow            
          event.preventDefault();
          return false;
        });
        
        // Add new elements
        $node.after($container.append($counter).append($div));
      }
      
      // Render amendments

      for (var i in list) {
        
        $ul = $('<ul>', {
          'class': 'amendment'
        }).append($('<li>', {
          'class': 'amendment-text',
          'html': this.renderTextDiff(original, list[i]['amendment'])
        }));
        
        if (!this.isEmpty(list[i]['reason'])) {
          $ul.append($('<li>', {
            'class': 'amendment-reason',
            'html': '<span>' + this.t('Reason') + ':</span> ' + 
                      list[i]['reason']
          }));
        }
        
        $ul.append($('<li>', {
          'class': 'amendment-author',
          'html': '<span>' + this.t('sent by') + ' </span> ' + 
                    (this.isEmpty(list[i]['author']) ? this.t('anonymous') 
                      : list[i]['author'])
        })).append($('<li>', {
          'class': 'amendment-status ' + list[i]['status'],
          'html': this.statuses[list[i]['status']]
        }));
        
        $div.append($ul);
      }
      
      // Update counter
      var count = $div.children().length;
      $counter.html(count + ' ' + 
        (count === 1 ? this.t('amendment') : this.t('amendments')));
    };
    
    /**
     * Initialize events
     */
    AmendManager.prototype.initEvents = function() {
      var self = this;
      
      // Add amendment
      $('*[' + this.attrname + ']', this.target).click(function() {
        self.renderUpdateForm(this, true);
      });
    };
    
    /**
     * Modify an existing text
     */
    AmendManager.prototype.renderUpdateForm = function(node) {
      // Get previous data
      var $node = $(node),
          original = $node.html();
          
      // Build new form
      var $amendForm = $('<form>', {
        'action': '#',
        'class': 'add-amendment-form'
      }).append($('<textarea>', {
        'name': 'amendment',
        'html': original,
        'style': 'height:' + ($node.height()+10) + 'px',
        'class': 'amendment-textarea'
      })).append($('<input>', {
        'name': 'submit',
        'value': this.t('Send'),
        'type': 'button',
        'class': 'amendment-submit'
      })).append($('<input>', {
        'name': 'cancel',
        'value': this.t('Cancel'),
        'type': 'button',
        'class': 'amendment-cancel'
      })).append($('<input>', {
        'name': 'delete',
        'value': this.t('Delete text'),
        'type': 'button',
        'class': 'amendment-delete'
      }));
 
      // Render new form
      $node.hide().after($amendForm);
      $('textarea', $amendForm).focus();

      // Add form events
      var self = this;
      
      $('.amendment-submit', $amendForm).click(function(event) {
        // Build confirmation form
        self.renderConfirmationForm(node, $amendForm);
        // Avoid submit
        event.preventDefault();
        return false;
      });

      $('.amendment-cancel', $amendForm).click(function(event) {
        // Reset
        $amendForm.remove();
        $node.show();
        // Avoid submit
        event.preventDefault();
        return false;
      });

      $('.amendment-delete', $amendForm).click(function(event) {
        // Build confirmation form
        $('textarea', $amendForm).val("");
        self.renderConfirmationForm(node, $amendForm);
        // Avoid submit
        event.preventDefault();
        return false;
      });
    };
    
    /**
     * Confirm amendment
     */
    AmendManager.prototype.renderConfirmationForm = function(node, $oldForm) {
      // Get previous data
      var $node = $(node),
          original = $node.html(),
          data = this.getFormData($oldForm);
      
      // Build new form
      var $confirmForm = $('<form>', {
        'action': '#',
        'class': 'confirm-amend'
      }).append($('<div>', {
        'html': this.renderTextDiff(original, data['amendment']),
        'class': 'amendment-textarea'
      })).append($('<label>', {
        'for': 'reason',
        'html': this.t('Reason'),
        'class': 'amendment-label'
      })).append($('<textarea>', {
        'name': 'reason',
        'class': 'amendment-textarea'
      })).append($('<label>', {
        'for': 'author',
        'html': this.t('Name'),
        'class': 'amendment-label'
      })).append($('<input>', {
        'name': 'author',
        'type': 'text',
        'class': 'amendment-input'
      })).append($('<input>', {
        'name': 'submit',
        'value': this.t('Confirm'),
        'type': 'button',
        'class': 'amendment-submit'
      })).append($('<input>', {
        'name': 'cancel',
        'value': this.t('Cancel'),
        'type': 'button',
        'class': 'amendment-cancel'
      }));
      
      // Render new form
      $oldForm.before($confirmForm).remove();
      $('textarea', $confirmForm).focus();
      
      // Add form events
      var self = this;

      var close = function() {
        $confirmForm.remove();
        $node.show();        
      };
      
      $('.amendment-submit', $confirmForm).click(function(event) {
        // Create amendment
        $.extend(data, self.getFormData($confirmForm));
        data['reference'] = $node.attr(self.attrname);
        data['status'] = 'pending';
        self.api.create(data, function() {
          // Reset
          close();
          // Add amendment
          self.renderAmendments(node, [data]);
        });
        // Avoid submit
        event.preventDefault();
        return false;
      });

      $('.amendment-cancel', $confirmForm).click(function(event) {
        // Reset
        close();
        // Avoid submit
        event.preventDefault();
        return false;
      });
    };

    /**
     * Get form data
     */
    AmendManager.prototype.getFormData = function($form) {
      var data = {}, params = $form.serializeArray();
      for (var i in params) {
        data[params[i]['name']] = params[i]['value'];
      }
      return data;
    };
    
    /**
     * Render text diff
     */
    AmendManager.prototype.renderTextDiff = function(original, amendment) {
      var diff = this.dmp.diff_main(original, amendment);
      this.dmp.diff_cleanupSemantic(diff);
      return this.dmp.diff_prettyHtml(diff);
    };
    
    /**
     * Var empty?
     */
    AmendManager.prototype.isEmpty = function(variable) {    
      return variable === undefined || variable === ""; 
    };
    
    return AmendManager;

  })();


  $.fn["amend"] = function (options, data) {
    if (!$.data(this, "amend")) {
      $.data(this, "amend", new AmendManager(this, options, data));
    } else {
      console.log('Amendments system already initialized on this node!', this);
    }
  };

}(window,document,jQuery));
