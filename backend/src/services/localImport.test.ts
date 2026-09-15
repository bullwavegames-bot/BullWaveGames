import assert from 'node:assert/strict';
import test from 'node:test';
import { localImportSchema } from './localImport.js';

test('local import rejects authority fields and duplicate games', () => {
  assert.throws(() => localImportSchema.parse({ role: 'admin' }));
  assert.throws(() => localImportSchema.parse({ membership: 'tide' }));
  assert.throws(() => localImportSchema.parse({ saves: [
    { slug: 'kite-line', payload: {} }, { slug: 'kite-line', payload: {} },
  ] }));
  assert.throws(() => localImportSchema.parse({ displayName: 'x' }));
  assert.equal(localImportSchema.parse({ saves: [{ slug: 'kite-line', payload: { level: 2 } }] }).saves?.length, 1);
});
