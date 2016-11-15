'use strict'

/* this file contains most tests. I moved some tests, specific to
 * providers, to a dedicated file. In the future i can imagine tests
 * being split to more files - francesco, November 2016 */

describe('eha.ums-auth', function() {

  var service;
  var $timeout;
  var $httpBackend;
  var $rootScope;
  var $http;
  var instanceVersion = 0;
  var config;
  var $q;
  var $window = { location: {} };
  var EHA_UMS_AUTH_UNAUTHENTICATED_EVENT;
  var EHA_UMS_AUTH_UNAUTHORISED_EVENT;

  function provideValidSession (done) {
    $httpBackend
      .whenGET('_session')
      .respond({
        userCtx: {
          name: 'franco',
          roles: ['tester']
        }
      });
    service
      .getCurrentUser()
      .finally(done)
    $httpBackend.flush()
  }

  describe('the regular services', function () {

    beforeEach(module(function ($provide) {
      $provide.value('$window', $window)
    }))

    beforeEach(module('eha.ums-auth', function(ehaUMSAuthServiceProvider) {
      config = {
        auth: {
          api: {
            url: 'http://localhost:5000'
          }
        }
      };
      ehaUMSAuthServiceProvider
        .config({
          url: config.auth.api.url,
          localStorageNamespace: 'mnutrition-app',
          userRoles: ['programmer', 'tester', 'troublemaker']
        });
    }))

    beforeEach(inject(function(
      ehaUMSAuthService,
      _$timeout_,
      _$httpBackend_,
      _$rootScope_,
      _$http_,
      _$q_,
      _EHA_UMS_AUTH_UNAUTHENTICATED_EVENT_,
      _EHA_UMS_AUTH_UNAUTHORISED_EVENT_
    ) {

      service = ehaUMSAuthService;
      $timeout = _$timeout_;
      $httpBackend = _$httpBackend_;
      $rootScope = _$rootScope_;
      $http = _$http_;
      $q = _$q_;
      EHA_UMS_AUTH_UNAUTHENTICATED_EVENT = _EHA_UMS_AUTH_UNAUTHENTICATED_EVENT_;
      EHA_UMS_AUTH_UNAUTHORISED_EVENT = _EHA_UMS_AUTH_UNAUTHORISED_EVENT_
    }));

    describe('Public API', function () {
      describe('getCurrentUser()', function () {
        var TEST_USER;

        it('should be defined', function() {
          expect(service.getCurrentUser).to.be.defined;
        });

        it('fails as expected', function(done) {
          $httpBackend.whenGET('_session')
            .respond($q.reject());
          service
            .getCurrentUser()
            .catch(function (err) {
              expect(err).to.equal(EHA_UMS_AUTH_UNAUTHENTICATED_EVENT)
              done()
            })
          $httpBackend.flush()
        });

        it('succeeds as expected', function(done) {
          $httpBackend
            .whenGET('_session')
            .respond({
              userCtx: {
                name: 'franco',
                roles: ['tester', 'programmer']
              }
            });
          service
            .getCurrentUser()
            .then(function (user) {
              expect(user.name).to.equal('franco')
              done()
            })
            .catch(done)
          $httpBackend.flush()
          $httpBackend.verifyNoOutstandingRequest()
          $httpBackend.verifyNoOutstandingExpectation()
        });
        describe('after receiving a valid session', function () {
          beforeEach(provideValidSession)
          it('returns a cached version of the session on the next call', function (done) {
            service
              .getCurrentUser()
              .then(function (u) {
                expect(u.nameGetter()).to.equal('franco')
                done()
              })
          })
          it('can test the user for roles', function (done) {
            service
              .getCurrentUser()
              .then(function (user) {
                expect(user.hasRole('tester')).to.equal(true)
                done()
              })
          })
        })
        describe('logout', function () {
          it('navigates the user to the user management', function () {
            $window.location.assign = sinon.spy()
            service.logout()
            expect($window.location.assign.calledOnce)
            expect($window.location.assign.getCall(0).args[0]).to.equal('/logout')
          })
        })
      })
      describe('anyRoleExcept', function () {
        it('is a function', function () {
          assert.isFunction(service.anyRoleExcept)
        })
        describe('after a valid session', function () {
          beforeEach(provideValidSession)
          it('fails as expected', function (done) {
            service
              .anyRoleExcept('not existent')
              .catch(function (err) {
                assert.equal(err, EHA_UMS_AUTH_UNAUTHORISED_EVENT)
              })
              .finally(done)
          })
          it('tells whether an user has any role except one', function (done) {
            service
              .anyRoleExcept('tester')
              .catch(function (err) {
                expect(err).to.equal(EHA_UMS_AUTH_UNAUTHORISED_EVENT)
                return service.anyRoleExcept('programmer')
              })
              .then(function (authorised) {
                expect(authorised).to.equal(true)
              })
              .catch(function (err) {
                // careful, this error sometimes shows up as if it was
                // thrown during the `beforeEach` hook
                assert.fail(err, undefined, err)
              })
              .finally(done)
          })
        })
      })
      describe('requireUserWithAnyRole', function () {
        beforeEach(provideValidSession)
        it('tells whether an user has any role', function (done) {
          service
            .requireUserWithAnyRole(['tester'])
            .then(function (provided) {
              expect(provided).to.equal(true)
            })
            .catch(function (err) {
              assert.fail(err)
            })
            .finally(done)
        })
      })
    });
    describe('the constants', function () {
      it(
        'ehaUMSAuthService is provided',
        inject(function (ehaUMSAuthService) {
          expect(ehaUMSAuthService).to.be.defined
        }))
      it(
        'EHA_UMS_AUTH_UNAUTHORISED_EVENT is provided',
        inject(function (EHA_UMS_AUTH_UNAUTHORISED_EVENT) {
          expect(EHA_UMS_AUTH_UNAUTHORISED_EVENT).to.be.defined
        }))
      it(
        'EHA_UMS_AUTH_UNAUTHENTICATED_EVENT_EVENT is provided',
        inject(function (EHA_UMS_AUTH_UNAUTHENTICATED_EVENT) {
          expect(EHA_UMS_AUTH_UNAUTHENTICATED_EVENT).to.be.defined
        }))
    })
  });
})
