import assert from 'node:assert/strict';
import test from 'node:test';
import { redis } from '../redis.js';
import { hitRateLimit } from './rate-limit.js';

test('rate limiter enforces the boundary and fails closed during an outage', async (t) => {
  const evaluate = t.mock.method(redis, 'eval', async () => 3);
  await hitRateLimit('test-key', 3, 60);
  assert.equal(evaluate.mock.calls.length, 1);
  assert.deepEqual(evaluate.mock.calls[0].arguments.slice(1), [1, 'test-key', 60]);
  evaluate.mock.mockImplementation(async () => 4);
  await assert.rejects(hitRateLimit('test-key', 3, 60), { statusCode: 429, code: 'RATE_LIMIT' });
  evaluate.mock.mockImplementation(async () => { throw new Error('offline'); });
  await assert.rejects(hitRateLimit('test-key', 3, 60), { statusCode: 503, code: 'RATE_LIMIT_UNAVAILABLE' });
});
