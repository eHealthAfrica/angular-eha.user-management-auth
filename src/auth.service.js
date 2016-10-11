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
    $window
    ) {

    var currentUser;

    // Create a new 'isolate scope' so that we can leverage and wrap angular's
    // sub/pub functionality rather than rolling something ourselves
    var eventBus = $rootScope.$new(true);

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
  function ehaUserManagementAuthService(
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

    this.$get = function(Restangular, $log, $q, $rootScope, $window) {

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
      return new UserManagementAuthService(
        options,
        restangular,
        $log,
        $q,
        $rootScope,
        $window
      );
    };

  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
