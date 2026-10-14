/**
 * desk-web — pure JavaScript client library for the DESK server (no Qooxdoo).
 *
 * Exports the non-UI core of desk-ui as promise-based, ES-module singletons.
 * No globals are created on `window`.
 */
export { Actions } from './actions.js';
export { FileSystem } from './filesystem.js';
export { URLParameters } from './urlparameters.js';
