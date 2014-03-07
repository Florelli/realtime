// script.js

	function ServerMessenger ($rootScope, socket, supportedEvents) {
		this.$rootScope = $rootScope;
		this._socket = socket;
		this.events = {
			notif: []
		};
		if (typeof supportedEvents !== 'undefined' && supportedEvents instanceof Array) {
			for (var i = supportedEvents.length; i--;) {
				this.subscribeSocketTo(supportedEvents[i]);
			}
		}
	}
	ServerMessenger.prototype.subscribeSocketTo = function (eventName) {
		var self = this;
		this._socket.on(eventName, function (content) {
			var args = arguments;
			self.$rootScope.$apply(function () {
				self.$rootScope.$broadcast(eventName, content);
			});
		});
	};

	angular.module('lbaSocket', [])
	.value('socket', io.connect())
	.provider('serverMessenger', function ServerMessengerProvider () {
		var supportedEvents = [];
		this.setSupportedEvents = function (eventsArray) {
			supportedEvents = eventsArray;
		};

		this.$get = ['socket', '$injector', function (socket, $injector) {
			return new ServerMessenger($injector.get('$rootScope'), socket, supportedEvents);
		}];
	});

	var realtimeApp = angular.module('RealtimeApp', ['ngRoute', 'ngAnimate', 'lbaSocket']).
	filter('htmlToPlaintext', function() {
		return function(text) {
			return String(text).replace(/<(?:.|\n)*?>/gm, '');
		}
	});
	// create the controller and inject Angular's $scope
	realtimeApp.controller('HeaderController', ['$scope', '$rootScope', '$route', 'serverMessenger', function ($scope, $rootScope, $route) {
		$scope.msgNotifCount = 0;
		$rootScope.$on('$routeChangeSuccess', function() {
			$rootScope.page_title = $route.current.title+($scope.msgNotifCount > 0 ? ' ('+$scope.msgNotifCount+')' : '');
		});
		$scope.$on('notif', function (evt, notif) {
			console.log('notif');
			$scope.msgNotifCount++;
			$rootScope.page_title = $route.current.title+($scope.msgNotifCount > 0 ? ' ('+$scope.msgNotifCount+')' : '');
		});
		$scope.resetCounter = function () {
			$scope.msgNotifCount = 0;
			$rootScope.page_title = $route.current.title+($scope.msgNotifCount > 0 ? ' ('+$scope.msgNotifCount+')' : '');
		};
	}]);

	// create the controller and inject Angular's $scope
	realtimeApp.controller('WallController', ['$scope', 'serverMessenger', function ($scope) {
		$scope.title = 'Recent LBA events';
		$scope.flashinfos = [{
			type:'NEW_MESSAGE',
			title:'message title 2',
			content: 'This is a fake event for the test',
			link: '#',
			date: new Date()
		}, {
			type:'NEW_MESSAGE',
			title:'message title',
			content: 'This is a fake event for the test',
			link: '#',
			date: new Date()
		}];
		$scope.$on('notif', function (evt, notif) {
			$scope.flashinfos.unshift(notif);
		});
	}]);

	realtimeApp.directive('flashinfo', function () {
		return {
			restrict:'E',
			templateUrl: 'partials/flashinfo.html',
			link: function () {
			}
		}
	});

	realtimeApp.config(['$routeProvider', 'serverMessengerProvider', function($routeProvider, $serverMessengerProvider) {
		$serverMessengerProvider.setSupportedEvents(['notif']);

		$routeProvider
		// route for the home page
		.when('/', {
			templateUrl : 'partials/wall.html',
			controller  : 'WallController',
			title: 'Wall'
		})
		.otherwise({
			redirectTo: '/'
		});
	}]);

