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
