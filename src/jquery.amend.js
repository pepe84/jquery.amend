/**
 * jquery.amend.js is a plugin to manage amendments for any text divided 
 * into clearly identified parts (using custom attribute). It requires a 
 * persistance system to store data and google-diff-match-patch library 
 * (http://code.google.com/p/google-diff-match-patch/) to visualize amendments.
 * 
 * Plugin configuration must cointain the following properties to work properly:
 *
 * - create: function(params, callback) to save a new amendment
 * 
 * These are optional:
 * 
 * - t: function(text) to translate statuses and other stuff
 * - attrname: html attribute containing text id ("data-reference" by default)
 * - index: selector to attach original text index (using headers with id)
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
    'delete': null, // TODO
    't': function(text) { return text; },
    'attrname': 'data-reference',
    'index': null
  };

  validateOpts = function(options) {
    if (!(options && $.isPlainObject(options))) {
      return false;
    }
    $.each(options, function(name) {
      if (defaultOpts[name] === undefined) {
        return error('Unknown option: "' + name + '"');
      } else if ($.inArray(name, ['create', 'delete', 't']) !== -1 && 
          !$.isFunction(options[name])) {
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
        'delete': defaultOpts['delete'] // TODO
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
      
      // Optional index (before manipulating DOM)
      if (!this.isEmpty(defaultOpts['index'])) {
        this.renderIndex(defaultOpts['index']);
      }
      
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
          original = $node.text(),
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
          'html': list[i]['extra'] ? 
                  '<span class="plus">[+]</span> ' + list[i]['amendment'] 
                  : this.renderTextDiff(original, list[i]['amendment'])
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
      
      $('*[' + this.attrname + ']', this.target).each(function() {
        
        var node = this,
            original = node.innerHTML;
        
        // Add new text
        if ($(node).is(':header[id]')) {
          $(node)
            .empty()
            .append($('<span>', {
              'class': 'original-text',
              'html': original
            }))
            .append($('<a>', {
              'href': '#',
              'class': 'add-new-text',
              'html': self.t('+')
            }).click(function(event) {
              self.renderForm(node, true);
              // Avoid follow
              event.preventDefault();
              return false;
            }));
        } else {
          $(node).addClass('original-text');
        }
        
        // Add amendment
        $(node).click(function(event) {
            self.renderForm(node, false);
            // Avoid follow
            event.preventDefault();
            return false;
        });
      });
    };
    
    /**
     * Modify an existing text or create a new one
     */
    AmendManager.prototype.renderForm = function(node, extra) {
      // Get previous data
      var $node = $(node),
          original = this.getOriginalText(node);
      
      // Build new form
      var $amendForm = $('<form>', {
        'action': '#',
        'class': 'amendment-form'
      }).append($('<textarea>', {
        'name': 'amendment',
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
      }));
 
      // Form submit
      var self = this;
      
      var submit = function(event, deleteButton) {
        var value = $('textarea', $amendForm).val();
        if ((!self.isEmpty(value) && value !== original) || deleteButton) {
          // Build confirmation form
          self.renderConfirmationForm(node, extra, $amendForm);
        }
        // Avoid submit
        event.preventDefault();
        return false;
      };
 
      // Render new form
      if (extra) {
        $amendForm.prepend($('<label>', {
          'for': 'amendment',
          'html': '<span>' + this.t('Add new text inside') + '</span> ' 
                  + original,
          'class': 'amendment-label'
        }));
      } else {
        $node.hide();
        $('textarea', $amendForm)
          .html(original)
          .css('height', ($node.height()+20) + 'px')
          .focus();
        $amendForm.append($('<input>', {
          'name': 'delete',
          'value': this.t('Delete text'),
          'type': 'button',
          'class': 'amendment-delete'
        }).click(function(event) {
          // Delete event
          $('textarea', $amendForm).val("");
          submit(event, true);
        }));
      }
      
      $node.after($amendForm);
      
      // Submit event
      $amendForm.submit(submit);
      $('.amendment-submit', $amendForm).click(submit);
      
      // Cancel event
      $('.amendment-cancel', $amendForm).click(function(event) {
        // Reset
        $amendForm.remove();
        $node.show();
        // Avoid submit
        event.preventDefault();
        return false;
      });
    };
    
    /**
     * Confirm amendment
     */
    AmendManager.prototype.renderConfirmationForm = function(node, extra, $oldForm) {
      // Get previous data
      var $node = $(node),
          original = this.getOriginalText(node),
          data = this.getFormData($oldForm);
      
      // Build new form
      var $confirmForm = $('<form>', {
        'action': '#',
        'class': 'amendment-form'
      }).append($('<label>', {
        'for': 'amendment',
        'html': this.t('Amendment'),
        'class': 'amendment-label'
      })).append($('<div>', {
        'html': extra ? data['amendment'] 
                : this.renderTextDiff(original, data['amendment']),
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
      
      // Form events
      var self = this;

      var submit = function(event) {
        // Create amendment
        $.extend(data, self.getFormData($confirmForm));
        data['reference'] = $node.attr(self.attrname);
        data['extra'] = extra;
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
      };

      var close = function() {
        $confirmForm.remove();
        $node.show();        
      };
      
      // Submit event
      $confirmForm.submit(submit);
      $('.amendment-submit', $confirmForm).click(submit);
      
      // Cancel event
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

    /**
     * Get original text
     */
    AmendManager.prototype.getOriginalText = function(node) {
      var text = node.innerHTML;
      $('span', node).each(function(){
        text = this.innerHTML;
      });      
      return text;
    };
    
    /**
     * Render index
     */
    AmendManager.prototype.renderIndex = function(selector) {
      var self = this;
      
      $(selector).append(
        $(':header[id]', this.target)
          .clone()
          .each(function() {
            $(this).html(
              '<a href="#' + this.id + '">' + this.innerHTML + '</a>'
            )
            .removeAttr('id')
            .removeAttr(self.attrname);
          })
      );
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
