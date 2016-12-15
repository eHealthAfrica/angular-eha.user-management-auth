;(function() {
  'use strict';
  var ngModule = angular.module('eha.ums-auth', [
    'eha.ums-auth.http-interceptor',
    'eha.ums-auth.auth.service',
    'eha.ums-auth.show-for-role.directive',
    'eha.ums-auth.show-authenticated.directive',
    'ngCookies'
  ]);

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
