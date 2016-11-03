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

(function() {
  'use strict';

  var ngModule = angular
  .module('eha.user-management-auth.auth.service', [
    'restangular',
  ]);

  function UserManagementAuthService(
    options,
    Restangular,
    $log,
    $q,
    $rootScope,
    $window,
    EHA_USER_MANAGEMENT_AUTH_UNAUTHORISED_EVENT,
    EHA_USER_MANAGEMENT_AUTH_UNAUTHENTICATED_EVENT
    ) {

    var currentUser;

    // Create a new 'isolate scope' so that we can leverage and wrap angular's
    // sub/pub functionality rather than rolling something ourselves
    var eventBus = $rootScope.$new(true);

    var trigger = eventBus.$broadcast.bind(eventBus);

    function getSession() {
      var sessionUrl = options.sessionEndpoint;
      return $q
        .when(Restangular.oneUrl('session', sessionUrl).get())
        .then(function(session) {
          var context = session.userCtx
          if (context) {
            return context;
          } else {
            $q.reject('User context not found');
          }
        })
        .catch(function () {
          trigger(EHA_USER_MANAGEMENT_AUTH_UNAUTHENTICATED_EVENT);
          return $q.reject(EHA_USER_MANAGEMENT_AUTH_UNAUTHENTICATED_EVENT);
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

    function goToExternal(route) {
      return function() {
        $window.location.assign(route)
      }
    }

    return {
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
      login: goToExternal('/login'),
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
  }

  ngModule.provider('ehaUserManagementAuthService',
  ['ehaUserManagementAuthHttpInterceptorProvider', '$httpProvider', function ehaUserManagementAuthService(
                                 ehaUserManagementAuthHttpInterceptorProvider,
                                 $httpProvider) {

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

    function requireUserWithRoles(ehaUserManagementAuthService, $q, roles) {
      return ehaUserManagementAuthService.getCurrentUser()
        .then(function(user) {
          if (user && !user.isAdmin() && !user.hasRole(roles)) {
            ehaUserManagementAuthService.trigger(EHA_USER_MANAGEMENT_AUTH_UNAUTHORISED_EVENT);
            return $q.reject(EHA_USER_MANAGEMENT_AUTH_UNAUTHORISED_EVENT);
          }
          return user;
        });
    }

    this.config = function(config) {
      options = angular.extend(options, config);

      if (config.interceptor) {
        ehaUserManagementAuthHttpInterceptorProvider.config(
          config.interceptor
        );
        $httpProvider.interceptors.push('ehaUserManagementAuthHttpInterceptor');
      }

      if (config.userRoles) {
        config.userRoles.forEach(function(role) {
          var functionName = 'require' + camelCase(role) + 'User';
          this[functionName] = function(ehaUserManagementAuthService, $q) {
            return requireUserWithRoles(ehaUserManagementAuthService, $q, [role]);
          };
        }.bind(this));
      }
    };

    this.requireAdminUser = function(ehaUserManagementAuthService, $q) {
      return requireUserWithRoles(
        ehaUserManagementAuthService, $q, options.adminRoles);
    };

    this.requireAuthenticatedUser = function(ehaUserManagementAuthService, $q) {
      return ehaUserManagementAuthService.getCurrentUser()
    };

    this.requireUserWithRoles = function(roles) {
      return function(ehaUserManagementAuthService, $q) {
        return requireUserWithRoles(ehaUserManagementAuthService, $q, roles);
      };
    };

    this.$get = ['Restangular', '$log', '$q', '$rootScope', '$window', 'EHA_USER_MANAGEMENT_AUTH_UNAUTHORISED_EVENT', 'EHA_USER_MANAGEMENT_AUTH_UNAUTHENTICATED_EVENT', function(
      Restangular,
      $log,
      $q,
      $rootScope,
      $window,
      EHA_USER_MANAGEMENT_AUTH_UNAUTHORISED_EVENT,
      EHA_USER_MANAGEMENT_AUTH_UNAUTHENTICATED_EVENT
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

      /* this triplication of the dependencies is error prone and i
       * don't see a reason for it. It would be nice to eliminate this
       * eventually - francesco 2016-10 */
      var service = new UserManagementAuthService(
        options,
        restangular,
        $log,
        $q,
        $rootScope,
        $window,
        EHA_USER_MANAGEMENT_AUTH_UNAUTHORISED_EVENT,
        EHA_USER_MANAGEMENT_AUTH_UNAUTHENTICATED_EVENT
      );

      function authorisationPolicy (f) {
        return function (policyArgument) {
          service
            .getCurrentUser()
            .then(function (user) {
              var authorised = f(user, policyArgument)
              if (authorised) {
                return p;
              } else {
                service.trigger(EHA_USER_MANAGEMENT_AUTH_UNAUTHORISED_EVENT);
                return $q.reject(EHA_USER_MANAGEMENT_AUTH_UNAUTHORISED_EVENT);
              }
            })
        }
      }

      /* used in the call centre - francesco 11-2016 */
      service.requireUserWithAnyRole = authorisationPolicy(function (user, roles) {
        return roles.forEach(function (authorised, role) {
          return authorised || user.hasRole(role);
        }, false);
      })

      /* used in the call centre - francesco 11-2016 */
      service.anyRoleExcept = authorisationPolicy(function (user, exclude) {
        return options.userRoles.forEach(function (authorised, role) {
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

  var ngModule = angular.module('eha.user-management-auth.http-interceptor', []);

  function EhaUserManagementAuthHttpInterceptor(options, $injector) {

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
    var EHA_USER_MANAGEMENT_AUTH_UNAUTHENTICATED_EVENT = $injector.get('EHA_USER_MANAGEMENT_AUTH_UNAUTHENTICATED_EVENT');

    return {
      responseError: function(rejection) {
        // Check for 401 and hostMatch
        if (rejection.status === 401 && hostMatch(rejection.config.url)) {
          var auth = $injector.get('ehaUserManagementAuthService');
          auth.trigger(EHA_USER_MANAGEMENT_AUTH_UNAUTHENTICATED_EVENT);
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

    this.$get = ['$injector', function($injector) {
      return new EhaUserManagementAuthHttpInterceptor(options, $injector);
    }];
  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();

angular.module('eha.user-management-auth.show-for-role.directive', [])
  .directive('ehaShowForRole', ['ehaUserManagementAuthService', '$animate', '$parse', '$q', '$log', function(ehaUserManagementAuthService,
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
          ehaUserManagementAuthService.getCurrentUser()
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
        ehaUserManagementAuthService.on('authenticationStateChange', function() {
          checkRoles(requiredRoles);
        });
      }
    };

  }]);

angular.module('eha.user-management-auth.show-authenticated.directive', [])
  .directive('ehaShowAuthenticated', ['ehaUserManagementAuthService', '$animate', function(ehaUserManagementAuthService, $animate) {
    var NG_HIDE_CLASS = 'ng-hide';
    var NG_HIDE_IN_PROGRESS_CLASS = 'ng-hide-animate';
    return {
      restrict: 'A',
      link: function(scope, element) {
        // Hide by default
        element.addClass('ng-hide');

        function checkStatus() {
          ehaUserManagementAuthService.isAuthenticated()
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

        ehaUserManagementAuthService.on('authenticationStateChange', checkStatus);
      }
    };
  }]);

// a string like `unauthenticated` will lead to the creation of a
// constant named `EHA_USER_MANAGEMENT_AUTH_UNAUTHENTICATED_EVENT`
[
  'unauthenticated',
  'unauthorised'
].forEach(function (name) {
  var upper = name.toUpperCase();
  // the value doesn't matter really, but having it like the name
  // might help troubleshooting
  var constantNameAndValue = 'EHA_USER_MANAGEMENT_AUTH_'+upper+'_EVENT'
  angular
    .module('eha.user-management-auth')
    .constant(constantNameAndValue, constantNameAndValue);
})
