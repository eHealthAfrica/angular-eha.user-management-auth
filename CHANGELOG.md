# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

#### 2.2.1 - 2016-12-20

- The previous version did not have an updated build, this amends

#### 2.2.0 - 2016-12-15

- Add the `ehaUMSAuthCookies` service with methods like `getAGroup`
  and `getARole`, to support CCSL-1888

#### 2.1.3 - 2016-12-01

##### Internal

- The previous version did not have an updated build, this amends

#### 2.1.2 - 2016-12-01

##### Internal

- Fixed a bug which caused ineffective handling of an erroneous
  response, this could solve CCSL-1890

#### 2.1.1 - 2016-11-29

##### Internal

- The previous version did not include a `dist/` folder and it is
  therefore unusable, this one fixes the problem by including the
  necessary built files

#### 2.1.0 - 2016-11-29

##### New

- Automatically redirect the user to login when an authentication error occurs

#### 2.0.0 - 2016-11-10

##### Breaking

rename "User Management" with "UMS" everywhere. To migrate:
- Rename EHA_USER_MANAGEMENT_AUTH... constants to EHA_UMS_AUTH...
- Rename ehaUserManagementAuth... services to ehaUMSAuth...
- Rename the module name from `eha.user-management-auth` to `eha.ums-auth`
- Point to the new repository

##### New

- Add `requireUserWithAnyRole` and `anyRoleExcept`, to be used in the
  call center
- The `interceptor.hosts` configuration value is not required
  anymore. When absent, all responses will be intercepted
- Add getters for user properties
- Add constants corresponding to the `unauthenticated` and
  `unauthorised` events

##### Internal

- Refactor the auth service removing the triplication of dependencies

#### 1.0.3 - 2016-10-11

- Fix a bug with the login and logout methods

#### 1.0.2 - 2016-10-11

- I forgot to build the previous version, this updates the build

#### 1.0.1 - 2016-10-11

- Update dependencies - lodash and restangular
- Refactor the options removing the unused ones, and update the doc

#### 1.0.0 - 2016-10-07

- Fix: remove the bearer token injection in outcoming requests, and a
  severe bug leading to an endless cycle in network interceptors
- Fix: several bugs in the auth service

#### 0.0.1 - 2016-10-07

First release. This Angular module has been forked from
<https://github.com/eHealthAfrica/angular-eha.couchdb-auth>. This
module is not fully compatible with `angular-eha.couchdb-auth`, but it
still has a largely similar interface. Specifically, it still exposes
the `getCurrentUser` method, along with all the decorators added to
the user object. Instead of the `signIn` and `signOut` methods, this
module exposes `login` and `logout`, which will navigate the user to a
different page.
