// noinspection DuplicatedCode

import { describe, it } from 'node:test';
import assert from 'node:assert';

import MultipartStreamReader, { Part } from "../../../src/MultipartStreamReader.js";
import { areUint8ArraysEqual } from "../utils.js";

const encoder = new TextEncoder();

function streamFromChunks(chunks: string[]) {

  const encoder = new TextEncoder();

  const iterator = chunks.values();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = iterator.next();

      if (done) {
        controller.close();
      } else {
        controller.enqueue(encoder.encode(value));
      }
    },
  });

}

describe('MultipartStreamReader', () => {
  describe('Various scenarios', () => {

    it('can parse this one', async () => {
      const stream = streamFromChunks([
        `\r
------WebKitFormBoundaryqo9CjASNAo5aU6b2\r
Content-Disposition: form-data; name="1_productId"\r
\r
500\r
------WebKitFormBoundaryqo9CjASNAo5aU6b2\r
Content-Disposition: form-data; name="0"\r
\r
["$K1"]\r
------WebKitFormBoundaryqo9CjASNAo5aU6b`,
        `2--`
      ]);

      const parts: Part[] = [];

      const reader = new MultipartStreamReader({
        stream,
        boundary: '----WebKitFormBoundaryqo9CjASNAo5aU6b2',
        onPart(part) {
          parts.push(part);
        }
      });

      await reader.performWork();

      assert.strictEqual(parts.length, 2);

      assert.strictEqual(parts[0].contentType, null);
      assert.strictEqual(parts[0].filename, null);
      assert.strictEqual(parts[0].name, '1_productId');
      assert.ok(areUint8ArraysEqual(parts[0].body, encoder.encode('500')));

      assert.strictEqual(parts[1].contentType, null);
      assert.strictEqual(parts[1].filename, null);
      assert.strictEqual(parts[1].name, '0');
      assert.ok(areUint8ArraysEqual(parts[1].body, encoder.encode('["$K1"]')));
    });

    it('can parse this one too', async () => {
      const stream = streamFromChunks([
        `\r
------WebKitFormBoundaryqo9CjASNAo5aU6b2\r
Content-Disposition: form-data; name="1_productId"\r
\r
500\r
------WebKitFormBoundaryqo9CjASNAo5aU6b2\r
Content-Disposition: form-data; name="0"\r
\r
["$K1"]\r
------WebKitFormBoundaryqo9CjASNAo5aU6b2`,
        `--`
      ]);

      const parts: Part[] = [];

      const reader = new MultipartStreamReader({
        stream,
        boundary: '----WebKitFormBoundaryqo9CjASNAo5aU6b2',
        onPart(part) {
          parts.push(part);
        }
      });

      await reader.performWork();

      assert.strictEqual(parts.length, 2);

      assert.strictEqual(parts[0].contentType, null);
      assert.strictEqual(parts[0].filename, null);
      assert.strictEqual(parts[0].name, '1_productId');
      assert.ok(areUint8ArraysEqual(parts[0].body, encoder.encode('500')));

      assert.strictEqual(parts[1].contentType, null);
      assert.strictEqual(parts[1].filename, null);
      assert.strictEqual(parts[1].name, '0');
      assert.ok(areUint8ArraysEqual(parts[1].body, encoder.encode('["$K1"]')));
    });
  });
});
