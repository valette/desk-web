/**
 * Pure-JS virtual file system for the DESK server.
 * Promise-based port of desk-ui's desk.FileSystem (no Qooxdoo).
 * Reads use fetch; writes and directory operations use the RPC action engine (Actions.execute).
 */
import { Actions } from './actions.js';
import { readURL as fetchReadURL, loadScript, executeScriptText, getCookie, base64Encode } from './internals/dom.js';

function defaultBaseURL () {
	const cookie = getCookie( 'homeURL' );
	if ( cookie ) return cookie;
	const href = window.location.href.split( '?' ).shift();
	const extension = href.split( '/' ).pop().split( '?' )[ 0 ].split( '.' ).pop();
	let h = href;
	if ( extension === 'html' ) {
		const parts = href.split( '/' );
		parts.pop();
		h = parts.join( '/' ) + '/';
	}
	return h;
}

class FileSystemManager {
	constructor () {
		this.__baseURL = null;
	}

	/**
	 * Sets the base URL used to resolve file paths. Normally set automatically
	 * by Actions.connect(); call explicitly if used standalone.
	 * @param {string} baseURL
	 */
	setBaseURL ( baseURL ) {
		this.__baseURL = baseURL;
	}

	getBaseURL () {
		if ( !this.__baseURL ) this.__baseURL = Actions.getBaseURL() || defaultBaseURL();
		return this.__baseURL;
	}

	/**
	 * Loads a file into memory (text). Promise resolves with the content string.
	 * @param file {String} file path
	 * @param options {Object} { cache, forceText }
	 * @returns {Promise<string>}
	 */
	readFile ( file, options = {} ) {
		return this.readURL( this.getFileURL( file ), options );
	}

	/**
	 * Loads a URL into memory (text).
	 * @param url {String} the url to load
	 * @param options {Object} { cache }
	 * @returns {Promise<string>}
	 */
	readURL ( url, options = {} ) {
		return fetchReadURL( url, options );
	}

	/**
	 * Writes content to a file.
	 * @param file {String} file path
	 * @param content {String} content (or {base64data} when binary)
	 * @param options {Object} { binary : boolean }
	 * @returns {Promise<Object>} RPC response
	 */
	writeFile ( file, content, options = {} ) {
		if ( options.binary ) {
			return Actions.execute( {
				action : 'write_binary',
				file_name : this.getFileName( file ),
				data : base64Encode( content ),
				output_directory : this.getFileDirectory( file )
			} );
		}
		return Actions.execute( {
			action : 'write_string',
			file_name : this.getFileName( file ),
			data : content,
			output_directory : this.getFileDirectory( file )
		} );
	}

	/**
	 * Writes an object to a JSON file.
	 * @param file {String} file path
	 * @param content {Object} object to write
	 * @returns {Promise<Object>} RPC response
	 */
	writeJSON ( file, content ) {
		return Actions.execute( {
			action : 'write_string',
			file_name : this.getFileName( file ),
			data : JSON.stringify( content ),
			output_directory : this.getFileDirectory( file )
		} );
	}

	/**
	 * Writes content to a cached file (content-addressed by SHA-1).
	 * @param name {String} the file name
	 * @param content {String} the content
	 * @returns {Promise<String>} the resulting cache file path
	 */
	async writeCachedFile ( name, content ) {
		const { sha1 } = await import( './internals/sha1.js' );
		const hash = await sha1( content );
		const file = 'cache/' + hash[ 0 ] + '/' + hash[ 1 ] + '/' + hash + '/' + name;
		if ( await this.exists( file ) ) return file;
		await this.writeFile( file, content );
		return file;
	}

	/**
	 * Creates a (possibly already existing) directory.
	 * @param dir {String} the directory to create
	 * @returns {Promise<Object>} RPC response
	 */
	mkdirp ( dir ) {
		return Actions.execute( { action : 'mkdirp', directory : dir } );
	}

	/**
	 * Tests whether a file (or directory) exists.
	 * @param path {String} the path to test
	 * @returns {Promise<boolean>}
	 */
	async exists ( path ) {
		try {
			const res = await Actions.execute( { action : 'exists', path, stdout : true } );
			return res?.stdout ? JSON.parse( res.stdout ) : false;
		} catch ( e ) {
			return false;
		}
	}

	/**
	 * Gets the list of files in a directory.
	 * @param path {String} the directory to list
	 * @returns {Promise<Array>} array of { name, isDirectory, ... }
	 */
	async readDir ( path ) {
		const res = await Actions.execute( { action : 'ls', directory : path, stdout : true } );
		return res?.stdout ? JSON.parse( res.stdout ) : [];
	}

	/**
	 * Traverses all files contained in the input directory.
	 * @param directory {String} directory path
	 * @param iterator {Function} iterator applied to each file name
	 * @param opts {Object} { asynchronous : Boolean }
	 * @returns {Promise<void>}
	 */
	traverse ( directory, iterator, opts = {} ) {
		const asynchronous = !!opts.asynchronous;
		const join = ( a, b ) => a.replace( /\/$/, '' ) + '/' + b;
		const queue = [ directory ];
		const results = [];

		return new Promise( ( resolve, reject ) => {
			const step = () => {
				if ( !queue.length ) { resolve( results ); return; }
				const dir = queue.shift();
				this.readDir( dir ).then( files => {
					const jobs = [];
					for ( const file of files ) {
						const fullFile = join( dir, file.name );
						if ( file.isDirectory ) queue.push( fullFile );
						else jobs.push( ( async () => {
							if ( asynchronous ) await iterator( fullFile );
							else iterator( fullFile );
						} )() );
					}
					Promise.all( jobs ).then( step, reject );
				}, reject );
			};
			step();
		} );
	}

	/**
	 * Executes the javascript code in file.
	 * @param file {String} the file to execute
	 * @returns {Promise<void>}
	 */
	async executeScript ( file ) {
		const content = await this.readFile( file );
		const body = '(function (__dirname) {' + content + '\n})("' +
			this.getFileDirectory( file ) + '")';
		executeScriptText( body, file );
	}

	/**
	 * Includes the scripts provided in the input array (by URL).
	 * @param scripts {Array} the script URLs to load
	 * @returns {Promise<void>}
	 */
	async includeScripts ( scripts ) {
		for ( const url of scripts ) await loadScript( url );
	}

	/**
	 * Translates a file path to an URL.
	 * @param file {String} file path
	 * @returns {String} the file URL
	 */
	getFileURL ( file ) {
		if ( file.startsWith( '/' ) ) {
			const entries = file.split( '/' );
			entries.shift();
			const first = entries.shift();
			if ( first !== 'home' ) throw new Error( 'cannot acces to ' + file );
			const second = entries.shift();
			file = file.replace( '/' + first + '/' + second, 'home' );
		}
		return this.getBaseURL() + file;
	}

	/**
	 * Extracts the directory from an input file.
	 * @param file {String} the file
	 * @returns {String} directory the file resides in (with trailing '/')
	 */
	getFileDirectory ( file ) {
		const slashIndex = file.lastIndexOf( '/' );
		return slashIndex >= 0 ? file.substring( 0, slashIndex + 1 ) : '/';
	}

	/**
	 * Returns the file extension.
	 * @param file {String} the file
	 * @returns {String} file extension
	 */
	getFileExtension ( file ) {
		const dotIndex = file.lastIndexOf( '.' );
		return dotIndex >= 0 ? file.substring( dotIndex + 1 ) : '';
	}

	/**
	 * Extracts the name from an input file (without full path).
	 * @param file {String} the file
	 * @returns {String} name of the file
	 */
	getFileName ( file ) {
		const slashIndex = file.lastIndexOf( '/' );
		return slashIndex >= 0 ? file.substring( slashIndex + 1 ) : file;
	}

	/**
	 * Downloads a file to the local disk.
	 * @param file {String} file path
	 * @param downloadName {String} optional download name
	 */
	downloadFile ( file, downloadName ) {
		const a = document.createElement( 'a' );
		a.href = this.getFileURL( file );
		document.body.appendChild( a );
		a.download = downloadName || this.getFileName( file );
		a.click();
		document.body.removeChild( a );
	}

	/**
	 * Returns the directory for the given file, session type and Id.
	 * @param file {String} file path
	 * @param sessionType {String} session type
	 * @param sessionId {Number} session Id
	 * @returns {String} directory path
	 */
	getSessionDirectory ( file, sessionType, sessionId ) {
		return file + '.' + sessionType + '.' + sessionId;
	}

	/**
	 * Lists the existing sessions (directories) of the given type for a file.
	 * @param file {String} file path
	 * @param sessionType {String} session type
	 * @returns {Promise<Array<Number>>} session ids, descending
	 */
	async getFileSessions ( file, sessionType ) {
		const directory = this.getFileDirectory( file );
		const shortFileName = this.getFileName( file );
		const files = await this.readDir( directory );
		const sessions = [];
		for ( const child of files ) {
			const childName = child.name;
			if ( !child.isDirectory ) continue;
			if ( !childName.startsWith( shortFileName + '.' ) ) continue;
			const remaining = childName.substring( shortFileName.length + 1 );
			if ( remaining.startsWith( sessionType + '.' ) ) {
				sessions.push( parseInt( remaining.substring( sessionType.length + 1 ), 10 ) );
			}
		}
		return sessions.sort( ( a, b ) => b - a );
	}

	/**
	 * Creates a new session for a file of the given type.
	 * @param file {String} file path
	 * @param sessionType {String} session type
	 * @returns {Promise<Number>} the new session id
	 */
	async createNewSession ( file, sessionType ) {
		const sessions = await this.getFileSessions( file, sessionType );
		const newSessionId = sessions.length ? Math.max( ...sessions ) + 1 : 0;
		const lastSlash = file.lastIndexOf( '/' );
		const subdir = file.substring( lastSlash + 1 ) + '.' + sessionType + '.' + newSessionId;
		await Actions.execute( {
			action : 'add_subdirectory',
			subdirectory_name : subdir,
			output_directory : file.substring( 0, lastSlash )
		} );
		return newSessionId;
	}
}

export const FileSystem = new FileSystemManager();
