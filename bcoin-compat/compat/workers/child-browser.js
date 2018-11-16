/*!
 * child.js - child processes for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var EventEmitter = require('events');

/**
 * Represents a child process.
 * @alias module:workers.Child
 * @constructor
 * @ignore
 * @param {String} file
 */

function Child(file) {
  if (!(this instanceof Child)) return new Child(file);

  EventEmitter.call(this);

  this.init(file);
}

(0, _setPrototypeOf2.default)(Child.prototype, EventEmitter.prototype);

/**
 * Test whether child process support is available.
 * @returns {Boolean}
 */

Child.hasSupport = function hasSupport() {
  return typeof global.postMessage === 'function';
};

/**
 * Initialize child process. Bind to events.
 * @private
 * @param {String} file
 */

Child.prototype.init = function init(file) {
  var _this = this;

  this.child = new global.Worker(file);

  this.child.onerror = function (event) {
    _this.emit('error', new Error('Child error.'));
    _this.emit('exit', 1, null);
  };

  this.child.onmessage = function (event) {
    var data = void 0;
    if (typeof event.data === 'string') {
      data = Buffer.from(event.data, 'hex');
      assert(data.length === event.data.length / 2);
    } else {
      assert(event.data && (0, _typeof3.default)(event.data) === 'object');
      assert(event.data.data && typeof event.data.data.length === 'number');
      data = event.data.data;
      data.__proto__ = Buffer.prototype;
    }
    _this.emit('data', data);
  };
};

/**
 * Send data to child process.
 * @param {Buffer} data
 * @returns {Boolean}
 */

Child.prototype.write = function write(data) {
  if (this.child.postMessage.length === 2) {
    data.__proto__ = Uint8Array.prototype;
    this.child.postMessage({ data: data }, [data]);
  } else {
    this.child.postMessage(data.toString('hex'));
  }
  return true;
};

/**
 * Destroy the child process.
 */

Child.prototype.destroy = function destroy() {
  this.child.terminate();
  this.emit('exit', 15 | 0x80, 'SIGTERM');
};

/*
 * Expose
 */

module.exports = Child;