# FormData parsing for Fastly Compute JavaScript

by Katsuyuki Omuro

Parses body streams of type `multitype/form-data` and provides them as a
polyfill for `Request.prototype.formData()` and `Response.prototype.formData()`.
This is meant to be used with Fastly Compute, but can probably be used with
any platform that happens to provide `Request`/`Response` but not
`.prototype.formData()`.

Eventually, we expect to see native implementations to be coming to the [Fastly
Compute JavaScript runtime](https://github.com/fastly/js-compute-runtime),
and they will be more performant, but this polyfill can be used in the meantime.

## Prerequisites

This polyfill does depend on the data structures `File` and `FormData`, which
at the current time will themselves also need polyfills. `blob-polyfill` and
`formdata-polyfill` seem to work.

You may face a gotcha when doing this; see the [Caveats](#caveats) section below.

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

## Caveats

### `blob-polyfill`

`blob-polyfill` does not automatically make its exports available globally, so
you'll have to be sure to copy its exported members such as `Blob` and `File` to
`globalThis` so that they are available to the other polyfills and to your program.

You can do this like this:
```javascript
// require and merge with globalThis
Object.assign(globalThis, require('blob-polyfill'));

// require other polyfills
require('formdata-polyfill');
require('@h7/compute-js-formdata');
```

If you're using ES modules (i.e., `import` rather than `require()`) you'll have
to be extra careful, because `import` statements get hoisted.

You'll want to place your `blob-polyfill` import in a separate file, e.g.:
```javascript
// load-blob-polyfill.js
import * as blobPolyfill from 'blob-polyfill';
Object.assign(globalThis, blobPolyfill);
```

And then import that before the FormData polyfill:
```javascript
// load blob polyfill and make global
import './load-blob-polyfill.js'

// load other polyfills
require('formdata-polyfill');
require('@h7/compute-js-formdata');
```

## License

[MIT](./LICENSE).
