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

(function() {
  'use strict';

  var ngModule = angular
        .module('eha.ums-auth.auth.service', [
          'restangular',
        ]);

  ngModule.provider('ehaUMSAuthService', ['ehaUMSAuthHttpInterceptorProvider', '$httpProvider', function (
    ehaUMSAuthHttpInterceptorProvider,
    $httpProvider
  ) {

    var options = {
      adminRoles: ['_admin'],
      sessionEndpoint: '_session'
    };

    function capitalizeFirstLetter(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function camelCase(string) {
      var words = [string];
      if (string.indexOf('-') > -1) {
        words = string.split('-');
      } else if (string.indexOf('_') > -1) {
        words = string.split('_');
      }
      words = words.map(capitalizeFirstLetter);
      return words.join('');
    }

    function requireUserWithRoles(ehaUMSAuthService, $q, roles, unauthorisedEvent) {
      return ehaUMSAuthService.getCurrentUser()
        .then(function(user) {
          if (user && !user.isAdmin() && !user.hasRole(roles)) {
            ehaUMSAuthService.trigger(unauthorisedEvent);
            return $q.reject(unauthorisedEvent);
          }
          return user;
        });
    }

    this.config = function(config) {
      options = angular.extend(options, config);

      if (config.interceptor) {
        ehaUMSAuthHttpInterceptorProvider.config(
          config.interceptor
        );
        $httpProvider.interceptors.push('ehaUMSAuthHttpInterceptor');
      }

      if (config.userRoles) {
        config.userRoles.forEach(function(role) {
          var functionName = 'require' + camelCase(role) + 'User';
          this[functionName] = function(ehaUMSAuthService, $q) {
            return requireUserWithRoles(
              ehaUMSAuthService, $q, [role], EHA_UMS_AUTH_UNAUTHORISED_EVENT);
          };
        }.bind(this));
      }
    };

    this.requireAdminUser = function(ehaUMSAuthService, $q) {
      return requireUserWithRoles(
        ehaUMSAuthService, $q, options.adminRoles, EHA_UMS_AUTH_UNAUTHORISED_EVENT);
    };

    this.requireAuthenticatedUser = function(ehaUMSAuthService, $q) {
      return ehaUMSAuthService.getCurrentUser()
    };

    this.requireUserWithRoles = function(roles) {
      return function(ehaUMSAuthService, $q) {
        return requireUserWithRoles(
          ehaUMSAuthService, $q, roles, EHA_UMS_AUTH_UNAUTHORISED_EVENT);
      };
    };

    this.$get = ['Restangular', '$log', '$q', '$rootScope', '$window', 'EHA_UMS_AUTH_UNAUTHORISED_EVENT', 'EHA_UMS_AUTH_UNAUTHENTICATED_EVENT', function(
      Restangular,
      $log,
      $q,
      $rootScope,
      $window,
      EHA_UMS_AUTH_UNAUTHORISED_EVENT,
      EHA_UMS_AUTH_UNAUTHENTICATED_EVENT
    ) {

      var restangular = Restangular.withConfig(
        function(RestangularConfigurer) {
          RestangularConfigurer.setBaseUrl(options.url);
          if (options.defaultHttpFields) {
            RestangularConfigurer
              .setDefaultHttpFields(options.defaultHttpFields);
          }
        }
      );

      function goToExternal(route) {
        return function() {
          $window.location.assign(route)
        }
      }

      var login = goToExternal('/login')

      var currentUser;

      // Create a new 'isolate scope' so that we can leverage and wrap angular's
      // sub/pub functionality rather than rolling something ourselves
      var eventBus = $rootScope.$new(true);

      var trigger = eventBus.$broadcast.bind(eventBus);

      eventBus.$on(EHA_UMS_AUTH_UNAUTHENTICATED_EVENT, login)

      function getSession() {
        var sessionUrl = options.sessionEndpoint;
        return $q
          .when(Restangular.oneUrl('session', sessionUrl).get())
          .then(function(session) {
            var context = session.userCtx
            if (context) {
              return context;
            } else {
              return $q.reject('User context not found');
            }
          })
          .catch(function () {
            trigger(EHA_UMS_AUTH_UNAUTHENTICATED_EVENT);
            return $q.reject(EHA_UMS_AUTH_UNAUTHENTICATED_EVENT);
          });
      }

      function decorateUser(user) {
        user.hasRole = function(role) {
          if (angular.isArray(role)) {
            var matches = role.filter(function(r) {
              return user.roles.indexOf(r) > -1;
            });
            return !!matches.length;
          } else if (angular.isString(role)) {
            return user.roles.indexOf(role) > -1;
          }
        };
        user.isAdmin = function() {
          return user.hasRole(options.adminRoles);
        };
        // add getters for the known properties of an user. This way the
        // code trying to access user properties can use a getter and
        // get an exception when trying to access properties which are
        // unknown to us
        [
          'name',
          'role'
        ].forEach(function (prop) {
          var getterName = prop+'Getter';
          user[getterName] = function () {
            return user[prop];
          };
        })
        return user;
      }

      function getCurrentUser() {

        if (currentUser) {
          return $q.when(currentUser);
        } else {
          return getSession()
            .then(function(user) {
              currentUser = decorateUser(user);
              return currentUser
            })
            .catch(function(err) {
              $log.debug(err);
              return $q.reject(err);
            });
        }
      }

      var service = {
        getSession: getSession,
        getCurrentUser: getCurrentUser,
        on: eventBus.$on.bind(eventBus),
        trigger: trigger,
        isAuthenticated: function() {
          if (!currentUser) {
            return $q.reject();
          } else {
            return getSession();
          }
        },
        login: login,
        logout: goToExternal('/logout'),
        unsafeGetCurrentUserSynchronously: function () {
          // this function was added to integrate more easily with the
          // call centre, which relies on synchronously fetching the
          // user within several page controllers. Authentication is
          // done before the controllers call this function, but this
          // cannot be guaranteed in the general case, so hopefully this
          // name should be scary enough for us to gradually stop using
          // this function in the long term, and migrate to the
          // asynchronous ones which return promises
          return currentUser
        }
      };

      function authorisationPolicy (f) {
        return function (policyArgument) {
          return service
            .getCurrentUser()
            .then(function (user) {
              var authorised = f(user, policyArgument)
              if (authorised) {
                return true;
              } else {
                service.trigger(EHA_UMS_AUTH_UNAUTHORISED_EVENT);
                return $q.reject(EHA_UMS_AUTH_UNAUTHORISED_EVENT);
              }
            })
        }
      }

      /* used in the call centre - francesco 11-2016 */
      service.requireUserWithAnyRole = authorisationPolicy(function (user, roles) {
        return roles.reduce(function (authorised, role) {
          return authorised || user.hasRole(role);
        }, false);
      })

      /* used in the call centre - francesco 11-2016 */
      service.anyRoleExcept = authorisationPolicy(function (user, exclude) {
        return options.userRoles.reduce(function (authorised, role) {
          return authorised || (role !== exclude && user.hasRole(role));
        }, false);
      })

      return service;
    }];

  }]);

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();

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

    this.$get = ['$injector', function($injector) {
      return new EhaUMSAuthHttpInterceptor(options, $injector);
    }];
  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();

angular.module('eha.ums-auth.show-for-role.directive', [])
  .directive('ehaShowForRole', ['ehaUMSAuthService', '$animate', '$parse', '$q', '$log', function(ehaUMSAuthService,
                                        $animate,
                                        $parse,
                                        $q,
                                        $log) {
    var NG_HIDE_CLASS = 'ng-hide';
    var NG_HIDE_IN_PROGRESS_CLASS = 'ng-hide-animate';

    return {
      restrict: 'A',
      link: function(scope, element, attributes) {

        function checkRoles(requiredRoles) {
          ehaUMSAuthService.getCurrentUser()
          .then(function(user) {
            if (user && (user.hasRole(requiredRoles) || user.isAdmin())) {
              $animate.removeClass(element, NG_HIDE_CLASS, {
                tempClasses: NG_HIDE_IN_PROGRESS_CLASS
              });
              return true;
            }
            return $q.reject('Role not found');
          })
          .catch(function(err) {
            $log.debug(err);
            $animate.addClass(element, NG_HIDE_CLASS, {
              tempClasses: NG_HIDE_IN_PROGRESS_CLASS
            });
          });
        }

        // Hide by default
        element.addClass('ng-hide');

        var attr = $parse(attributes.ehaShowForRole)(scope);
        var requiredRoles;
        if (angular.isArray(attr)) {
          requiredRoles = attr;
        } else if (angular.isString(attr)) {
          requiredRoles = [attr];
        } else {
          throw Error('You must pass a string or an array of strings');
        }

        checkRoles(requiredRoles);
        ehaUMSAuthService.on('authenticationStateChange', function() {
          checkRoles(requiredRoles);
        });
      }
    };

  }]);

angular.module('eha.ums-auth.show-authenticated.directive', [])
  .directive('ehaShowAuthenticated', ['ehaUMSAuthService', '$animate', function(ehaUMSAuthService, $animate) {
    var NG_HIDE_CLASS = 'ng-hide';
    var NG_HIDE_IN_PROGRESS_CLASS = 'ng-hide-animate';
    return {
      restrict: 'A',
      link: function(scope, element) {
        // Hide by default
        element.addClass('ng-hide');

        function checkStatus() {
          ehaUMSAuthService.isAuthenticated()
            .then(function() {
              $animate.removeClass(element, NG_HIDE_CLASS, {
                tempClasses: NG_HIDE_IN_PROGRESS_CLASS
              });
            })
            .catch(function() {
              $animate.addClass(element, NG_HIDE_CLASS, {
                tempClasses: NG_HIDE_IN_PROGRESS_CLASS
              });
            });
        }

        checkStatus();

        ehaUMSAuthService.on('authenticationStateChange', checkStatus);
      }
    };
  }]);

// a string like `unauthenticated` will lead to the creation of a
// constant named `EHA_UMS_AUTH_UNAUTHENTICATED_EVENT`
[
  'unauthenticated',
  'unauthorised'
].forEach(function (name) {
  var upper = name.toUpperCase();
  // the value doesn't matter really, but having it like the name
  // might help troubleshooting
  var constantNameAndValue = 'EHA_UMS_AUTH_'+upper+'_EVENT'
  angular
    .module('eha.ums-auth')
    .constant(constantNameAndValue, constantNameAndValue);
})

angular
  .module('eha.ums-auth')
  .factory('ehaUMSAuthCookies', ['$cookies', '$window', function ($cookies, $window) {

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
      var groups = attributes['groups']
      return groups ? aCommaSeparated(groups) : groups
    }

    return service
  }])
