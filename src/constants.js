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
