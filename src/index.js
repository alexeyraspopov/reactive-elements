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