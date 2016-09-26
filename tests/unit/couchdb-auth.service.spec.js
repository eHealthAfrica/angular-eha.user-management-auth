describe('eha.user-management-auth.service', function() {
  'use strict';

  var service;
  var $timeout;
  var $httpBackend;
  var $rootScope;
  var $localForage;
  var $http;
  var instanceVersion = 0;
  var config;
  var $q;

  var triggerDigests = function() {
    return setInterval(function() {
      $rootScope.$digest();
    }, 10);
  };
  var stopDigests = function(interval) {
    window.clearInterval(interval);
  };

  beforeEach(module('eha.user-management-auth',
    function(ehaUserManagementAuthServiceProvider, $provide) {
      config = {
        auth: {
          api: {
            url: 'http://localhost:5000'
          }
        }
      };
      ehaUserManagementAuthServiceProvider
        .config({
          url: config.auth.api.url,
          localStorageNamespace: 'mnutrition-app',
        });
    })
  );

  beforeEach(inject(function(ehaUserManagementAuthService,
                             _$timeout_,
                             _$httpBackend_,
                             _$rootScope_,
                             _$localForage_,
                             _$http_,
                             _$q_) {

    service = ehaUserManagementAuthService;
    $timeout = _$timeout_;
    $httpBackend = _$httpBackend_;
    $rootScope = _$rootScope_;
    $localForage = _$localForage_;
    $http = _$http_;
    $q = _$q_;
  }));

  describe('Public API', function() {
    describe('getCurrentUser()', function() {
      var TEST_USER;

      it('should be defined', function() {
        expect(service.getCurrentUser).to.be.defined;
      });

      describe('no currentUser', function() {

        it('should getCurrentUser()', function() {
          $httpBackend.whenGET('http://localhost:5000/_session')
          .respond(true);
          service.getCurrentUser()
          .should.be.rejectedWith('User not found');
        });
      });
    });
  });
});
