/*!
 * child.js - child processes for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var EventEmitter = require('events');
var path = require('path');
var cp = require('child_process');

var children = new _set2.default();
var exitBound = false;

/**
 * Represents a child process.
 * @alias module:workers.Child
 * @constructor
 * @param {String} file
 */

function Child(file) {
  if (!(this instanceof Child)) return new Child(file);

  EventEmitter.call(this);

  bindExit();
  children.add(this);

  this.init(file);
}

(0, _setPrototypeOf2.default)(Child.prototype, EventEmitter.prototype);

/**
 * Test whether child process support is available.
 * @returns {Boolean}
 */

Child.hasSupport = function hasSupport() {
  return true;
};

/**
 * Initialize child process (node.js).
 * @private
 * @param {String} file
 */

Child.prototype.init = function init(file) {
  var _this = this;

  var bin = process.argv[0];
  var filename = path.resolve(__dirname, file);
  var options = { stdio: 'pipe', env: process.env };

  this.child = cp.spawn(bin, [filename], options);

  this.child.unref();
  this.child.stdin.unref();
  this.child.stdout.unref();
  this.child.stderr.unref();

  this.child.on('error', function (err) {
    _this.emit('error', err);
  });

  this.child.once('exit', function (code, signal) {
    children.delete(_this);
    _this.emit('exit', code == null ? -1 : code, signal);
  });

  this.child.stdin.on('error', function (err) {
    _this.emit('error', err);
  });

  this.child.stdout.on('error', function (err) {
    _this.emit('error', err);
  });

  this.child.stderr.on('error', function (err) {
    _this.emit('error', err);
  });

  this.child.stdout.on('data', function (data) {
    _this.emit('data', data);
  });
};

/**
 * Send data to child process.
 * @param {Buffer} data
 * @returns {Boolean}
 */

Child.prototype.write = function write(data) {
  return this.child.stdin.write(data);
};

/**
 * Destroy the child process.
 */

Child.prototype.destroy = function destroy() {
  this.child.kill('SIGTERM');
};

/**
 * Cleanup all child processes.
 * @private
 */

function bindExit() {
  if (exitBound) return;

  exitBound = true;

  listenExit(function () {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = (0, _getIterator3.default)(children), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var child = _step.value;

        child.destroy();
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }
  });
}

/**
 * Listen for exit.
 * @param {Function} handler
 * @private
 */

function listenExit(handler) {
  var onSighup = function onSighup() {
    process.exit(1 | 0x80);
  };

  var onSigint = function onSigint() {
    process.exit(2 | 0x80);
  };

  var onSigterm = function onSigterm() {
    process.exit(15 | 0x80);
  };

  var onError = function onError(err) {
    if (err && err.stack) console.error(String(err.stack));else console.error(String(err));

    process.exit(1);
  };

  process.once('exit', handler);

  if (process.listenerCount('SIGHUP') === 0) process.once('SIGHUP', onSighup);

  if (process.listenerCount('SIGINT') === 0) process.once('SIGINT', onSigint);

  if (process.listenerCount('SIGTERM') === 0) process.once('SIGTERM', onSigterm);

  if (process.listenerCount('uncaughtException') === 0) process.once('uncaughtException', onError);

  process.on('newListener', function (name) {
    switch (name) {
      case 'SIGHUP':
        process.removeListener(name, onSighup);
        break;
      case 'SIGINT':
        process.removeListener(name, onSigint);
        break;
      case 'SIGTERM':
        process.removeListener(name, onSigterm);
        break;
      case 'uncaughtException':
        process.removeListener(name, onError);
        break;
    }
  });
}

/*
 * Expose
 */

module.exports = Child;