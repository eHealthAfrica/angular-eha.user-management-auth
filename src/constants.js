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
