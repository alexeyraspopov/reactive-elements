(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* jshint browser:true */
'use strict';

function createTreeWalker(root, acceptNode, whatToShow){
	acceptNode = acceptNode || function(){ return NodeFilter.FILTER_ACCEPT; };
	whatToShow = whatToShow || NodeFilter.SHOW_ELEMENT;

	return document.createTreeWalker(root, whatToShow, { acceptNode: acceptNode }, false);
}

function createIterator(walker, next){
	return function iterator(direction){
		var node = direction === 'sibling' ? walker.nextSibling() : walker.nextNode();

		return next(node, iterator);
	};
}

module.exports = function(root, process, options){
	var walker;

	options = options || {};
	walker = createTreeWalker(root, options.acceptNode, options.whatToShow);

	function next(node, iterator){
		return node && process(node, iterator);
	}

	next(walker.currentNode, createIterator(walker, next));
};

},{}],2:[function(require,module,exports){

/**
 * FastDom
 *
 * Eliminates layout thrashing
 * by batching DOM read/write
 * interactions.
 *
 * @author Wilson Page <wilsonpage@me.com>
 */

;(function(fastdom){

  'use strict';

  // Normalize rAF
  var raf = window.requestAnimationFrame
    || window.webkitRequestAnimationFrame
    || window.mozRequestAnimationFrame
    || window.msRequestAnimationFrame
    || function(cb) { return window.setTimeout(cb, 1000 / 60); };

  // Normalize cAF
  var caf = window.cancelAnimationFrame
    || window.cancelRequestAnimationFrame
    || window.mozCancelAnimationFrame
    || window.mozCancelRequestAnimationFrame
    || window.webkitCancelAnimationFrame
    || window.webkitCancelRequestAnimationFrame
    || window.msCancelAnimationFrame
    || window.msCancelRequestAnimationFrame
    || function(id) { window.clearTimeout(id); };

  /**
   * Creates a fresh
   * FastDom instance.
   *
   * @constructor
   */
  function FastDom() {
    this.frames = [];
    this.lastId = 0;

    // Placing the rAF method
    // on the instance allows
    // us to replace it with
    // a stub for testing.
    this.raf = raf;

    this.batch = {
      hash: {},
      read: [],
      write: [],
      mode: null
    };
  }

  /**
   * Adds a job to the
   * write batch and schedules
   * a new frame if need be.
   *
   * @param  {Function} fn
   * @api public
   */
  FastDom.prototype.read = function(fn, ctx) {
    var job = this.add('read', fn, ctx);
    var id = job.id;

    // Add this job to the read queue
    this.batch.read.push(job.id);

    // We should *not* schedule a new frame if:
    // 1. We're 'reading'
    // 2. A frame is already scheduled
    var doesntNeedFrame = this.batch.mode === 'reading'
      || this.batch.scheduled;

    // If a frame isn't needed, return
    if (doesntNeedFrame) return id;

    // Schedule a new
    // frame, then return
    this.scheduleBatch();
    return id;
  };

  /**
   * Adds a job to the
   * write batch and schedules
   * a new frame if need be.
   *
   * @param  {Function} fn
   * @api public
   */
  FastDom.prototype.write = function(fn, ctx) {
    var job = this.add('write', fn, ctx);
    var mode = this.batch.mode;
    var id = job.id;

    // Push the job id into the queue
    this.batch.write.push(job.id);

    // We should *not* schedule a new frame if:
    // 1. We are 'writing'
    // 2. We are 'reading'
    // 3. A frame is already scheduled.
    var doesntNeedFrame = mode === 'writing'
      || mode === 'reading'
      || this.batch.scheduled;

    // If a frame isn't needed, return
    if (doesntNeedFrame) return id;

    // Schedule a new
    // frame, then return
    this.scheduleBatch();
    return id;
  };

  /**
   * Defers the given job
   * by the number of frames
   * specified.
   *
   * If no frames are given
   * then the job is run in
   * the next free frame.
   *
   * @param  {Number}   frame
   * @param  {Function} fn
   * @api public
   */
  FastDom.prototype.defer = function(frame, fn, ctx) {

    // Accepts two arguments
    if (typeof frame === 'function') {
      ctx = fn;
      fn = frame;
      frame = 1;
    }

    var self = this;
    var index = frame - 1;

    return this.schedule(index, function() {
      self.run({
        fn: fn,
        ctx: ctx
      });
    });
  };

  /**
   * Clears a scheduled 'read',
   * 'write' or 'defer' job.
   *
   * @param  {Number} id
   * @api public
   */
  FastDom.prototype.clear = function(id) {

    // Defer jobs are cleared differently
    if (typeof id === 'function') {
      return this.clearFrame(id);
    }

    var job = this.batch.hash[id];
    if (!job) return;

    var list = this.batch[job.type];
    var index = list.indexOf(id);

    // Clear references
    delete this.batch.hash[id];
    if (~index) list.splice(index, 1);
  };

  /**
   * Clears a scheduled frame.
   *
   * @param  {Function} frame
   * @api private
   */
  FastDom.prototype.clearFrame = function(frame) {
    var index = this.frames.indexOf(frame);
    if (~index) this.frames.splice(index, 1);
  };

  /**
   * Schedules a new read/write
   * batch if one isn't pending.
   *
   * @api private
   */
  FastDom.prototype.scheduleBatch = function() {
    var self = this;

    // Schedule batch for next frame
    this.schedule(0, function() {
      self.batch.scheduled = false;
      self.runBatch();
    });

    // Set flag to indicate
    // a frame has been scheduled
    this.batch.scheduled = true;
  };

  /**
   * Generates a unique
   * id for a job.
   *
   * @return {Number}
   * @api private
   */
  FastDom.prototype.uniqueId = function() {
    return ++this.lastId;
  };

  /**
   * Calls each job in
   * the list passed.
   *
   * If a context has been
   * stored on the function
   * then it is used, else the
   * current `this` is used.
   *
   * @param  {Array} list
   * @api private
   */
  FastDom.prototype.flush = function(list) {
    var id;

    while (id = list.shift()) {
      this.run(this.batch.hash[id]);
    }
  };

  /**
   * Runs any 'read' jobs followed
   * by any 'write' jobs.
   *
   * We run this inside a try catch
   * so that if any jobs error, we
   * are able to recover and continue
   * to flush the batch until it's empty.
   *
   * @api private
   */
  FastDom.prototype.runBatch = function() {
    try {

      // Set the mode to 'reading',
      // then empty all read jobs
      this.batch.mode = 'reading';
      this.flush(this.batch.read);

      // Set the mode to 'writing'
      // then empty all write jobs
      this.batch.mode = 'writing';
      this.flush(this.batch.write);

      this.batch.mode = null;

    } catch (e) {
      this.runBatch();
      throw e;
    }
  };

  /**
   * Adds a new job to
   * the given batch.
   *
   * @param {Array}   list
   * @param {Function} fn
   * @param {Object}   ctx
   * @returns {Number} id
   * @api private
   */
  FastDom.prototype.add = function(type, fn, ctx) {
    var id = this.uniqueId();
    return this.batch.hash[id] = {
      id: id,
      fn: fn,
      ctx: ctx,
      type: type
    };
  };

  /**
   * Runs a given job.
   *
   * Applications using FastDom
   * have the options of setting
   * `fastdom.onError`.
   *
   * This will catch any
   * errors that may throw
   * inside callbacks, which
   * is useful as often DOM
   * nodes have been removed
   * since a job was scheduled.
   *
   * Example:
   *
   *   fastdom.onError = function(e) {
   *     // Runs when jobs error
   *   };
   *
   * @param  {Object} job
   * @api private
   */
  FastDom.prototype.run = function(job){
    var ctx = job.ctx || this;
    var fn = job.fn;

    // Clear reference to the job
    delete this.batch.hash[job.id];

    // If no `onError` handler
    // has been registered, just
    // run the job normally.
    if (!this.onError) {
      return fn.call(ctx);
    }

    // If an `onError` handler
    // has been registered, catch
    // errors that throw inside
    // callbacks, and run the
    // handler instead.
    try { fn.call(ctx); } catch (e) {
      this.onError(e);
    }
  };

  /**
   * Starts of a rAF loop
   * to empty the frame queue.
   *
   * @api private
   */
  FastDom.prototype.loop = function() {
    var self = this;
    var raf = this.raf;

    // Don't start more than one loop
    if (this.looping) return;

    raf(function frame() {
      var fn = self.frames.shift();

      // If no more frames,
      // stop looping
      if (!self.frames.length) {
        self.looping = false;

      // Otherwise, schedule the
      // next frame
      } else {
        raf(frame);
      }

      // Run the frame.  Note that
      // this may throw an error
      // in user code, but all
      // fastdom tasks are dealt
      // with already so the code
      // will continue to iterate
      if (fn) fn();
    });

    this.looping = true;
  };

  /**
   * Adds a function to
   * a specified index
   * of the frame queue.
   *
   * @param  {Number}   index
   * @param  {Function} fn
   * @return {Function}
   */
  FastDom.prototype.schedule = function(index, fn) {

    // Make sure this slot
    // hasn't already been
    // taken. If it has, try
    // re-scheduling for the next slot
    if (this.frames[index]) {
      return this.schedule(index + 1, fn);
    }

    // Start the rAF
    // loop to empty
    // the frame queue
    this.loop();

    // Insert this function into
    // the frames queue and return
    return this.frames[index] = fn;
  };

  // We only ever want there to be
  // one instance of FastDom in an app
  fastdom = fastdom || new FastDom();

  /**
   * Expose 'fastdom'
   */

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = fastdom;
  } else if (typeof define === 'function' && define.amd) {
    define(function(){ return fastdom; });
  } else {
    window['fastdom'] = fastdom;
  }

})(window.fastdom);

},{}],3:[function(require,module,exports){
'use strict';
var newsletter = require('newsletter');

function observable(value){
	var cell, subscription = newsletter();

	cell = function(newValue){
		if(arguments.length){
			value = newValue;
			subscription.publish(value);
		}

		return value;
	};

	cell.subscribe = subscription.subscribe;

	cell.bind = function(continuation){
		cell.subscribe(continuation);
		continuation(value);

		return continuation;
	};

	cell.map = function(morphism){
		var mapped = observable();



		cell.subscribe(function(value){
			return mapped(morphism(value));
		});

		return mapped;
	};

	cell.filter = function(predicate){
		var filtered = observable();

		if(typeof value !== 'undefined' && predicate(value)){
			filtered(value);
		}

		cell.subscribe(function(value){
			return predicate(value) && filtered(value);
		});

		return filtered;
	};

	cell.toString = function(){
		return 'Observable(' + value + ')';
	};

	return cell;
}

module.exports = observable;

},{"newsletter":4}],4:[function(require,module,exports){
'use strict';

function unsubscribe(subscribers, callback){
	return function(){
		var index = subscribers.indexOf(callback);

		if(index > -1){
			subscribers.splice(index, 1);
		}
	};
}

function noop(){}

module.exports = function(){
	var subscribers = [];

	return {
		subscribe: function(callback){
			if(subscribers.indexOf(callback) < 0){
				subscribers.unshift(callback);

				return unsubscribe(subscribers, callback);
			}

			return noop;
		},
		publish: function(data){
			var index = subscribers.length;

			while(--index >= 0){
				subscribers[index](data);
			}
		}
	};
};

},{}],5:[function(require,module,exports){
'use strict';

var fastdom = require('fastdom');

exports.attributes = function(node, viewModel){
	Object.keys(node.dataset).forEach(function(attr){
		var model = node.dataset[attr];

		// todo: check observable existence
		viewModel[model].bind(function(value){
			fastdom.write(function(){
				// todo: update correct attr (data-*)?
				node.setAttribute(attr, value);
			});
		});
	});
};

exports.content = function(node, viewModel){
	var key = node.textContent.trim(),
		text = document.createTextNode('');

	// todo: check observable existence
	viewModel[key].bind(function(value){
		fastdom.write(function(){
			text.textContent = value;
		});
	});

	fastdom.write(function(){
		node.parentNode.insertBefore(text, node);
		node.parentNode.removeChild(node);
	});
};

},{"fastdom":2}],6:[function(require,module,exports){
// todo: class binding
// todo: two-way binding
// todo: events
var data = require('observable'),
	walk = require('dom-walker'),
	binding = require('./binding');

var View = {
	attributes: data(),
	attr: function(name){
		return this.attributes.filter(function(attr){
			return attr.name === name;
		}).map(function(attr){
			return attr.value;
		});
	},
	data: data
};

function elementTemplate(){
	var elementDoc = document.currentScript.ownerDocument,
		template = elementDoc.querySelector('template').content;

	return template;
}

function registerElement(tagName, options){
	var Element = Object.create(HTMLElement.prototype),
		template = elementTemplate();

	Element.createdCallback = function(){
		var shadow = this.createShadowRoot(),
			content = document.importNode(template, true);

		shadow.appendChild(content);

		this.viewModel = Object.create(null);
		this.view = Object.create(View, { attributes: { value: data() } });

		options.viewModel(this.viewModel, this.view);

		Array.prototype.slice.call(this.attributes).forEach(this.view.attributes);
	};

	Element.attachedCallback = function(){
		var root = this.shadowRoot,
			viewModel = this.viewModel;

		walk(root, function(node, next){
			if(node instanceof HTMLElement && node !== root){
				binding.attributes(node, viewModel);
			}

			if(node instanceof Comment){
				binding.content(node, viewModel);
			}

			next();
		}, { whatToShow: NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_COMMENT });
	};

	Element.detachedCallback = function(){
		// destroy all this shit
	};

	Element.attributeChangedCallback = function(attr){
		this.view.attributes(this.attributes[attr]);
	};

	return document.registerElement(tagName, { prototype: Element });
}

window.ReactiveElement = registerElement;
},{"./binding":5,"dom-walker":1,"observable":3}]},{},[6]);
