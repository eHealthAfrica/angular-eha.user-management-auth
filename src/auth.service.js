(function() {
  'use strict';

  var ngModule = angular
        .module('eha.ums-auth.auth.service', [
          'restangular',
        ]);

  ngModule.provider('ehaUMSAuthService', function (
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

    this.config = function (config) {
      options = angular.extend(options, config);

      if (config.interceptor) {
        ehaUMSAuthHttpInterceptorProvider.config(
          config.interceptor
        );
        $httpProvider.interceptors.push('ehaUMSAuthHttpInterceptor');
      }

      if (config.userRoles) {
        config.userRoles.forEach(function (role) {
          var functionName = 'require' + camelCase(role) + 'User';
          this[functionName] = function (ehaUMSAuthService) {
            return ehaUMSAuthService.requireUserWithAnyRole([role])
          };
        }.bind(this));
      }
    };

    this.requireAdminUser = function (ehaUMSAuthService) {
      return ehaUMSAuthService.requireUserWithAnyRole(options.adminRoles)
    };

    this.requireAuthenticatedUser = function (ehaUMSAuthService) {
      return ehaUMSAuthService.getCurrentUser()
    };

    this.requireUserWithRoles = function (roles) {
      return function (ehaUMSAuthService) {
        return ehaUMSAuthService.requireUserWithAnyRole(roles)
      };
    };

    this.$get = function(
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
    };

  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
