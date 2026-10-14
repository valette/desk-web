/**
 * Singleton helper class for parsing URL parameters.
 */
class URLParametersManager {
	constructor () {
		this.parameters = {};
		const href = typeof window !== 'undefined' ? window.location.href : '';
		const split = href.split( '?' );
		if ( split.length < 2 ) return;
		const line = split.pop();
		for ( let param of line.split( '&' ) ) {
			if ( !param ) continue;
			let [ name, value ] = param.split( '=' );
			try { value = JSON.parse( value ); } catch ( e ) {}
			this.parameters[ name ] = value;
		}
	}

	/**
	 * returns the URL provided parameter if it exists
	 * e.g. : www.myadress.com/desk/?myParam=hello
	 * @param name {String} parameter name
	 * @return {*} parameter value (undefined if absent)
	 */
	getParameter ( name ) {
		return this.parameters[ name ];
	}

	/**
	 * modify the params object with URL parameters when provided.
	 * Can parse strings, booleans, floats and arrays.
	 * @param params {Object} parameters
	 */
	parseParameters ( params ) {
		function parse ( value ) {
			let parsed = value;
			try { parsed = JSON.parse( value ); } catch ( e ) {}
			return parsed;
		}

		const names = Object.keys( params );

		for ( let [ key, value ] of Object.entries( this.parameters ) ) {
			if ( !names.includes( key ) ) {
				console.warn( 'Parameter ' + key + ' is not a proposed parameter' );
				continue;
			}
			const oldValue = params[ key ];
			if ( Array.isArray( oldValue ) && !Array.isArray( value ) )
				value = value.split( ',' ).map( parse );
			params[ key ] = value;
		}

		console.log( 'URL parameters : ' );
		console.log( params );
		return params;
	}
}

export const URLParameters = new URLParametersManager();
