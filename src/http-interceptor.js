;(function() {
  'use strict';

  var ngModule = angular.module('eha.ums-auth.http-interceptor', []);

  function EhaUMSAuthHttpInterceptor(options, $injector) {

    function hostMatch(url) {
      var hosts = options.hosts;
      if (hosts) {
        var hostMatches = options.hosts.filter(function(host) {
          return url.indexOf(host) > -1;
        });
        return !!hostMatches.length;
      } else {
        // we support the case when no hosts are defined. In this
        // case, all intercepted HTTP responses with a 401 -
        // unauthorised code will be handled by this interceptor
        return true;
      }
    }

    var $q = $injector.get('$q');
    var $log = $injector.get('$log');
    var EHA_UMS_AUTH_UNAUTHENTICATED_EVENT = $injector.get('EHA_UMS_AUTH_UNAUTHENTICATED_EVENT');

    return {
      responseError: function(rejection) {
        // Check for 401 and hostMatch
        if (rejection.status === 401 && hostMatch(rejection.config.url)) {
          var auth = $injector.get('ehaUMSAuthService');
          auth.trigger(EHA_UMS_AUTH_UNAUTHENTICATED_EVENT);
        }
        return $q.reject(rejection);
      }
    };
  }

  ngModule.provider('ehaUMSAuthHttpInterceptor', function() {
    var options = {};
    this.config = function(config) {
      options = config;
    };

    this.$get = function($injector) {
      return new EhaUMSAuthHttpInterceptor(options, $injector);
    };
  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
