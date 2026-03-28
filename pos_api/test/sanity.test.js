const test = require('node:test');
const assert = require('node:assert/strict');

test('backend sanity check', () => {
  assert.equal(1 + 1, 2);
});
