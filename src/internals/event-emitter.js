/**
 * Minimal event emitter.
 * Provides on/once/off and emit, used for 'changeReady', 'update', 'log', 'actionEvent', ...
 * Internal: not exported from the package index.
 */
export function EventEmitter () {
	this.__listeners = Object.create( null );
	this.__once = Object.create( null );
}

EventEmitter.prototype.on = function ( event, listener, context ) {
	if ( !this.__listeners[ event ] ) this.__listeners[ event ] = [];
	this.__listeners[ event ].push( { fn : listener, ctx : context } );
	return this;
};

EventEmitter.prototype.once = function ( event, listener, context ) {
	if ( !this.__once[ event ] ) this.__once[ event ] = [];
	this.__once[ event ].push( { fn : listener, ctx : context } );
	return this;
};

EventEmitter.prototype.off = function ( event, listener ) {
	if ( listener ) {
		const list = this.__listeners[ event ] || [];
		this.__listeners[ event ] = list.filter( e => e.fn !== listener );
		const once = this.__once[ event ] || [];
		this.__once[ event ] = once.filter( e => e.fn !== listener );
		return this;
	}
	delete this.__listeners[ event ];
	delete this.__once[ event ];
	return this;
};

EventEmitter.prototype.emit = function ( event, data ) {
	const list = this.__listeners[ event ] || [];
	for ( const entry of list.slice() ) {
		try { entry.fn.call( entry.ctx, data ); } catch ( e ) { console.warn( e ); }
	}
	const once = ( this.__once[ event ] || [] ).slice();
	this.__once[ event ] = [];
	for ( const entry of once ) {
		try { entry.fn.call( entry.ctx, data ); } catch ( e ) { console.warn( e ); }
	}
	return this;
};

EventEmitter.prototype.removeAllListeners = function () {
	this.__listeners = Object.create( null );
	this.__once = Object.create( null );
	return this;
};
