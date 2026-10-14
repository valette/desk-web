/**
 * desk-web — pure JavaScript client library for the DESK server.
 *
 * Exports the non-UI core as promise-based, ES-module singletons.
 * No globals are created on `window`.
 */
export { Actions } from './actions.js';
export { FileSystem } from './filesystem.js';
export { URLParameters } from './urlparameters.js';
