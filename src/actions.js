/**
 * Pure-JS RPC action dispatcher for the DESK server.
 * Promise-based, UI-free.
 *
 * Transports:
 *  - "node"  : Socket.IO client to a running desk server (default).
 *  - "static": reads actions.json + cache/responses.json from a static deployment
 *              (used when `static:true` or a `desk_startup_script` global is present).
 */
import { io } from 'socket.io-client';
import { EventEmitter } from './internals/event-emitter.js';
import { getCookie, base64Encode, loadScript, executeScriptText } from './internals/dom.js';

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

class ActionsManager extends EventEmitter {
	constructor () {
		super();
		this.__socket = null;
		this.__baseURL = null;
		this.__settings = { not_initialised : true, actions : [] };
		this.__runningActions = {};
		this.__recordedActions = null;
		this.__engine = false;
		this.__readyPromise = null;
		this.__readyResolve = null;
	}

	/**
	 * @param {Object} [options] { baseURL, username, password, static }
	 * @returns {Promise<void>} resolves when connected (and settings received)
	 */
	connect ( options = {} ) {
		if ( this.__readyPromise ) return this.__readyPromise;

		this.__baseURL = options.baseURL || defaultBaseURL();
		this.__static = options.static || ( typeof window !== 'undefined' &&
			typeof window.desk_startup_script === 'string' );

		this.__readyPromise = new Promise( resolve => {
			this.__readyResolve = resolve;
			if ( this.__static ) this.__initStatic();
			else this.__initNode( options );
		} );

		return this.__readyPromise;
	}

	disconnect () {
		if ( this.__socket ) {
			this.__socket.disconnect();
			this.__socket = null;
		}
		this.__engine = false;
	}

	__initNode ( options ) {
		const baseURL = this.__baseURL;
		let url, path, extraHeaders;
		if ( /^https?:\/\//.test( baseURL ) ) {
			const u = new URL( baseURL );
			url = u.origin;
			path = u.pathname.replace( /\/?$/, '/' ) + 'socket.io';
		} else {
			path = baseURL + 'socket.io';
		}
		if ( options.username && options.password ) {
			extraHeaders = { Authorization : 'Basic ' + base64Encode( options.username + ':' + options.password ) };
		}

		const socket = this.__socket = io( url, {
			path,
			extraHeaders,
			transports : [ 'polling', 'websocket' ]
		} );

		this.__engine = 'node';

		socket.on( 'connect', () => {
			this.emit( 'connect' );
			this.__readyResolve();
		} );
		socket.on( 'disconnect', reason => {
			console.warn( 'disconnected from server : ' + reason );
			this.emit( 'disconnect', reason );
		} );
		socket.on( 'log', msg => this.emit( 'log', msg ) );
		socket.on( 'actionEvent', msg => this.emit( 'actionEvent', msg ) );
		socket.on( 'action started', POST => {
			this.__runningActions[ POST.handle ] = { POST };
			this.emit( 'action started', POST );
		} );
		socket.on( 'action finished', res => this.__onActionEnd( res ) );
		socket.on( 'actions updated', settings => this.__setSettings( settings ) );
	}

	async __initStatic () {
		const { FileSystem } = await import( './filesystem.js' );
		this.__engine = 'static';
		const [ settings, cache ] = await Promise.all( [
			FileSystem.readFile( 'actions.json', { forceText : true } ).then( JSON.parse ).catch( () => ( {} ) ),
			FileSystem.readFile( 'cache/responses.json', { forceText : true } ).then( JSON.parse ).catch( () => null )
		] );
		this.__recordedActions = cache ? cache.actions : null;
		this.__setSettings( settings );
	}

	/**
	 * Executes an action. Returns a Promise augmented with:
	 *   .handle  (string, available synchronously)
	 *   .stream(cb)  (register per-run stdout/stderr listener)
	 *   .kill()      (send manage kill, returns a Promise)
	 * The promise resolves with the response, or rejects on error/kill.
	 *
	 * @param params {Object} action parameters
	 * @param options {Object} { stream : boolean }
	 * @returns {Promise} augmented promise
	 */
	execute ( params, options = {} ) {
		const handle = params.handle = params.handle || Math.random().toString();
		const listeners = new Set();
		let settled = false;

		if ( !this.__engine ) {
			return Promise.reject( new Error( 'desk-web Actions not connected. Call Actions.connect() first.' ) );
		}

		let onEvent = null;
		if ( options.stream ) {
			onEvent = msg => {
				if ( msg.handle === handle ) listeners.forEach( fn => fn( msg ) );
			};
			this.on( 'actionEvent', onEvent );
		}

		const promise = new Promise( ( resolve, reject ) => {
			const onEnd = res => {
				if ( res.handle !== handle ) return;
				this.off( 'action finished', onEnd );
				settled = true;
				if ( res.error || res.killed ) reject( toError( res ) );
				else resolve( res );
			};

			if ( this.__recordedActions && this.__engine === 'static' ) {
				this.__runRecorded( params, handle, resolve, reject );
				return;
			}

			this.on( 'action finished', onEnd );
			if ( !this.__socket ) { reject( new Error( 'not connected' ) ); return; }
			this.__socket.emit( 'action', params );
		} );

		// Clean up per-run stream listener when the run settles.
		if ( onEvent ) {
			promise.then(
				() => this.off( 'actionEvent', onEvent ),
				() => this.off( 'actionEvent', onEvent ) );
		}

		promise.handle = handle;
		promise.stream = cb => { listeners.add( cb ); return promise; };
		promise.kill = () => {
			if ( settled ) return Promise.resolve( {} );
			return this.execute( { manage : 'kill', actionHandle : handle } );
		};
		return promise;
	}

	async __runRecorded ( params, handle, resolve, reject ) {
		// static / recorded mode
		const { sha1 } = await import( './internals/sha1.js' );
		const parameters = { ...params };
		delete parameters.handle;
		const sha = await sha1( JSON.stringify( parameters ) );
		const response = this.__recordedActions[ sha ];
		if ( !response ) {
			reject( new Error( 'Error : action not found' ) );
			return;
		}
		const res = { ...response, handle };
		setTimeout( () => {
			if ( res.error || res.killed ) reject( toError( res ) );
			else resolve( res );
		}, 1 );
	}

	async __onActionEnd ( res ) {
		this.emit( 'action finished', res );
		delete this.__runningActions[ res.handle ];
	}

	/**
	 * Sets the current settings (from server or static actions.json).
	 */
	__setSettings ( settings ) {
		const wasInit = this.__settings && !this.__settings.not_initialised;
		this.__settings = settings || this.__settings;
		if ( settings?.init && !wasInit && !this.__static ) {
			this.includeInitScripts( settings.init ).then(
				() => this.emit( 'changeReady' ),
				e => console.warn( e ) );
		} else if ( !wasInit ) {
			this.emit( 'changeReady' );
		}
	}

	/**
	 * Loads the server-provided init scripts (code/init/*.js).
	 * @param init {Array} list of init file paths
	 */
	async includeInitScripts ( init ) {
		if ( !init ) return;
		const { FileSystem } = await import( './filesystem.js' );
		await Promise.all( ( init || [] ).map( async file => {
			const url = FileSystem.getFileURL( file );
			await loadScript( url );
		} ) );
	}

	getSettings () {
		return JSON.parse( JSON.stringify( this.__settings ) );
	}

	getAction ( name ) {
		const action = this.__settings.actions?.[ name ];
		return action ? JSON.parse( JSON.stringify( action ) ) : null;
	}

	getEngine () {
		return this.__engine;
	}

	getBaseURL () {
		return this.__baseURL;
	}

	getSocket () {
		return this.__socket;
	}

	isConnected () {
		return !!( this.__socket && this.__socket.connected );
	}

	/**
	 * Promise resolving when the actions list is ready.
	 * @returns {Promise<void>}
	 */
	init () {
		return this.__readyPromise.then( () => new Promise( resolve => {
			if ( this.__settings && !this.__settings.not_initialised ) resolve();
			else this.once( 'changeReady', resolve );
		} ) );
	}
}

function toError ( res ) {
	const err = new Error( ( res.error && ( res.error.message || JSON.stringify( res.error ) ) )
		|| ( res.killed ? 'action killed' : 'action failed' ) );
	err.response = res;
	err.status = res.status;
	err.killed = res.killed;
	return err;
}

export const Actions = new ActionsManager();
