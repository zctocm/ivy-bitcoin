/*!
 * workerpool.js - worker processes for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

/* eslint no-nested-ternary: "off" */

'use strict';

var _setImmediate2 = require('babel-runtime/core-js/set-immediate');

var _setImmediate3 = _interopRequireDefault(_setImmediate2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var EventEmitter = require('events');
var os = require('os');
var util = require('../utils/util');
var co = require('../utils/co');
var Network = require('../protocol/network');
var Child = require('./child');
var jobs = require('./jobs');
var Parser = require('./parser');
var Framer = require('./framer');
var packets = require('./packets');

/**
 * A worker pool.
 * @alias module:workers.WorkerPool
 * @constructor
 * @param {Object} options
 * @param {Number} [options.size=num-cores] - Max pool size.
 * @param {Number} [options.timeout=120000] - Execution timeout.
 * @property {Number} size
 * @property {Number} timeout
 * @property {Map} children
 * @property {Number} uid
 */

function WorkerPool(options) {
  if (!(this instanceof WorkerPool)) return new WorkerPool(options);

  EventEmitter.call(this);

  this.enabled = false;
  this.size = getCores();
  this.timeout = 120000;
  this.file = process.env.BCOIN_WORKER_FILE || 'worker.js';

  this.children = new _map2.default();
  this.uid = 0;

  this.set(options);
}

(0, _setPrototypeOf2.default)(WorkerPool.prototype, EventEmitter.prototype);

/**
 * Set worker pool options.
 * @param {Object} options
 */

WorkerPool.prototype.set = function set(options) {
  if (!options) return;

  if (options.enabled != null) {
    assert(typeof options.enabled === 'boolean');
    this.enabled = options.enabled;
  }

  if (options.size != null) {
    assert(util.isU32(options.size));
    assert(options.size > 0);
    this.size = options.size;
  }

  if (options.timeout != null) {
    assert(util.isInt(options.timeout));
    assert(options.timeout >= -1);
    this.timeout = options.timeout;
  }

  if (options.file != null) {
    assert(typeof options.file === 'string');
    this.file = options.file;
  }
};

/**
 * Open worker pool.
 * @returns {Promise}
 */

WorkerPool.prototype.open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function open() {
    return _ref.apply(this, arguments);
  }

  return open;
}();

/**
 * Close worker pool.
 * @returns {Promise}
 */

WorkerPool.prototype.close = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            this.destroy();

          case 1:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function close() {
    return _ref2.apply(this, arguments);
  }

  return close;
}();

/**
 * Spawn a new worker.
 * @param {Number} id - Worker ID.
 * @returns {Worker}
 */

WorkerPool.prototype.spawn = function spawn(id) {
  var _this = this;

  var child = new Worker(this.file);

  child.id = id;

  child.on('error', function (err) {
    _this.emit('error', err, child);
  });

  child.on('exit', function (code) {
    _this.emit('exit', code, child);

    if (_this.children.get(id) === child) _this.children.delete(id);
  });

  child.on('event', function (items) {
    _this.emit('event', items, child);
    _this.emit.apply(_this, (0, _toConsumableArray3.default)(items));
  });

  child.on('log', function (text) {
    _this.emit('log', text, child);
  });

  this.emit('spawn', child);

  return child;
};

/**
 * Allocate a new worker, will not go above `size` option
 * and will automatically load balance the workers.
 * @returns {Worker}
 */

WorkerPool.prototype.alloc = function alloc() {
  var id = this.uid++ % this.size;

  if (!this.children.has(id)) this.children.set(id, this.spawn(id));

  return this.children.get(id);
};

/**
 * Emit an event on the worker side (all workers).
 * @param {String} event
 * @param {...Object} arg
 * @returns {Boolean}
 */

WorkerPool.prototype.sendEvent = function sendEvent() {
  var result = true;

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(this.children.values()), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var child = _step.value;

      if (!child.sendEvent.apply(child, arguments)) result = false;
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
 * Destroy all workers.
 */

WorkerPool.prototype.destroy = function destroy() {
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(this.children.values()), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var child = _step2.value;

      child.destroy();
    }
  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2.return) {
        _iterator2.return();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
    }
  }
};

/**
 * Call a method for a worker to execute.
 * @param {Packet} packet
 * @param {Number} timeout
 * @returns {Promise}
 */

WorkerPool.prototype.execute = function execute(packet, timeout) {
  if (!this.enabled || !Child.hasSupport()) {
    return new _promise2.default(function (resolve, reject) {
      (0, _setImmediate3.default)(function () {
        var result = void 0;
        try {
          result = jobs.handle(packet);
        } catch (e) {
          reject(e);
          return;
        }
        resolve(result);
      });
    });
  }

  if (!timeout) timeout = this.timeout;

  var child = this.alloc();

  return child.execute(packet, timeout);
};

/**
 * Execute the tx check job (default timeout).
 * @method
 * @param {TX} tx
 * @param {CoinView} view
 * @param {VerifyFlags} flags
 * @returns {Promise}
 */

WorkerPool.prototype.check = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(tx, view, flags) {
    var packet, result;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            packet = new packets.CheckPacket(tx, view, flags);
            _context3.next = 3;
            return this.execute(packet, -1);

          case 3:
            result = _context3.sent;

            if (!result.error) {
              _context3.next = 6;
              break;
            }

            throw result.error;

          case 6:
            return _context3.abrupt('return', null);

          case 7:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function check(_x, _x2, _x3) {
    return _ref3.apply(this, arguments);
  }

  return check;
}();

/**
 * Execute the tx signing job (default timeout).
 * @method
 * @param {MTX} tx
 * @param {KeyRing[]} ring
 * @param {SighashType} type
 * @returns {Promise}
 */

WorkerPool.prototype.sign = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(tx, ring, type) {
    var rings, packet, result;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            rings = ring;


            if (!Array.isArray(rings)) rings = [rings];

            packet = new packets.SignPacket(tx, rings, type);
            _context4.next = 5;
            return this.execute(packet, -1);

          case 5:
            result = _context4.sent;


            result.inject(tx);

            return _context4.abrupt('return', result.total);

          case 8:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  function sign(_x4, _x5, _x6) {
    return _ref4.apply(this, arguments);
  }

  return sign;
}();

/**
 * Execute the tx input check job (default timeout).
 * @method
 * @param {TX} tx
 * @param {Number} index
 * @param {Coin|Output} coin
 * @param {VerifyFlags} flags
 * @returns {Promise}
 */

WorkerPool.prototype.checkInput = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(tx, index, coin, flags) {
    var packet, result;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            packet = new packets.CheckInputPacket(tx, index, coin, flags);
            _context5.next = 3;
            return this.execute(packet, -1);

          case 3:
            result = _context5.sent;

            if (!result.error) {
              _context5.next = 6;
              break;
            }

            throw result.error;

          case 6:
            return _context5.abrupt('return', null);

          case 7:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function checkInput(_x7, _x8, _x9, _x10) {
    return _ref5.apply(this, arguments);
  }

  return checkInput;
}();

/**
 * Execute the tx input signing job (default timeout).
 * @method
 * @param {MTX} tx
 * @param {Number} index
 * @param {Coin|Output} coin
 * @param {KeyRing} ring
 * @param {SighashType} type
 * @returns {Promise}
 */

WorkerPool.prototype.signInput = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(tx, index, coin, ring, type) {
    var packet, result;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            packet = new packets.SignInputPacket(tx, index, coin, ring, type);
            _context6.next = 3;
            return this.execute(packet, -1);

          case 3:
            result = _context6.sent;

            result.inject(tx);
            return _context6.abrupt('return', result.value);

          case 6:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function signInput(_x11, _x12, _x13, _x14, _x15) {
    return _ref6.apply(this, arguments);
  }

  return signInput;
}();

/**
 * Execute the secp256k1 verify job (no timeout).
 * @method
 * @param {Buffer} msg
 * @param {Buffer} sig - DER formatted.
 * @param {Buffer} key
 * @returns {Promise}
 */

WorkerPool.prototype.ecVerify = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(msg, sig, key) {
    var packet, result;
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            packet = new packets.ECVerifyPacket(msg, sig, key);
            _context7.next = 3;
            return this.execute(packet, -1);

          case 3:
            result = _context7.sent;
            return _context7.abrupt('return', result.value);

          case 5:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  function ecVerify(_x16, _x17, _x18) {
    return _ref7.apply(this, arguments);
  }

  return ecVerify;
}();

/**
 * Execute the secp256k1 signing job (no timeout).
 * @method
 * @param {Buffer} msg
 * @param {Buffer} key
 * @returns {Promise}
 */

WorkerPool.prototype.ecSign = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(msg, key) {
    var packet, result;
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            packet = new packets.ECSignPacket(msg, key);
            _context8.next = 3;
            return this.execute(packet, -1);

          case 3:
            result = _context8.sent;
            return _context8.abrupt('return', result.sig);

          case 5:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  function ecSign(_x19, _x20) {
    return _ref8.apply(this, arguments);
  }

  return ecSign;
}();

/**
 * Execute the mining job (no timeout).
 * @method
 * @param {Buffer} data
 * @param {Buffer} target
 * @param {Number} min
 * @param {Number} max
 * @returns {Promise} - Returns {Number}.
 */

WorkerPool.prototype.mine = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(data, target, min, max) {
    var packet, result;
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            packet = new packets.MinePacket(data, target, min, max);
            _context9.next = 3;
            return this.execute(packet, -1);

          case 3:
            result = _context9.sent;
            return _context9.abrupt('return', result.nonce);

          case 5:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this);
  }));

  function mine(_x21, _x22, _x23, _x24) {
    return _ref9.apply(this, arguments);
  }

  return mine;
}();

/**
 * Execute scrypt job (no timeout).
 * @method
 * @param {Buffer} passwd
 * @param {Buffer} salt
 * @param {Number} N
 * @param {Number} r
 * @param {Number} p
 * @param {Number} len
 * @returns {Promise}
 */

WorkerPool.prototype.scrypt = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(passwd, salt, N, r, p, len) {
    var packet, result;
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            packet = new packets.ScryptPacket(passwd, salt, N, r, p, len);
            _context10.next = 3;
            return this.execute(packet, -1);

          case 3:
            result = _context10.sent;
            return _context10.abrupt('return', result.key);

          case 5:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this);
  }));

  function scrypt(_x25, _x26, _x27, _x28, _x29, _x30) {
    return _ref10.apply(this, arguments);
  }

  return scrypt;
}();

/**
 * Represents a worker.
 * @alias module:workers.Worker
 * @constructor
 * @param {String} file
 */

function Worker(file) {
  if (!(this instanceof Worker)) return new Worker(file);

  EventEmitter.call(this);

  this.id = -1;
  this.framer = new Framer();
  this.parser = new Parser();
  this.pending = new _map2.default();

  this.child = new Child(file);

  this.init();
}

(0, _setPrototypeOf2.default)(Worker.prototype, EventEmitter.prototype);

/**
 * Initialize worker. Bind to events.
 * @private
 */

Worker.prototype.init = function init() {
  var _this2 = this;

  this.child.on('data', function (data) {
    _this2.parser.feed(data);
  });

  this.child.on('exit', function (code, signal) {
    _this2.emit('exit', code, signal);
  });

  this.child.on('error', function (err) {
    _this2.emit('error', err);
  });

  this.parser.on('error', function (err) {
    _this2.emit('error', err);
  });

  this.parser.on('packet', function (packet) {
    _this2.emit('packet', packet);
  });

  this.listen();
};

/**
 * Listen for packets.
 * @private
 */

Worker.prototype.listen = function listen() {
  var _this3 = this;

  this.on('exit', function (code, signal) {
    _this3.killJobs();
  });

  this.on('error', function (err) {
    _this3.killJobs();
  });

  this.on('packet', function (packet) {
    try {
      _this3.handlePacket(packet);
    } catch (e) {
      _this3.emit('error', e);
    }
  });

  this.sendEnv({
    BCOIN_WORKER_NETWORK: Network.type,
    BCOIN_WORKER_ISTTY: process.stdout ? process.stdout.isTTY ? '1' : '0' : '0'
  });
};

/**
 * Handle packet.
 * @private
 * @param {Packet} packet
 */

Worker.prototype.handlePacket = function handlePacket(packet) {
  switch (packet.cmd) {
    case packets.types.EVENT:
      this.emit('event', packet.items);
      this.emit.apply(this, (0, _toConsumableArray3.default)(packet.items));
      break;
    case packets.types.LOG:
      this.emit('log', packet.text);
      break;
    case packets.types.ERROR:
      this.emit('error', packet.error);
      break;
    case packets.types.ERRORRESULT:
      this.rejectJob(packet.id, packet.error);
      break;
    default:
      this.resolveJob(packet.id, packet);
      break;
  }
};

/**
 * Send data to worker.
 * @param {Buffer} data
 * @returns {Boolean}
 */

Worker.prototype.write = function write(data) {
  return this.child.write(data);
};

/**
 * Frame and send a packet.
 * @param {Packet} packet
 * @returns {Boolean}
 */

Worker.prototype.send = function send(packet) {
  return this.write(this.framer.packet(packet));
};

/**
 * Send environment.
 * @param {Object} env
 * @returns {Boolean}
 */

Worker.prototype.sendEnv = function sendEnv(env) {
  return this.send(new packets.EnvPacket(env));
};

/**
 * Emit an event on the worker side.
 * @param {String} event
 * @param {...Object} arg
 * @returns {Boolean}
 */

Worker.prototype.sendEvent = function sendEvent() {
  for (var _len = arguments.length, items = Array(_len), _key = 0; _key < _len; _key++) {
    items[_key] = arguments[_key];
  }

  return this.send(new packets.EventPacket(items));
};

/**
 * Destroy the worker.
 */

Worker.prototype.destroy = function destroy() {
  return this.child.destroy();
};

/**
 * Call a method for a worker to execute.
 * @param {Packet} packet
 * @param {Number} timeout
 * @returns {Promise}
 */

Worker.prototype.execute = function execute(packet, timeout) {
  var _this4 = this;

  return new _promise2.default(function (resolve, reject) {
    _this4._execute(packet, timeout, resolve, reject);
  });
};

/**
 * Call a method for a worker to execute.
 * @private
 * @param {Packet} packet
 * @param {Number} timeout
 * @param {Function} resolve
 * @param {Function} reject
 * the worker method specifies.
 */

Worker.prototype._execute = function _execute(packet, timeout, resolve, reject) {
  var job = new PendingJob(this, packet.id, resolve, reject);

  assert(!this.pending.has(packet.id), 'ID overflow.');

  this.pending.set(packet.id, job);

  job.start(timeout);

  this.send(packet);
};

/**
 * Resolve a job.
 * @param {Number} id
 * @param {Packet} result
 */

Worker.prototype.resolveJob = function resolveJob(id, result) {
  var job = this.pending.get(id);

  if (!job) throw new Error('Job ' + id + ' is not in progress.');

  job.resolve(result);
};

/**
 * Reject a job.
 * @param {Number} id
 * @param {Error} err
 */

Worker.prototype.rejectJob = function rejectJob(id, err) {
  var job = this.pending.get(id);

  if (!job) throw new Error('Job ' + id + ' is not in progress.');

  job.reject(err);
};

/**
 * Kill all jobs associated with worker.
 */

Worker.prototype.killJobs = function killJobs() {
  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(this.pending.values()), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var job = _step3.value;

      job.destroy();
    }
  } catch (err) {
    _didIteratorError3 = true;
    _iteratorError3 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion3 && _iterator3.return) {
        _iterator3.return();
      }
    } finally {
      if (_didIteratorError3) {
        throw _iteratorError3;
      }
    }
  }
};

/**
 * Pending Job
 * @constructor
 * @ignore
 * @param {Worker} worker
 * @param {Number} id
 * @param {Function} resolve
 * @param {Function} reject
 */

function PendingJob(worker, id, resolve, reject) {
  this.worker = worker;
  this.id = id;
  this.job = co.job(resolve, reject);
  this.timer = null;
}

/**
 * Start the timer.
 * @param {Number} timeout
 */

PendingJob.prototype.start = function start(timeout) {
  var _this5 = this;

  if (!timeout || timeout <= 0) return;

  this.timer = setTimeout(function () {
    _this5.reject(new Error('Worker timed out.'));
  }, timeout);
};

/**
 * Destroy the job with an error.
 */

PendingJob.prototype.destroy = function destroy() {
  this.reject(new Error('Job was destroyed.'));
};

/**
 * Cleanup job state.
 * @returns {Job}
 */

PendingJob.prototype.cleanup = function cleanup() {
  var job = this.job;

  assert(job, 'Already finished.');

  this.job = null;

  if (this.timer != null) {
    clearTimeout(this.timer);
    this.timer = null;
  }

  assert(this.worker.pending.has(this.id));
  this.worker.pending.delete(this.id);

  return job;
};

/**
 * Complete job with result.
 * @param {Object} result
 */

PendingJob.prototype.resolve = function resolve(result) {
  var job = this.cleanup();
  job.resolve(result);
};

/**
 * Complete job with error.
 * @param {Error} err
 */

PendingJob.prototype.reject = function reject(err) {
  var job = this.cleanup();
  job.reject(err);
};

/*
 * Helpers
 */

function getCores() {
  return Math.max(2, os.cpus().length);
}

/*
 * Expose
 */

module.exports = WorkerPool;