import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

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
