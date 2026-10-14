import { build } from 'esbuild';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

mkdirSync( 'dist', { recursive : true } );

const common = {
	entryPoints : [ 'src/index.js' ],
	bundle : true,
	sourcemap : true,
	target : [ 'es2020', 'chrome90', 'firefox90', 'safari14' ]
};

// Browser ESM: bundle everything (bare specifiers don't resolve in <script type=module>).
await build( { ...common, format : 'esm', outfile : 'dist/desk-web.mjs' } );

// Node CommonJS: keep socket.io-client external (resolved from node_modules via require).
await build( {
	...common,
	format : 'cjs',
	outfile : 'dist/desk-web.cjs',
	external : [ 'socket.io-client' ]
} );

console.log( 'built dist/desk-web.mjs (bundled) and dist/desk-web.cjs (external socket.io-client)' );

// Copy the example pages into dist/ so they can be served alongside the bundle
// by a desk server dataDir. The source pages import the bundle relative to
// examples/ as '../dist/desk-web.mjs'; rewrite that to './desk-web.mjs' so the
// copy in dist/ resolves to the bundle sitting next to it.
for ( const file of readdirSync( 'examples' ).filter( f => f.endsWith( '.html' ) ) ) {
	const html = readFileSync( path.join( 'examples', file ), 'utf8' )
		.replaceAll( '../dist/desk-web.mjs', './desk-web.mjs' );
	writeFileSync( path.join( 'dist', file ), html );
	console.log( 'copied examples/' + file + ' -> dist/' + file );
}
