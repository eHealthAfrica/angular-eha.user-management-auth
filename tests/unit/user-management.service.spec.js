'use strict'

describe('eha.user-management-auth.service', function() {


  var service;
  var $timeout;
  var $httpBackend;
  var $rootScope;
  var $http;
  var instanceVersion = 0;
  var config;
  var $q;
  var $window = { location: {} };

  var triggerDigests = function() {
    return setInterval(function() {
      $rootScope.$digest();
    }, 10);
  };
  var stopDigests = function(interval) {
    window.clearInterval(interval);
  };

  describe('the regular services', function () {
    beforeEach(module(function ($provide) {
      $provide.value('$window', $window)
    }))

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

    beforeEach(inject(function(
      ehaUserManagementAuthService,
      _$timeout_,
      _$httpBackend_,
      _$rootScope_,
      _$http_,
      _$q_
    ) {

      service = ehaUserManagementAuthService;
      $timeout = _$timeout_;
      $httpBackend = _$httpBackend_;
      $rootScope = _$rootScope_;
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
      describe('logout', function () {
        it('navigates the user to the user management', function () {
          $window.location.assign = sinon.spy()
          service.logout()
          expect($window.location.assign.calledOnce)
          expect($window.location.assign.getCall(0).args[0]).to.equal('/logout')
        })
      })
    })
  });
  describe('the auth provider', function () {
    it('is defined', module(function (ehaUserManagementAuthServiceProvider) {
      expect(ehaUserManagementAuthServiceProvider).to.be.defined
    }))
    it('can be configured', module(function (ehaUserManagementAuthServiceProvider) {
      ehaUserManagementAuthServiceProvider.config({
        url: 'http://localhost:5000',
        localStorageNamespace: 'mnutrition-app'
      })
    }))
  })
});
