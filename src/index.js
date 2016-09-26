;(function() {
  'use strict';
  var ngModule = angular.module('eha.user-management-auth', [
    'eha.user-management-auth.http-interceptor',
    'eha.user-management-auth.auth.service',
    'eha.user-management-auth.show-for-role.directive',
    'eha.user-management-auth.show-authenticated.directive'
  ]);

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
