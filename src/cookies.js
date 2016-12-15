angular
  .module('eha.ums-auth')
  .factory('ehaUMSAuthCookies', function ($cookies, $window) {

    // table copied from
    // https://github.com/eHealthAfrica/ums-client-nginx/blob/2b97a24d5a1349bfa19e483a1bd0213b833b85d7/nginx-ums/conf/cookies.lua#L15-L20
    // . Keep in mind that some cookies might be HTTP-only, thus not
    // accessible from Javascript. Currently only the `attributes`
    // cookie is accessible. Trying to access other cookies will
    // currently fail - Francesco, December 2016
    var service = [
      ['user', 'u5iIsQbEx0Nlq'],
      ['roles', 'rCp6V7rJ6ANl6'],
      ['attributes', 'a943f5ff506ee'],
      ['time', 't7lQak8edkG1i'],
      ['signature', 'sHVcH0Mcl4H7'],
      ['pgt', 'SiUSKiyoy87yh']
    ].reduce(function (prev, curr) {
      var normal = curr[0]
      var weird = curr[1]
      var name = normal + 'GetCookie'
      prev[name] = function () {
        var rawCookieContent = $cookies.get(weird)
        if (rawCookieContent) {
          return $window.atob(rawCookieContent)
        } else {
          throw Error('The cookie '+weird+' has value '+rawCookieContent)
        }
      }
      return prev
    }, {})

    // Sometimes, even within a JSON, arrays won't be encoded as JSON
    // arrays but rather as comma separated values
    function aCommaSeparated (commaSeparated) {
      return commaSeparated.split(',').pop()
    }

    service.getARole = function () {
      var roles = service.rolesGetCookie()
      return aCommaSeparated(roles)
    }

    service.getAGroup = function () {
      var stringifiedAttributes = service.attributesGetCookie()
      var attributes = JSON.parse(stringifiedAttributes)
      return aCommaSeparated(attributes['groups'])
    }

    return service
  })
