'use strict'

describe('the cookie parsing utility', function() {

  var ehaUMSAuthCookies
  var cookies = {}
  var $cookies = {
    get: function (c) {
      return cookies[c]
    }
  }

  function mockCookie (key) {
    return function (value) {
      cookies = {}
      cookies[key] = value
    }
  }

  var mockRoleCookie = mockCookie('rCp6V7rJ6ANl6')
  var mockAttributesCookie = mockCookie('a943f5ff506ee')

  beforeEach(function () {
    module('eha.ums-auth')
    module(function($provide) {
      $provide.value('$cookies', $cookies)
    })
    inject(function (_ehaUMSAuthCookies_) {
      ehaUMSAuthCookies = _ehaUMSAuthCookies_
    })
  })

  it('gives a role when a single role is provided', function () {
    mockRoleCookie('b3BlcmF0b3I=')
    expect(ehaUMSAuthCookies.getARole()).to.equal('operator')
  })

  it('gives a role when two roles are provided', function () {
    mockRoleCookie('Y2FsbGJhY2tzLGtpYmFuYQ==')
    expect(ehaUMSAuthCookies.getARole()).to.equal('kibana') // or 'callbacks'. There are two roles here, and the behavior is not defined by the specs, so we can just pick a random one
  })

  it('gives a group when two groups are provided', function () {
    mockAttributesCookie('eyJ1c2VyX2ltYWdlIjoiVHJ1ZSIsImdyb3VwcyI6IkJvbnRoZSxtb3lhbWJhIiwiZGlzcGxheV9uYW1lIjoiVHJ1ZSIsInJvbGVzIjoiY2FsbGJhY2tzLGtpYmFuYSIsIm9fayI6InNoYTEkMjAwMDAkYzQ5Zjc1ZThhZGVmNGJhNWJhM2ZjMzA4ZjViZWUyYjckZjlhYzg4NTk4MTUyMjRhMzZjZjc4MDZjZTY1Yjc4NjFiMzcwYjdjYSJ9')
    expect(ehaUMSAuthCookies.getAGroup()).to.equal('moyamba') // or 'Bonthe'. There are two groups here, and the behavior is not defined by the specs, so we can just pick a random one
  })
})

