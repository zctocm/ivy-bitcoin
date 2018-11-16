/*!
 * lock.js - lock and queue for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');

/**
 * Represents a mutex lock for locking asynchronous object methods.
 * @alias module:utils.Lock
 * @constructor
 * @param {Boolean?} named - Whether to
 * maintain a map of queued jobs by job name.
 */

function Lock(named) {
  if (!(this instanceof Lock)) return Lock.create(named);

  this.named = named === true;

  this.jobs = [];
  this.busy = false;
  this.destroyed = false;

  this.map = new _map2.default();
  this.current = null;

  this.unlocker = this.unlock.bind(this);
}

/**
 * Create a closure scoped lock.
 * @param {Boolean?} named
 * @returns {Function} Lock method.
 */

Lock.create = function create(named) {
  var lock = new Lock(named);
  return function _lock(arg1, arg2) {
    return lock.lock(arg1, arg2);
  };
};

/**
 * Test whether the lock has a pending
 * job or a job in progress (by name).
 * @param {String} name
 * @returns {Boolean}
 */

Lock.prototype.has = function has(name) {
  assert(this.named, 'Must use named jobs.');

  if (this.current === name) return true;

  var count = this.map.get(name);

  if (count == null) return false;

  return count > 0;
};

/**
 * Test whether the lock has
 * a pending job by name.
 * @param {String} name
 * @returns {Boolean}
 */

Lock.prototype.hasPending = function hasPending(name) {
  assert(this.named, 'Must use named jobs.');

  var count = this.map.get(name);

  if (count == null) return false;

  return count > 0;
};

/**
 * Lock the parent object and all its methods
 * which use the lock. Begin to queue calls.
 * @param {String?} name - Job name.
 * @param {Boolean?} force - Bypass the lock.
 * @returns {Promise} - Returns {Function}, must be
 * called once the method finishes executing in order
 * to resolve the queue.
 */

Lock.prototype.lock = function lock(arg1, arg2) {
  var _this = this;

  var name = void 0,
      force = void 0;

  if (this.named) {
    name = arg1 || null;
    force = arg2;
  } else {
    name = null;
    force = arg1;
  }

  if (this.destroyed) return _promise2.default.reject(new Error('Lock is destroyed.'));

  if (force) {
    assert(this.busy);
    return _promise2.default.resolve(nop);
  }

  if (this.busy) {
    if (name) {
      var count = this.map.get(name);
      if (!count) count = 0;
      this.map.set(name, count + 1);
    }
    return new _promise2.default(function (resolve, reject) {
      _this.jobs.push(new Job(resolve, reject, name));
    });
  }

  this.busy = true;
  this.current = name;

  return _promise2.default.resolve(this.unlocker);
};

/**
 * The actual unlock callback.
 * @private
 */

Lock.prototype.unlock = function unlock() {
  assert(this.destroyed || this.busy);

  this.busy = false;
  this.current = null;

  if (this.jobs.length === 0) return;

  assert(!this.destroyed);

  var job = this.jobs.shift();

  if (job.name) {
    var count = this.map.get(job.name);
    assert(count > 0);
    if (--count === 0) this.map.delete(job.name);else this.map.set(job.name, count);
  }

  this.busy = true;
  this.current = job.name;

  job.resolve(this.unlocker);
};

/**
 * Destroy the lock. Purge all pending calls.
 */

Lock.prototype.destroy = function destroy() {
  assert(!this.destroyed, 'Lock is already destroyed.');

  this.destroyed = true;

  var jobs = this.jobs;

  this.busy = false;
  this.jobs = [];
  this.map.clear();
  this.current = null;

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(jobs), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var job = _step.value;

      job.reject(new Error('Lock was destroyed.'));
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
};

/**
 * Lock Job
 * @constructor
 * @ignore
 * @param {Function} resolve
 * @param {Function} reject
 * @param {String?} name
 */

function Job(resolve, reject, name) {
  this.resolve = resolve;
  this.reject = reject;
  this.name = name || null;
}

/*
 * Helpers
 */

function nop() {}

/*
 * Expose
 */

module.exports = Lock;