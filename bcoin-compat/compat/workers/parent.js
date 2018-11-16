/*!
 * parent.js - worker processes for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var EventEmitter = require('events');

/**
 * Represents the parent process.
 * @alias module:workers.Parent
 * @constructor
 */

function Parent() {
  if (!(this instanceof Parent)) return new Parent();

  EventEmitter.call(this);

  this.init();
}

(0, _setPrototypeOf2.default)(Parent.prototype, EventEmitter.prototype);

/**
 * Initialize master (node.js).
 * @private
 */

Parent.prototype.init = function init() {
  var _this = this;

  process.stdin.on('data', function (data) {
    _this.emit('data', data);
  });

  // Nowhere to send these errors:
  process.stdin.on('error', function () {});
  process.stdout.on('error', function () {});
  process.stderr.on('error', function () {});

  process.on('uncaughtException', function (err) {
    _this.emit('exception', err);
  });
};

/**
 * Send data to parent process.
 * @param {Buffer} data
 * @returns {Boolean}
 */

Parent.prototype.write = function write(data) {
  return process.stdout.write(data);
};

/**
 * Destroy the parent process.
 */

Parent.prototype.destroy = function destroy() {
  return process.exit(0);
};

/*
 * Expose
 */

module.exports = Parent;