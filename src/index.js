// todo: class binding
// todo: two-way binding
// todo: events
var data = require('observable'),
	walk = require('dom-walker'),
	fastdom = require('fastdom');

function elementTemplate(){
	var elementDoc = document.currentScript.ownerDocument,
		template = elementDoc.querySelector('template').content;

	return template;
}

function registerElement(tagName, options){
	var Element = Object.create(HTMLElement.prototype),
		template = elementTemplate(),
		view = {}, attributes = data();

	view.attr = function(attribute){
		return attributes.filter(function(attr){
			return attr && attr.name === attribute;
		}).map(function(attr){
			// fixme: correct observable mapping
			return attr && attr.value;
		});
	};

	Element.createdCallback = function(){
		var shadow = this.createShadowRoot(),
			content = document.importNode(template, true);

		shadow.appendChild(content);

		this.vm = {};

		options.viewModel(this.vm, view);

		Array.prototype.slice.call(this.attributes).forEach(attributes);
	};

	Element.attachedCallback = function(){
		var root = this.shadowRoot,
			vm = this.vm;

		walk(root, function(node, next){
			if(node instanceof HTMLElement && node !== root){
				Object.keys(node.dataset).forEach(function(attr){
					var model = node.dataset[attr];

					// todo: check observable existence
					vm[model].bind(function(value){
						fastdom.write(function(){
							// todo: update correct attr (data-*)?
							node.setAttribute(attr, value);
						});
					});
				});
			}

			if(node instanceof Comment){
				var key = node.textContent.trim(),
					text = document.createTextNode('');

				// todo: check observable existence
				vm[key].bind(function(value){
					fastdom.write(function(){
						text.textContent = value;
					});
				});

				fastdom.write(function(){
					node.parentNode.insertBefore(text, node);
					node.parentNode.removeChild(node);
				});
			}

			next();
		}, { whatToShow: NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_COMMENT });
	};

	Element.detachedCallback = function(){
		// destroy all this shit
	};

	Element.attributeChangedCallback = function(attr, oldValue, newValue){
		attributes(this.attributes[attr]);
	};

	return document.registerElement(tagName, { prototype: Element });
}

window.ReactiveElement = registerElement;