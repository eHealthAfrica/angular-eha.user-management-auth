# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

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
