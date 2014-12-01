// todo: class binding
// todo: two-way binding
// todo: events
var data = require('observable'),
	walk = require('dom-walker'),
	fastdom = require('fastdom');

function registerElement(tagName, options){
	var Element = Object.create(HTMLElement.prototype),
		elementDoc = document.currentScript.ownerDocument,
		template = elementDoc.querySelector('template').content;

	Element.createdCallback = function(){
		var shadow = this.createShadowRoot(),
			content = document.importNode(template, true);

		shadow.appendChild(content);

		this.vm = Object.keys(this.dataset).reduce(function(vm, key){
			vm[key] = data(this.dataset[key]);
			return vm;
		}.bind(this), {});

		options.viewModel(this.vm);
	};

	Element.attachedCallback = function(){
		var root = this.shadowRoot,
			vm = this.vm;

		walk(root, function(node, next){
			if(node instanceof HTMLElement && node !== root){
				Object.keys(node.dataset).forEach(function(attr){
					var model = node.dataset[attr];

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
		if(/^data-/.test(attr)){
			this.vm[attr.split('-').slice(1).join('-').replace(/\-(.)/g, function(_, letter){
				return letter.toUpperCase();
			})](newValue);
		}
	};

	return document.registerElement(tagName, { prototype: Element });
}

window.ReactiveElement = registerElement;