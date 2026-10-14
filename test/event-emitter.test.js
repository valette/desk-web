import { test } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from '../src/internals/event-emitter.js';

test( 'on/emit delivers data with context', () => {
	const em = new EventEmitter();
	const seen = [];
	em.on( 'ping', function ( d ) { seen.push( [ d, this.tag ] ); }, { tag : 'ctx' } );
	em.emit( 'ping', 'hello' );
	em.emit( 'ping', 'world' );
	assert.deepStrictEqual( seen, [ [ 'hello', 'ctx' ], [ 'world', 'ctx' ] ] );
} );

test( 'once fires a single time', () => {
	const em = new EventEmitter();
	let n = 0;
	em.once( 'go', () => n++ );
	em.emit( 'go' );
	em.emit( 'go' );
	assert.strictEqual( n, 1 );
} );

test( 'off removes a specific listener and all listeners', () => {
	const em = new EventEmitter();
	let a = 0, b = 0;
	const fa = () => a++;
	const fb = () => b++;
	em.on( 'x', fa );
	em.on( 'x', fb );
	em.off( 'x', fa );
	em.emit( 'x' );
	assert.strictEqual( a, 0 );
	assert.strictEqual( b, 1 );
	em.removeAllListeners();
	em.emit( 'x' );
	assert.strictEqual( b, 1 );
} );

test( 'a throwing listener does not break delivery to others', () => {
	const em = new EventEmitter();
	const seen = [];
	em.on( 't', () => { throw new Error( 'boom' ); } );
	em.on( 't', () => seen.push( 'ok' ) );
	em.emit( 't' );
	assert.deepStrictEqual( seen, [ 'ok' ] );
} );
