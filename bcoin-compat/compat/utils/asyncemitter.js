/*!
 * asyncemitter.js - event emitter which resolves promises.
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

"use strict";

var _regenerator = require("babel-runtime/regenerator");

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require("babel-runtime/helpers/asyncToGenerator");

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _getIterator2 = require("babel-runtime/core-js/get-iterator");

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _isSafeInteger = require("babel-runtime/core-js/number/is-safe-integer");

var _isSafeInteger2 = _interopRequireDefault(_isSafeInteger);

var _create = require("babel-runtime/core-js/object/create");

var _create2 = _interopRequireDefault(_create);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require("assert");

/**
 * Represents a promise-resolving event emitter.
 * @alias module:utils.AsyncEmitter
 * @see EventEmitter
 * @constructor
 */

function AsyncEmitter() {
  if (!(this instanceof AsyncEmitter)) return new AsyncEmitter();

  this._events = (0, _create2.default)(null);
}

/**
 * Add a listener.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.addListener = function addListener(type, handler) {
  return this._push(type, handler, false);
};

/**
 * Add a listener.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.on = function on(type, handler) {
  return this.addListener(type, handler);
};

/**
 * Add a listener to execute once.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.once = function once(type, handler) {
  return this._push(type, handler, true);
};

/**
 * Prepend a listener.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.prependListener = function prependListener(type, handler) {
  return this._unshift(type, handler, false);
};

/**
 * Prepend a listener to execute once.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.prependOnceListener = function prependOnceListener(type, handler) {
  return this._unshift(type, handler, true);
};

/**
 * Push a listener.
 * @private
 * @param {String} type
 * @param {Function} handler
 * @param {Boolean} once
 */

AsyncEmitter.prototype._push = function _push(type, handler, once) {
  assert(typeof type === "string", "`type` must be a string.");

  if (!this._events[type]) this._events[type] = [];

  this._events[type].push(new Listener(handler, once));

  this.emit("newListener", type, handler);
};

/**
 * Unshift a listener.
 * @param {String} type
 * @param {Function} handler
 * @param {Boolean} once
 */

AsyncEmitter.prototype._unshift = function _unshift(type, handler, once) {
  assert(typeof type === "string", "`type` must be a string.");

  if (!this._events[type]) this._events[type] = [];

  this._events[type].unshift(new Listener(handler, once));

  this.emit("newListener", type, handler);
};

/**
 * Remove a listener.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.removeListener = function removeListener(type, handler) {
  assert(typeof type === "string", "`type` must be a string.");

  var listeners = this._events[type];

  if (!listeners) return;

  var index = -1;

  for (var i = 0; i < listeners.length; i++) {
    var listener = listeners[i];
    if (listener.handler === handler) {
      index = i;
      break;
    }
  }

  if (index === -1) return;

  listeners.splice(index, 1);

  if (listeners.length === 0) delete this._events[type];

  this.emit("removeListener", type, handler);
};

/**
 * Set max listeners.
 * @param {Number} max
 */

AsyncEmitter.prototype.setMaxListeners = function setMaxListeners(max) {
  assert(typeof max === "number", "`max` must be a number.");
  assert(max >= 0, "`max` must be non-negative.");
  assert((0, _isSafeInteger2.default)(max), "`max` must be an integer.");
};

/**
 * Remove all listeners.
 * @param {String?} type
 */

AsyncEmitter.prototype.removeAllListeners = function removeAllListeners(type) {
  if (arguments.length === 0) {
    this._events = (0, _create2.default)(null);
    return;
  }

  assert(typeof type === "string", "`type` must be a string.");

  delete this._events[type];
};

/**
 * Get listeners array.
 * @param {String} type
 * @returns {Function[]}
 */

AsyncEmitter.prototype.listeners = function listeners(type) {
  assert(typeof type === "string", "`type` must be a string.");

  var listenersList = this._events[type];

  if (!listenersList) return [];

  var result = [];

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(listenersList), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var listener = _step.value;
      result.push(listener.handler);
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

  return result;
};

/**
 * Get listener count for an event.
 * @param {String} type
 */

AsyncEmitter.prototype.listenerCount = function listenerCount(type) {
  assert(typeof type === "string", "`type` must be a string.");

  var listeners = this._events[type];

  if (!listeners) return 0;

  return listeners.length;
};

/**
 * Emit an event synchronously.
 * @method
 * @param {String} type
 * @param {...Object} args
 * @returns {Promise}
 */

AsyncEmitter.prototype.emit = function emit(type) {
  assert(typeof type === "string", "`type` must be a string.");

  var listeners = this._events[type];

  if (!listeners || listeners.length === 0) {
    if (type === "error") {
      var error = arguments[1];

      if (error instanceof Error) throw error;

      var err = new Error("Uncaught, unspecified \"error\" event. (" + error + ")");
      err.context = error;
      throw err;
    }
    return;
  }

  var args = void 0;

  for (var i = 0; i < listeners.length; i++) {
    var listener = listeners[i];
    var handler = listener.handler;

    if (listener.once) {
      listeners.splice(i, 1);
      i--;
    }

    switch (arguments.length) {
      case 1:
        handler();
        break;
      case 2:
        handler(arguments[1]);
        break;
      case 3:
        handler(arguments[1], arguments[2]);
        break;
      case 4:
        handler(arguments[1], arguments[2], arguments[3]);
        break;
      default:
        if (!args) {
          args = new Array(arguments.length - 1);
          for (var j = 1; j < arguments.length; j++) {
            args[j - 1] = arguments[j];
          }
        }
        handler.apply(null, args);
        break;
    }
  }
};

/**
 * Emit an event. Wait for promises to resolve.
 * @method
 * @param {String} type
 * @param {...Object} args
 * @returns {Promise}
 */

AsyncEmitter.prototype.fire = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(type) {
    var listeners,
        error,
        err,
        args,
        i,
        listener,
        handler,
        j,
        _args = arguments;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            assert(typeof type === "string", "`type` must be a string.");

            listeners = this._events[type];

            if (!(!listeners || listeners.length === 0)) {
              _context.next = 11;
              break;
            }

            if (!(type === "error")) {
              _context.next = 10;
              break;
            }

            error = _args[1];

            if (!(error instanceof Error)) {
              _context.next = 7;
              break;
            }

            throw error;

          case 7:
            err = new Error("Uncaught, unspecified \"error\" event. (" + error + ")");

            err.context = error;
            throw err;

          case 10:
            return _context.abrupt("return");

          case 11:
            args = void 0;
            i = 0;

          case 13:
            if (!(i < listeners.length)) {
              _context.next = 39;
              break;
            }

            listener = listeners[i];
            handler = listener.handler;


            if (listener.once) {
              listeners.splice(i, 1);
              i--;
            }

            _context.t0 = _args.length;
            _context.next = _context.t0 === 1 ? 20 : _context.t0 === 2 ? 23 : _context.t0 === 3 ? 26 : _context.t0 === 4 ? 29 : 32;
            break;

          case 20:
            _context.next = 22;
            return handler();

          case 22:
            return _context.abrupt("break", 36);

          case 23:
            _context.next = 25;
            return handler(_args[1]);

          case 25:
            return _context.abrupt("break", 36);

          case 26:
            _context.next = 28;
            return handler(_args[1], _args[2]);

          case 28:
            return _context.abrupt("break", 36);

          case 29:
            _context.next = 31;
            return handler(_args[1], _args[2], _args[3]);

          case 31:
            return _context.abrupt("break", 36);

          case 32:
            if (!args) {
              args = new Array(_args.length - 1);
              for (j = 1; j < _args.length; j++) {
                args[j - 1] = _args[j];
              }
            }
            _context.next = 35;
            return handler.apply(null, args);

          case 35:
            return _context.abrupt("break", 36);

          case 36:
            i++;
            _context.next = 13;
            break;

          case 39:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function fire(_x) {
    return _ref.apply(this, arguments);
  }

  return fire;
}();

/**
 * Emit an event. Ignore rejections.
 * @method
 * @param {String} type
 * @param {...Object} args
 * @returns {Promise}
 */

AsyncEmitter.prototype.tryFire = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(type) {
    var _args2 = arguments;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.prev = 0;
            _context2.next = 3;
            return this.emit.apply(this, _args2);

          case 3:
            _context2.next = 16;
            break;

          case 5:
            _context2.prev = 5;
            _context2.t0 = _context2["catch"](0);

            if (!(type === "error")) {
              _context2.next = 9;
              break;
            }

            return _context2.abrupt("return");

          case 9:
            _context2.prev = 9;
            _context2.next = 12;
            return this.emit("error", _context2.t0);

          case 12:
            _context2.next = 16;
            break;

          case 14:
            _context2.prev = 14;
            _context2.t1 = _context2["catch"](9);

          case 16:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this, [[0, 5], [9, 14]]);
  }));

  function tryFire(_x2) {
    return _ref2.apply(this, arguments);
  }

  return tryFire;
}();

/**
 * Event Listener
 * @constructor
 * @ignore
 * @param {Function} handler
 * @param {Boolean} once
 * @property {Function} handler
 * @property {Boolean} once
 */

function Listener(handler, once) {
  assert(typeof handler === "function", "`handler` must be a function.");
  assert(typeof once === "boolean", "`once` must be a function.");
  this.handler = handler;
  this.once = once;
}

/*
 * Expose
 */

module.exports = AsyncEmitter;