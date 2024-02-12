import { describe, it } from 'node:test';
import assert from 'node:assert';

import { getMultipartTypeAndBoundary } from "../../../src/utils.js";

describe('utils', () => {

  describe('getMultipartTypeAndBoundary()', () =>{

    it('returns null if not multipart', () => {

      const result1 = getMultipartTypeAndBoundary('text/plain');
      assert.strictEqual(result1, null);

      const result2 = getMultipartTypeAndBoundary('application/json');
      assert.strictEqual(result2, null);

    });

    it('returns null if type is multipart but no boundary is given', () => {

      const result1 = getMultipartTypeAndBoundary('multipart/form-data');
      assert.strictEqual(result1, null);

      const result2 = getMultipartTypeAndBoundary('multipart/mixed');
      assert.strictEqual(result2, null);

      const result3 = getMultipartTypeAndBoundary('multipart/mixed; boundary=');
      assert.strictEqual(result3, null);

      const result4 = getMultipartTypeAndBoundary('multipart/mixed; boundary= ""');
      assert.strictEqual(result4, null);

      const result5 = getMultipartTypeAndBoundary('multipart/mixed; filename=foo');
      assert.strictEqual(result5, null);

    });

    it('returns multipart subtype if multipart/something and boundary is set', () => {

      const result1 = getMultipartTypeAndBoundary('multipart/mixed; boundary=a')
      assert.deepStrictEqual(result1?.type, 'mixed');

      const result2 = getMultipartTypeAndBoundary('multipart/form-data; boundary=a')
      assert.deepStrictEqual(result2?.type, 'form-data');

    });

    it('returns multipart boundary value', () => {

      const result1 = getMultipartTypeAndBoundary('multipart/mixed; boundary=a')
      assert.deepStrictEqual(result1?.boundary, 'a');

      const result2 = getMultipartTypeAndBoundary('multipart/form-data; boundary="a"')
      assert.deepStrictEqual(result2?.boundary, 'a');

      const result3 = getMultipartTypeAndBoundary(' multipart/form-data ;   boundary="a"')
      assert.deepStrictEqual(result3?.boundary, 'a');

      const result4 = getMultipartTypeAndBoundary(' multipart/form-data ;   boundary=a   ')
      assert.deepStrictEqual(result4?.boundary, 'a');

      const result5 = getMultipartTypeAndBoundary(' multipart/form-data ;   boundary=" a  "')
      assert.deepStrictEqual(result5?.boundary, ' a  ');

    });

  });

});
