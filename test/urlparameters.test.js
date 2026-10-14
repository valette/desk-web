import { test } from 'node:test';
import assert from 'node:assert';

// Provide a fake window.location so the singleton parses parameters at import time.
globalThis.window = { location : { href : 'http://localhost:8080/desk/?name="world"&n=42&flag=true&list=[1,2,3]' } };

const { URLParameters } = await import( '../src/urlparameters.js' );

test( 'parses typed URL parameters', () => {
	assert.strictEqual( URLParameters.getParameter( 'name' ), 'world' );
	assert.strictEqual( URLParameters.getParameter( 'n' ), 42 );
	assert.strictEqual( URLParameters.getParameter( 'flag' ), true );
	assert.deepStrictEqual( URLParameters.getParameter( 'list' ), [ 1, 2, 3 ] );
	assert.strictEqual( URLParameters.getParameter( 'missing' ), undefined );
} );

test( 'parseParameters applies provided parameters', () => {
	const params = { name : 'default', n : 0 };
	const result = URLParameters.parseParameters( params );
	assert.strictEqual( result.name, 'world' );
	assert.strictEqual( result.n, 42 );
} );
