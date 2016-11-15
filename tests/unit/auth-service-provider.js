'use strict'

describe('the auth service provider', function() {
  var provider
  var $httpBackend

  beforeEach(function (done) {
    module('eha.ums-auth')
    module(function(ehaUMSAuthServiceProvider) {
      provider = ehaUMSAuthServiceProvider
    })
    inject(function (ehaUMSAuthService, _$httpBackend_) {
      $httpBackend = _$httpBackend_
      done()
    })
  })

  it('is defined', function () {
    assert.isDefined(provider)
  })
  it('can be configured', function () {
    provider.config({
      url: 'http://localhost:5000',
      localStorageNamespace: 'mnutrition-app'
    })
  })
  describe('after receiving a valid session', function () {
    beforeEach(function () {
      $httpBackend
        .whenGET('_session')
        .respond({
          userCtx: {
            name: 'franco',
            roles: ['tester']
          }
        });
    })
    afterEach(function () {
      $httpBackend.verifyNoOutstandingExpectation()
      $httpBackend.verifyNoOutstandingRequest()
    })
    it('the provider is still defined', function () {
      assert.isDefined(provider)
    })
  })
})
