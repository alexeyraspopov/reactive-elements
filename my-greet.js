function GreetViewModel(vm){
	// vm.greetPerson = attr('data-greet-person')

	vm.mapped = vm.greetPerson.map(function(value){
		value + '_mapped';
	});
}

MyGreet = XElement({
	viewModel: GreetViewModel
});