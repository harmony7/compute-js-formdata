/// <reference types="@fastly/js-compute" />

export { default as formDataFromBody } from './formDataFromBody.js';

let _formDataFromBody: typeof import('./formDataFromBody.js').default | null = null;
async function importFormDataFromBody() {
  if (_formDataFromBody == null) {
    _formDataFromBody = (await import('./formDataFromBody.js')).default;
  }
  return _formDataFromBody;
}

// If we're using a build of Compute that does not have Request.prototype.formData
// or Response.prototype.formData, polyfill them here.

// If you're doing this, the following polyfills are recommended (probably needed):
// Blob.js
// formdata-polyfill

if (Request.prototype.formData == null) {
  Request.prototype.formData = async function() {
    const formDataFromBody = await importFormDataFromBody();
    return await formDataFromBody(this);
  }
}
if (Response.prototype.formData == null) {
  Response.prototype.formData = async function() {
    const formDataFromBody = await importFormDataFromBody();
    return await formDataFromBody(this);
  }
}
