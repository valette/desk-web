'use strict';
/**
 * Integration test: launches a real desk server with a custom DESK_ROOTDIR and
 * exercises the desk-web promise API against it over Socket.IO.
 */
const { test } = require( 'node:test' );
const assert = require( 'node:assert' );
const { spawn } = require( 'node:child_process' );
const { mkdtempSync, rmSync } = require( 'node:fs' );
const { tmpdir } = require( 'node:os' );
const path = require( 'node:path' );
const net = require( 'node:net' );

const DESK_DIR = path.resolve( __dirname, '..', '..', 'desk' );
const rootDir = mkdtempSync( path.join( tmpdir(), 'desk-web-test-' ) );

function freePort () {
	return new Promise( resolve => {
		const srv = net.createServer();
		srv.listen( 0, () => {
			const port = srv.address().port;
			srv.close( () => resolve( port ) );
		} );
	} );
}

test( 'desk-web works against a live desk server (DESK_ROOTDIR)', async () => {
	const port = await freePort();
	const child = spawn( process.execPath, [ path.join( DESK_DIR, 'desk.js' ) ], {
		env : {
			...process.env,
			DESK_ROOTDIR : rootDir,
			DESK_SINGLE : '1',
			PORT : String( port )
		},
		stdio : [ 'ignore', 'pipe', 'pipe' ]
	} );
	let serverLog = '';
	child.stdout.on( 'data', d => { serverLog += d; } );
	child.stderr.on( 'data', d => { serverLog += d; } );

	// Wait for the server to accept connections.
	const baseURL = 'http://localhost:' + port + '/';
	let up = false;
	for ( let i = 0; i < 50 && !up; i++ ) {
		await new Promise( r => setTimeout( r, 200 ) );
		try {
			await fetch( baseURL );
			up = true;
		} catch ( e ) {}
	}
	if ( !up ) {
		child.kill();
		throw new Error( 'desk server did not start:\n' + serverLog );
	}

	let lib;
	try {
		lib = require( path.resolve( __dirname, '..', 'dist/desk-web.cjs' ) );
		const { Actions, FileSystem } = lib;

		await Actions.connect( { baseURL, username : process.env.USER, password : 'password' } );

		// Settings / actions list
		const settings = Actions.getSettings();
		assert.ok( !settings.not_initialised, 'settings initialised' );
		assert.ok( settings.actions.mkdirp, 'mkdirp action present' );

		// FileSystem round-trip (exposed directories are "data" and "code" by default)
		await FileSystem.writeFile( 'data/test.txt', 'hello from desk-web\n' );
		assert.strictEqual( await FileSystem.readFile( 'data/test.txt' ), 'hello from desk-web\n' );
		assert.strictEqual( await FileSystem.exists( 'data/test.txt' ), true );

		await FileSystem.mkdirp( 'data/desk-web-sub' );
		const listing = await FileSystem.readDir( 'data' );
		assert.ok( listing.some( f => f.name === 'desk-web-sub' ), 'mkdirp created directory' );

		// Promise resolve on success
		const res = await Actions.execute( { action : 'pwd', text : ' ' } );
		assert.ok( res, 'pwd resolved' );

		// The desk-web test pages are served by the desk server at /web/... via
		// the "web" dataDir declared in desk/extensions/desk-web.json.
		const auth = 'Basic ' + Buffer.from( process.env.USER + ':password' ).toString( 'base64' );
		const page = await fetch( baseURL + 'web/example-01-actions.html', { headers : { Authorization : auth } } );
		assert.strictEqual( page.status, 200, 'example page served at /web/' );
		const html = await page.text();
		assert.ok( html.includes( 'desk-web.mjs' ), 'page imports ./desk-web.mjs' );

		const bundle = await fetch( baseURL + 'web/desk-web.mjs', { headers : { Authorization : auth } } );
		assert.strictEqual( bundle.status, 200, 'bundle served at /web/desk-web.mjs' );

		// Promise reject + kill functionality
		const run = Actions.execute( { action : 'sleep', time_in_seconds : 10 }, { stream : true } );
		setTimeout( () => run.kill(), 500 );
		await assert.rejects( run, err => err.killed === true || /killed/.test( err.message ) );

		console.log( 'integration ok (server log tail):\n' + serverLog.split( '\n' ).slice( -3 ).join( '\n' ) );
	} finally {
		lib && lib.Actions && lib.Actions.disconnect && lib.Actions.disconnect();
		child.kill();
		rmSync( rootDir, { recursive : true, force : true } );
		process.exit( 0 );
	}
} );
