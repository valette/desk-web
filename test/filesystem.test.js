import { test } from 'node:test';
import assert from 'node:assert';
import { FileSystem } from '../src/filesystem.js';

FileSystem.setBaseURL( 'http://localhost:8080/desk/' );

test( 'getFileDirectory returns directory with trailing slash', () => {
	assert.strictEqual( FileSystem.getFileDirectory( 'a/b/c.txt' ), 'a/b/' );
	assert.strictEqual( FileSystem.getFileDirectory( 'c.txt' ), '/' );
} );

test( 'getFileName extracts the basename', () => {
	assert.strictEqual( FileSystem.getFileName( 'a/b/c.txt' ), 'c.txt' );
	assert.strictEqual( FileSystem.getFileName( 'c.txt' ), 'c.txt' );
} );

test( 'getFileExtension returns the extension', () => {
	assert.strictEqual( FileSystem.getFileExtension( 'a/b/c.txt' ), 'txt' );
	assert.strictEqual( FileSystem.getFileExtension( 'noext' ), '' );
} );

test( 'getFileURL prepends baseURL', () => {
	assert.strictEqual( FileSystem.getFileURL( 'foo/bar.js' ), 'http://localhost:8080/desk/foo/bar.js' );
} );

test( 'getFileURL handles /home prefix', () => {
	assert.strictEqual( FileSystem.getFileURL( '/home/someuser/foo.js' ), 'http://localhost:8080/desk/home/foo.js' );
} );

test( 'getFileURL rejects non-home absolute paths', () => {
	assert.throws( () => FileSystem.getFileURL( '/etc/passwd' ) );
} );
