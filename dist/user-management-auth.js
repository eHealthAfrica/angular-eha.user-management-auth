(function() {
  'use strict';

  var ngModule = angular
  .module('eha.user-management-auth.auth.service', [
    'restangular',
    'LocalForageModule'
  ]);

  function UserManagementAuthService(options,
                              Restangular,
                              $log,
                              $q,
                              $localForage,
                              $rootScope) {

    var currentUser;

    // Create a new 'isolate scope' so that we can leverage and wrap angular's
    // sub/pub functionality rather than rolling something ourselves
    var eventBus = $rootScope.$new(true);

    function getSession() {
      var sessionUrl = options.url + '/' + options.sessionEndpoint;
      return $q.when(Restangular
                      .oneUrl('session', sessionUrl)
                      .get())
                      .then(function(session) {
                        if (session.userCtx) {
                          return session;
                        } else {
                          $q.reject('Session not found');
                        }
                      });
    }

    function decorateUser(user) {
      user.hasRole = function(role) {
        var self = this;
        if (angular.isArray(role)) {
          var matches = role.filter(function(r) {
            return self.roles.indexOf(r) > -1;
          });
          return !!matches.length;
        } else if (angular.isString(role)) {
          return this.roles.indexOf(role) > -1;
        }
      };

      user.isAdmin = function() {
        return this.hasRole(options.adminRoles);
      };
      return user;
    }

    function getCurrentUser() {

      if (currentUser) {
        return $q.when(currentUser);
      } else {
        return getSession()
          .then(function(user) {
            currentUser = decorateUser(user);
          })
          .catch(function(err) {
            $log.debug(err);
            return $q.reject(err);
          });
      }
    }

    function goToExternal(route) {
      return function() {
        $window.location = route
      }
    }

    return {
      getSession: getSession,
      getCurrentUser: getCurrentUser,
      on: eventBus.$on.bind(eventBus),
      trigger: eventBus.$broadcast.bind(eventBus),
      isAuthenticated: function() {
        if (!currentUser) {
          return $q.reject();
        } else {
          return getSession();
        }
      },
      login: goToExternal('/login'),
      logout: goToExternal('/logout')
    };
  }

  ngModule.provider('ehaUserManagementAuthService',
  ['$localForageProvider', 'ehaUserManagementAuthHttpInterceptorProvider', '$httpProvider', function ehaUserManagementAuthService($localForageProvider,
                                 ehaUserManagementAuthHttpInterceptorProvider,
                                 $httpProvider) {

    var options = {
      localStorageNamespace: 'eha',
      localStorageStoreName: 'auth',
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
            ehaUserManagementAuthService.trigger('unauthorized');
            return $q.reject('unauthorized');
          }
          return user;
        })
        .catch(function(err) {
          if (err === 'unauthorized') {
            throw err;
          }
          ehaUserManagementAuthService.trigger('unauthenticated');
          return $q.reject('unauthenticated');
        });
    }

    this.config = function(config) {
      options = angular.extend(options, config);

      $localForageProvider.config({
        name: options.localStorageNamespace,
        storeName: options.localStorageStoreName
      });

      if (config.interceptor) {
        ehaUserManagementAuthHttpInterceptorProvider.config({
          url: config.url,
          hosts: config.interceptor.hosts
        });
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
                .then(function(user) {
                  return user;
                })
                .catch(function(err) {
                  ehaUserManagementAuthService.trigger('unauthenticated');
                  return $q.reject('unauthenticated');
                });
    };

    this.requireUserWithRoles = function(roles) {
      return function(ehaUserManagementAuthService, $q) {
        return requireUserWithRoles(ehaUserManagementAuthService, $q, roles);
      };
    };

    this.$get = ['Restangular', '$log', '$q', '$localForage', '$rootScope', function(Restangular, $log, $q, $localForage, $rootScope) {

      var restangular = Restangular.withConfig(
        function(RestangularConfigurer) {
          RestangularConfigurer.setBaseUrl(options.url);
          if (options.defaultHttpFields) {
            RestangularConfigurer
              .setDefaultHttpFields(options.defaultHttpFields);
          }
        }
      );

      return new UserManagementAuthService(options,
                                    restangular,
                                    $log,
                                    $q,
                                    $localForage,
                                    $rootScope);
    }];

  }]);

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();

;(function() {
  'use strict';
  /**
   * @ngdoc service
   * @function
   * @name EhaUserManagementAuthHttpInterceptor
   * @module eha.user-management-auth.http-interceptor
   */
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
      request: function(request) {
        if (hostMatch(request.url)) {
          // Grab the service this way to avoid a circular dependency
          var auth = $injector.get('ehaUserManagementAuthService');
          // Try to get current user
          return auth.getCurrentUser()
            .then(function(user) {
              if (user && user.bearerToken) {
                // If user and user.bearerToken are found configure the
                // Authorization header for this call appropriately
                request.headers.Authorization = 'Bearer ' + user.bearerToken;
              }
              return request;
            })
            .catch(function(err) {
              $log.debug(err);
              // If we don't find a user then just allow the request to pass
              // through un modified
              return request;
            });
        }
        return $q.when(request);
      },
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
