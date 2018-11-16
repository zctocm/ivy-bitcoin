/*!
 * co.js - promise and generator control flow for bcoin
 * Originally based on yoursnetwork's "asink" module.
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

/**
 * @module utils/co
 */

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setImmediate2 = require('babel-runtime/core-js/set-immediate');

var _setImmediate3 = _interopRequireDefault(_setImmediate2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

/**
 * Execute each promise and
 * have them pass a truth test.
 * @method
 * @param {Promise[]} jobs
 * @returns {Promise}
 */

var every = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(jobs) {
    var result, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, item;

    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return _promise2.default.all(jobs);

          case 2:
            result = _context.sent;
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context.prev = 6;
            _iterator = (0, _getIterator3.default)(result);

          case 8:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context.next = 15;
              break;
            }

            item = _step.value;

            if (item) {
              _context.next = 12;
              break;
            }

            return _context.abrupt('return', false);

          case 12:
            _iteratorNormalCompletion = true;
            _context.next = 8;
            break;

          case 15:
            _context.next = 21;
            break;

          case 17:
            _context.prev = 17;
            _context.t0 = _context['catch'](6);
            _didIteratorError = true;
            _iteratorError = _context.t0;

          case 21:
            _context.prev = 21;
            _context.prev = 22;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 24:
            _context.prev = 24;

            if (!_didIteratorError) {
              _context.next = 27;
              break;
            }

            throw _iteratorError;

          case 27:
            return _context.finish(24);

          case 28:
            return _context.finish(21);

          case 29:
            return _context.abrupt('return', true);

          case 30:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[6, 17, 21, 29], [22,, 24, 28]]);
  }));

  return function every(_x) {
    return _ref.apply(this, arguments);
  };
}();

/**
 * Start an interval. Wait for promise
 * to resolve on each iteration.
 * @param {Function} func
 * @param {Number?} time
 * @param {Object?} self
 * @returns {Object}
 */

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');

/**
 * Execute an instantiated generator.
 * @param {Generator} gen
 * @returns {Promise}
 */

function exec(gen) {
  return new _promise2.default(function (resolve, reject) {
    var step = function step(value, rejection) {
      var next = void 0;

      try {
        if (rejection) next = gen.throw(value);else next = gen.next(value);
      } catch (e) {
        reject(e);
        return;
      }

      if (next.done) {
        resolve(next.value);
        return;
      }

      if (!isPromise(next.value)) {
        step(next.value, false);
        return;
      }

      // eslint-disable-next-line no-use-before-define
      next.value.then(succeed, fail);
    };

    var succeed = function succeed(value) {
      step(value, false);
    };

    var fail = function fail(value) {
      step(value, true);
    };

    step(undefined, false);
  });
}

/**
 * Execute generator function
 * with a context and execute.
 * @param {GeneratorFunction} generator
 * @param {Object?} self
 * @returns {Promise}
 */

function spawn(generator, self) {
  var gen = generator.call(self);
  return exec(gen);
}

/**
 * Wrap a generator function to be
 * executed into a function that
 * returns a promise.
 * @param {GeneratorFunction}
 * @returns {Function}
 */

function co(generator) {
  return function () {
    var gen = generator.apply(this, arguments);
    return exec(gen);
  };
}

/**
 * Test whether an object is a promise.
 * @param {Object} obj
 * @returns {Boolean}
 */

function isPromise(obj) {
  return obj && typeof obj.then === 'function';
}

/**
 * Wait for a nextTick with a promise.
 * @returns {Promise}
 */

function wait() {
  return new _promise2.default(function (resolve) {
    return (0, _setImmediate3.default)(resolve);
  });
};

/**
 * Wait for a timeout with a promise.
 * @param {Number} time
 * @returns {Promise}
 */

function timeout(time) {
  return new _promise2.default(function (resolve) {
    return setTimeout(resolve, time);
  });
}

/**
 * Wrap `resolve` and `reject` into
 * a node.js style callback.
 * @param {Function} resolve
 * @param {Function} reject
 * @returns {Function}
 */

function wrap(resolve, reject) {
  return function (err, result) {
    if (err) {
      reject(err);
      return;
    }
    resolve(result);
  };
}

/**
 * Wrap a function that accepts node.js
 * style callbacks into a function that
 * returns a promise.
 * @param {Function} func
 * @returns {AsyncFunction}
 */

function promisify(func) {
  return function () {
    var _this = this;

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return new _promise2.default(function (resolve, reject) {
      args.push(wrap(resolve, reject));
      func.call.apply(func, [_this].concat(args));
    });
  };
}

/**
 * Wrap a promise-returning function
 * into a function that accepts a
 * node.js style callback.
 * @param {AsyncFunction} func
 * @returns {Function}
 */

function callbackify(func) {
  return function () {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    if (args.length === 0 || typeof args[args.length - 1] !== 'function') {
      throw new Error((func.name || 'Function') + ' requires a callback.');
    }

    var callback = args.pop();

    func.call.apply(func, [this].concat(args)).then(function (value) {
      (0, _setImmediate3.default)(function () {
        return callback(null, value);
      });
    }, function (err) {
      (0, _setImmediate3.default)(function () {
        return callback(err);
      });
    });
  };
}function startInterval(func, time, self) {
  var _this2 = this;

  var ctx = {
    timer: null,
    stopped: false,
    running: false,
    resolve: null
  };

  var cb = function () {
    var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
      return _regenerator2.default.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              assert(ctx.timer != null);
              ctx.timer = null;

              _context2.prev = 2;

              ctx.running = true;
              _context2.next = 6;
              return func.call(self);

            case 6:
              _context2.prev = 6;

              ctx.running = false;
              if (!ctx.stopped) ctx.timer = setTimeout(cb, time);else if (ctx.resolve) ctx.resolve();
              return _context2.finish(6);

            case 10:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, _this2, [[2,, 6, 10]]);
    }));

    return function cb() {
      return _ref2.apply(this, arguments);
    };
  }();

  ctx.timer = setTimeout(cb, time);

  return ctx;
}

/**
 * Clear an interval.
 * @param {Object} ctx
 */

function stopInterval(ctx) {
  assert(ctx);

  if (ctx.timer != null) {
    clearTimeout(ctx.timer);
    ctx.timer = null;
  }

  ctx.stopped = true;

  if (ctx.running) {
    return new _promise2.default(function (r) {
      ctx.resolve = r;
    });
  }

  return _promise2.default.resolve();
}

/**
 * Start a timeout.
 * @param {Function} func
 * @param {Number?} time
 * @param {Object?} self
 * @returns {Object}
 */

function startTimeout(func, time, self) {
  return {
    timer: setTimeout(func.bind(self), time),
    stopped: false
  };
}

/**
 * Clear a timeout.
 * @param {Object} ctx
 */

function stopTimeout(ctx) {
  assert(ctx);
  if (ctx.timer != null) {
    clearTimeout(ctx.timer);
    ctx.timer = null;
  }
  ctx.stopped = true;
}

/**
 * Create a job object.
 * @returns {Job}
 */

function job(resolve, reject) {
  return new Job(resolve, reject);
}

/**
 * Job
 * @constructor
 * @ignore
 * @param {Function} resolve
 * @param {Function} reject
 * @property {Function} resolve
 * @property {Function} reject
 */

function Job(resolve, reject) {
  this.resolve = resolve;
  this.reject = reject;
}

/*
 * Expose
 */

exports = co;
exports.exec = exec;
exports.spawn = spawn;
exports.co = co;
exports.wait = wait;
exports.timeout = timeout;
exports.wrap = wrap;
exports.promisify = promisify;
exports.callbackify = callbackify;
exports.every = every;
exports.setInterval = startInterval;
exports.clearInterval = stopInterval;
exports.setTimeout = startTimeout;
exports.clearTimeout = stopTimeout;
exports.job = job;

module.exports = exports;