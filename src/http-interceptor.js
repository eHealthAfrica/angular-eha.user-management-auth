;(function() {
  'use strict';

  var ngModule = angular.module('eha.user-management-auth.http-interceptor', []);

  function EhaUserManagementAuthHttpInterceptor(options, $injector) {

    function hostMatch(url) {
      var hostMatches = options.hosts.filter(function(host) {
        return url.indexOf(host) > -1;
      });
      return !!hostMatches.length;
    }

    var $q = $injector.get('$q');
    var $log = $injector.get('$log');

    return {
      responseError: function(rejection) {
        // Check for 401 and hostMatch
        if (rejection.status === 401 && hostMatch(rejection.config.url)) {
          var auth = $injector.get('ehaUserManagementAuthService');
          auth.trigger('unauthenticated');
        }
        return $q.reject(rejection);
      }
    };
  }

  ngModule.provider('ehaUserManagementAuthHttpInterceptor', function() {
    var options = {};
    this.config = function(config) {
      options = config;
    };

    this.$get = function($injector) {
      return new EhaUserManagementAuthHttpInterceptor(options, $injector);
    };
  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
