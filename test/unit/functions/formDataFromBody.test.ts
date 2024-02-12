import { describe, it } from 'node:test';
import assert from 'node:assert';
import formDataFromBody from "../../../src/formDataFromBody.js";

// Would like to make these tests using Request, rather than Response
// However fetch form data URL is not supported at the moment, and it's
// not possible right now to build a Request object with arbitrary
// body.

describe('formDataFromBody', () => {
  it('will reject if called on a Response that has no body', async () => {
    const res = new Response(null, { headers: { 'Content-Type': 'multipart/form-data; boundary=123' } });
    await assert.rejects(async () => {
      await formDataFromBody(res);
    }, err => {
      assert.ok(err instanceof Error);
      assert.strictEqual(err.message, 'formDataFromBody cannot be called if Request|Response has no body.');
      return true;
    });
  });

  it('will throw if called on a Response whose content-type is not of multipart/form-data', async () => {
    const res = new Response(null, { headers: { 'Content-Type': 'text/plain' }});
    await assert.rejects(async () => {
      await formDataFromBody(res);
    }, err => {
      assert.ok(err instanceof Error);
      assert.strictEqual(err.message, 'formDataFromBody cannot be called if Request|Response content type is not multipart/form-data.');
      return true;
    });
  });

  it('will throw if called on a Response whose content-type has no boundary', async () => {
    const res = new Response(null, { headers: { 'Content-Type': 'multipart/form-data' }});
    await assert.rejects(async () => {
      await formDataFromBody(res);
    }, err => {
      assert.ok(err instanceof Error);
      assert.strictEqual(err.message, 'formDataFromBody cannot be called if Request|Response content type is not multipart/form-data.');
      return true;
    });
  });

  it('will throw if called on a Response whose body is already used', async () => {
    const res = new Response('foo', { headers: { 'Content-Type': 'multipart/form-data; boundary=123' } });
    await res.text();
    await assert.rejects(async () => {
      await formDataFromBody(res);
    }, err => {
      assert.ok(err instanceof Error);
      assert.strictEqual(err.message, 'formDataFromBody cannot be called if Request|Response body has already been used.');
      return true;
    });
  });

  it('decodes this form', async() => {
    const data = `\r
------WebKitFormBoundaryqo9CjASNAo5aU6b2\r
Content-Disposition: form-data; name="1_productId"\r
\r
500\r
------WebKitFormBoundaryqo9CjASNAo5aU6b2\r
Content-Disposition: form-data; name="0"\r
\r
["$K1"]\r
------WebKitFormBoundaryqo9CjASNAo5aU6b2--`;

    const res = new Response(
      data, {
        headers: {
          'Content-Type': 'multipart/form-data; boundary="----WebKitFormBoundaryqo9CjASNAo5aU6b2"'
        }
      }
    );

    const formData = await formDataFromBody(res);

    const entries = [...formData.entries()];

    assert.strictEqual(entries.length, 2);

    assert.strictEqual(entries[0][0], '1_productId');
    assert.strictEqual(entries[0][1], '500');

    assert.strictEqual(entries[1][0], '0');
    assert.strictEqual(entries[1][1], '["$K1"]');
  });
});
