import assert from 'node:assert/strict';
import { formatPhoneNumber } from '../js/utils.js';

assert.equal(formatPhoneNumber('1234567890'), '(123) 456 7890');
assert.equal(formatPhoneNumber('55-1234-5678'), '(551) 234 5678');
console.log('utils tests passed');
