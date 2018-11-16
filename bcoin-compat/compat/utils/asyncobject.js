/*!
 * async.js - async object class for bcoin
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var EventEmitter = require('events');
var Lock = require('./lock');

/**
 * An abstract object that handles state and
 * provides recallable open and close methods.
 * @alias module:utils.AsyncObject
 * @constructor
 * @property {Boolean} loading
 * @property {Boolean} closing
 * @property {Boolean} loaded
 */

function AsyncObject() {
  assert(this instanceof AsyncObject);

  EventEmitter.call(this);

  this._asyncLock = new Lock();
  this._hooks = (0, _create2.default)(null);

  this.loading = false;
  this.closing = false;
  this.loaded = false;
}

(0, _setPrototypeOf2.default)(AsyncObject.prototype, EventEmitter.prototype);

/**
 * Open the object (recallable).
 * @method
 * @returns {Promise}
 */

AsyncObject.prototype.open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var unlock;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return this._asyncLock.lock();

          case 2:
            unlock = _context.sent;
            _context.prev = 3;
            _context.next = 6;
            return this.__open();

          case 6:
            return _context.abrupt('return', _context.sent);

          case 7:
            _context.prev = 7;

            unlock();
            return _context.finish(7);

          case 10:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[3,, 7, 10]]);
  }));

  function open() {
    return _ref.apply(this, arguments);
  }

  return open;
}();

/**
 * Open the object (without a lock).
 * @method
 * @private
 * @returns {Promise}
 */

AsyncObject.prototype.__open = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (!this.loaded) {
              _context2.next = 2;
              break;
            }

            return _context2.abrupt('return');

          case 2:
            _context2.next = 4;
            return this.fire('preopen');

          case 4:

            this.loading = true;

            _context2.prev = 5;
            _context2.next = 8;
            return this._open();

          case 8:
            _context2.next = 15;
            break;

          case 10:
            _context2.prev = 10;
            _context2.t0 = _context2['catch'](5);

            this.loading = false;
            this.emit('error', _context2.t0);
            throw _context2.t0;

          case 15:

            this.loading = false;
            this.loaded = true;

            _context2.next = 19;
            return this.fire('open');

          case 19:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[5, 10]]);
  }));

  function __open() {
    return _ref2.apply(this, arguments);
  }

  return __open;
}();

/**
 * Close the object (recallable).
 * @method
 * @returns {Promise}
 */

AsyncObject.prototype.close = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
    var unlock;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return this._asyncLock.lock();

          case 2:
            unlock = _context3.sent;
            _context3.prev = 3;
            _context3.next = 6;
            return this.__close();

          case 6:
            return _context3.abrupt('return', _context3.sent);

          case 7:
            _context3.prev = 7;

            unlock();
            return _context3.finish(7);

          case 10:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this, [[3,, 7, 10]]);
  }));

  function close() {
    return _ref3.apply(this, arguments);
  }

  return close;
}();

/**
 * Close the object (without a lock).
 * @method
 * @private
 * @returns {Promise}
 */

AsyncObject.prototype.__close = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4() {
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            if (this.loaded) {
              _context4.next = 2;
              break;
            }

            return _context4.abrupt('return');

          case 2:
            _context4.next = 4;
            return this.fire('preclose');

          case 4:

            this.closing = true;

            _context4.prev = 5;
            _context4.next = 8;
            return this._close();

          case 8:
            _context4.next = 15;
            break;

          case 10:
            _context4.prev = 10;
            _context4.t0 = _context4['catch'](5);

            this.closing = false;
            this.emit('error', _context4.t0);
            throw _context4.t0;

          case 15:

            this.closing = false;
            this.loaded = false;

            _context4.next = 19;
            return this.fire('close');

          case 19:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[5, 10]]);
  }));

  function __close() {
    return _ref4.apply(this, arguments);
  }

  return __close;
}();

/**
 * Close the object (recallable).
 * @method
 * @returns {Promise}
 */

AsyncObject.prototype.destroy = AsyncObject.prototype.close;

/**
 * Initialize the object.
 * @private
 * @returns {Promise}
 */

AsyncObject.prototype._open = function _open(callback) {
  throw new Error('Abstract method.');
};

/**
 * Close the object.
 * @private
 * @returns {Promise}
 */

AsyncObject.prototype._close = function _close(callback) {
  throw new Error('Abstract method.');
};

/**
 * Add a hook listener.
 * @param {String} type
 * @param {Function} handler
 */

AsyncObject.prototype.hook = function hook(type, handler) {
  assert(typeof type === 'string', '`type` must be a string.');

  if (!this._hooks[type]) this._hooks[type] = [];

  this._hooks[type].push(handler);
};

/**
 * Emit events and hooks for type.
 * @method
 * @param {String} type
 * @param {...Object} args
 * @returns {Promise}
 */

AsyncObject.prototype.fire = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5() {
    var _args5 = arguments;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.next = 2;
            return this.fireHook.apply(this, _args5);

          case 2:
            this.emit.apply(this, _args5);

          case 3:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function fire() {
    return _ref5.apply(this, arguments);
  }

  return fire;
}();

/**
 * Emit an asynchronous event (hook).
 * Wait for promises to resolve.
 * @method
 * @param {String} type
 * @param {...Object} args
 * @returns {Promise}
 */

AsyncObject.prototype.fireHook = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(type) {
    var listeners,
        args,
        _iteratorNormalCompletion,
        _didIteratorError,
        _iteratorError,
        _iterator,
        _step,
        handler,
        i,
        _args6 = arguments;

    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            assert(typeof type === 'string', '`type` must be a string.');

            listeners = this._hooks[type];

            if (!(!listeners || listeners.length === 0)) {
              _context6.next = 4;
              break;
            }

            return _context6.abrupt('return');

          case 4:
            args = void 0;
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context6.prev = 8;
            _iterator = (0, _getIterator3.default)(listeners);

          case 10:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context6.next = 34;
              break;
            }

            handler = _step.value;
            _context6.t0 = _args6.length;
            _context6.next = _context6.t0 === 1 ? 15 : _context6.t0 === 2 ? 18 : _context6.t0 === 3 ? 21 : _context6.t0 === 4 ? 24 : 27;
            break;

          case 15:
            _context6.next = 17;
            return handler();

          case 17:
            return _context6.abrupt('break', 31);

          case 18:
            _context6.next = 20;
            return handler(_args6[1]);

          case 20:
            return _context6.abrupt('break', 31);

          case 21:
            _context6.next = 23;
            return handler(_args6[1], _args6[2]);

          case 23:
            return _context6.abrupt('break', 31);

          case 24:
            _context6.next = 26;
            return handler(_args6[1], _args6[2], _args6[3]);

          case 26:
            return _context6.abrupt('break', 31);

          case 27:
            if (!args) {
              args = new Array(_args6.length - 1);
              for (i = 1; i < _args6.length; i++) {
                args[i - 1] = _args6[i];
              }
            }
            _context6.next = 30;
            return handler.apply(null, args);

          case 30:
            return _context6.abrupt('break', 31);

          case 31:
            _iteratorNormalCompletion = true;
            _context6.next = 10;
            break;

          case 34:
            _context6.next = 40;
            break;

          case 36:
            _context6.prev = 36;
            _context6.t1 = _context6['catch'](8);
            _didIteratorError = true;
            _iteratorError = _context6.t1;

          case 40:
            _context6.prev = 40;
            _context6.prev = 41;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 43:
            _context6.prev = 43;

            if (!_didIteratorError) {
              _context6.next = 46;
              break;
            }

            throw _iteratorError;

          case 46:
            return _context6.finish(43);

          case 47:
            return _context6.finish(40);

          case 48:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this, [[8, 36, 40, 48], [41,, 43, 47]]);
  }));

  function fireHook(_x) {
    return _ref6.apply(this, arguments);
  }

  return fireHook;
}();

/*
 * Expose
 */

module.exports = AsyncObject;