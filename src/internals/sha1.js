/**
 * SHA-1 helper built on the native Web Crypto API.
 * Async because crypto.subtle is async.
 * Internal: not exported from the package index.
 */

/**
 * @param {string} data
 * @returns {Promise<string>} hex-encoded SHA-1 digest
 */
export async function sha1 ( data ) {
	const buf = await crypto.subtle.digest( 'SHA-1', new TextEncoder().encode( data ) );
	return hex( buf );
}

function hex ( buffer ) {
	const bytes = new Uint8Array( buffer );
	let out = '';
	for ( let i = 0; i < bytes.length; i++ ) out += bytes[ i ].toString( 16 ).padStart( 2, '0' );
	return out;
}
