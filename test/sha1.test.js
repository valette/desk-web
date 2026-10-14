import { test } from 'node:test';
import assert from 'node:assert';
import { sha1 } from '../src/internals/sha1.js';

test( 'sha1 matches known digests', async () => {
	assert.strictEqual( await sha1( '' ), 'da39a3ee5e6b4b0d3255bfef95601890afd80709' );
	assert.strictEqual( await sha1( 'abc' ), 'a9993e364706816aba3e25717850c26c9cd0d89d' );
	assert.strictEqual( await sha1( 'hello desk' ), 'ce110666b9105574227c31c1b2b9b85698f33a33' );
} );
