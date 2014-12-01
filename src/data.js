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

function newsletter(){
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

function observable(value){
	var cell, subscription = newsletter(value);

	cell = function(newValue){
		if(arguments.length){
			value = newValue;
			subscription.publish(value);
		}

		return value;
	};

	cell.subscribe = subscription.subscribe;

	cell.bind = function(observable){
		cell.subscribe(observable);
		observable(value);

		return observable;
	};

	cell.map = function(morphism){
		var mappedObservable = observable(morphism(value));

		cell.subscribe(function(value){
			return mappedObservable(morphism(value));
		});

		return mappedObservable;
	};

	cell.filter = function(predicate){
		var filteredObservable = predicate(value) ? observable(value) : observable();

		cell.subscribe(function(value){
			return predicate(value) && filteredObservable(value);
		});

		return filteredObservable;
	};

	cell.toString = function(){
		return 'Data(' + value + ')';
	};

	return cell;
}

module.exports = observable;
