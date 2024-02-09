# FormData parsing for Fastly Compute JavaScript

Parses body streams of type `multitype/form-data` and provides them as a
polyfill for `Request.prototype.formData()` and `Response.prototype.formData()`.
This is meant to be used with Fastly Compute, but can probably be used with
any platform that provides `Request`/`Response` but not `prototype.formData()`.

Eventually, actual implementations of these will be coming in the Fastly JS,
and they will be more performant, but this polyfill can be used in the meantime.

This does depend on `File` and `FormData`, which at the current time will also need
to be polyfilled. `blob-polyfill` and `formdata-polyfill` seem to work.

## Usage

In your Compute project:

```sh
npm install blob-polyfill formdata-polyfill @h7/compute-js-formdata
```

Then, at the beginning of your program:

```javascript
Object.assign(globalThis, require('blob-polyfill'));
require('formdata-polyfill');
require('@h7/compute-js-formdata');
```

Now, you can use `formData()`:

```javascript
const req = event.request;
const formData = await req.formData();
formData.get('foo'); // Value of form field 'foo'
```

## License

[MIT](./LICENSE).
