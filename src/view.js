var data = require('observable');

// should be provided
exports.attributes = null;
exports.root = null;

exports.attr = function(name){
	return this.attributes.filter(function(attr){
		return attr.name === name;
	}).map(function(attr){
		return attr.value;
	});
};

exports.event = function(elementName, eventName){
	var element = this.root.querySelector('[name="' + elementName + '"]'),
		eventStream = data();

	element.addEventListener(eventName, eventStream, false);

	return eventStream;
};

exports.data = data;