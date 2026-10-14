/**
 * DOM / browser helpers.
 * Provides the browser helpers (Xhr, request.Script, Cookie, Base64).
 * Internal: not exported from the package index.
 */

/**
 * Reads a URL using fetch. Rejects with an Error on HTTP failure.
 * @param {string} url
 * @param {Object} [options] {cache: boolean|{timeStamp}, forceText}
 * @returns {Promise<string>}
 */
export async function readURL ( url, options = {} ) {
	if ( !options.cache ) url += ( url.includes( '?' ) ? '&' : '?' ) + 'nocache=' + Math.random();
	else if ( options.cache?.timeStamp ) url += ( url.includes( '?' ) ? '&' : '?' ) + 'nocache=' + options.cache.timeStamp;

	const res = await fetch( url );
	if ( !res.ok ) throw new Error( 'readURL failed (' + res.status + ') : ' + url );
	return res.text();
}

/**
 * Injects a script by URL and resolves when it has loaded.
 * @param {string} url
 * @returns {Promise<void>}
 */
export function loadScript ( url ) {
	return new Promise( ( resolve, reject ) => {
		const script = document.createElement( 'script' );
		script.src = url.includes( '?' ) ? url + '&cache=' + Math.random() : url + '?cache=' + Math.random();
		script.onload = () => { script.remove(); resolve(); };
		script.onerror = () => { script.remove(); reject( new Error( 'Could not load ' + url ) ); };
		document.head.appendChild( script );
	} );
}

/**
 * Executes raw JS text as a script in the document.
 * @param {string} content
 * @param {string} [file] source name for debugging
 */
export function executeScriptText ( content, file ) {
	const script = document.createElement( 'script' );
	script.setAttribute( 'type', 'text/javascript' );
	script.text = content + ( file ? '\n//# sourceURL=' + file : '' );
	document.head.appendChild( script );
	script.remove();
}

/**
 * Reads a cookie value by name.
 * @param {string} name
 * @returns {string|undefined}
 */
export function getCookie ( name ) {
	const prefix = name + '=';
	const cookies = document.cookie.split( ';' );
	for ( let c of cookies ) {
		c = c.trim();
		if ( c.startsWith( prefix ) ) return decodeURIComponent( c.slice( prefix.length ) );
	}
	return undefined;
}

/**
 * Base64-encodes a string without line breaks.
 * @param {string} str
 * @returns {string}
 */
export function base64Encode ( str ) {
	return btoa( unescape( encodeURIComponent( str ) ) );
}

/**
 * Base64-decodes a string to a unicode string.
 * @param {string} str
 * @returns {string}
 */
export function base64Decode ( str ) {
	return decodeURIComponent( escape( atob( str ) ) );
}
