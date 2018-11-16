/*!
 * cpuminer.js - inefficient cpu miner for bcoin (because we can)
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var util = require('../utils/util');
var co = require('../utils/co');
var AsyncObject = require('../utils/asyncobject');
var mine = require('./mine');
var Lock = require('../utils/lock');

/**
 * CPU miner.
 * @alias module:mining.CPUMiner
 * @constructor
 * @param {Miner} miner
 * @emits CPUMiner#block
 * @emits CPUMiner#status
 */

function CPUMiner(miner) {
  if (!(this instanceof CPUMiner)) return new CPUMiner(miner);

  AsyncObject.call(this);

  this.miner = miner;
  this.network = this.miner.network;
  this.logger = this.miner.logger.context('cpuminer');
  this.workers = this.miner.workers;
  this.chain = this.miner.chain;
  this.locker = new Lock();

  this.running = false;
  this.stopping = false;
  this.job = null;
  this.stopJob = null;

  this._init();
}

(0, _setPrototypeOf2.default)(CPUMiner.prototype, AsyncObject.prototype);

/**
 * Nonce range interval.
 * @const {Number}
 * @default
 */

CPUMiner.INTERVAL = 0xffffffff / 1500 | 0;

/**
 * Initialize the miner.
 * @private
 */

CPUMiner.prototype._init = function _init() {
  var _this = this;

  this.chain.on('tip', function (tip) {
    if (!_this.job) return;

    if (_this.job.attempt.prevBlock === tip.prevBlock) _this.job.destroy();
  });
};

/**
 * Open the miner.
 * @method
 * @alias module:mining.CPUMiner#open
 * @returns {Promise}
 */

CPUMiner.prototype._open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function _open() {
    return _ref.apply(this, arguments);
  }

  return _open;
}();

/**
 * Close the miner.
 * @method
 * @alias module:mining.CPUMiner#close
 * @returns {Promise}
 */

CPUMiner.prototype._close = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return this.stop();

          case 2:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function _close() {
    return _ref2.apply(this, arguments);
  }

  return _close;
}();

/**
 * Start mining.
 * @method
 */

CPUMiner.prototype.start = function start() {
  assert(!this.running, 'Miner is already running.');
  this._start().catch(function () {});
};

/**
 * Start mining.
 * @method
 * @private
 * @returns {Promise}
 */

CPUMiner.prototype._start = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
    var block, entry, job;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            assert(!this.running, 'Miner is already running.');

            this.running = true;
            this.stopping = false;

          case 3:
            this.job = null;

            _context3.prev = 4;
            _context3.next = 7;
            return this.createJob();

          case 7:
            this.job = _context3.sent;
            _context3.next = 16;
            break;

          case 10:
            _context3.prev = 10;
            _context3.t0 = _context3['catch'](4);

            if (!this.stopping) {
              _context3.next = 14;
              break;
            }

            return _context3.abrupt('break', 62);

          case 14:
            this.emit('error', _context3.t0);
            return _context3.abrupt('break', 62);

          case 16:
            if (!this.stopping) {
              _context3.next = 18;
              break;
            }

            return _context3.abrupt('break', 62);

          case 18:
            block = void 0;
            _context3.prev = 19;
            _context3.next = 22;
            return this.mineAsync(this.job);

          case 22:
            block = _context3.sent;
            _context3.next = 31;
            break;

          case 25:
            _context3.prev = 25;
            _context3.t1 = _context3['catch'](19);

            if (!this.stopping) {
              _context3.next = 29;
              break;
            }

            return _context3.abrupt('break', 62);

          case 29:
            this.emit('error', _context3.t1);
            return _context3.abrupt('break', 62);

          case 31:
            if (!this.stopping) {
              _context3.next = 33;
              break;
            }

            return _context3.abrupt('break', 62);

          case 33:
            if (block) {
              _context3.next = 35;
              break;
            }

            return _context3.abrupt('continue', 60);

          case 35:
            entry = void 0;
            _context3.prev = 36;
            _context3.next = 39;
            return this.chain.add(block);

          case 39:
            entry = _context3.sent;
            _context3.next = 52;
            break;

          case 42:
            _context3.prev = 42;
            _context3.t2 = _context3['catch'](36);

            if (!this.stopping) {
              _context3.next = 46;
              break;
            }

            return _context3.abrupt('break', 62);

          case 46:
            if (!(_context3.t2.type === 'VerifyError')) {
              _context3.next = 50;
              break;
            }

            this.logger.warning('Mined an invalid block!');
            this.logger.error(_context3.t2);
            return _context3.abrupt('continue', 60);

          case 50:

            this.emit('error', _context3.t2);
            return _context3.abrupt('break', 62);

          case 52:
            if (entry) {
              _context3.next = 55;
              break;
            }

            this.logger.warning('Mined a bad-prevblk (race condition?)');
            return _context3.abrupt('continue', 60);

          case 55:
            if (!this.stopping) {
              _context3.next = 57;
              break;
            }

            return _context3.abrupt('break', 62);

          case 57:

            // Log the block hex as a failsafe (in case we can't send it).
            this.logger.info('Found block: %d (%s).', entry.height, entry.rhash());
            this.logger.debug('Raw: %s', block.toRaw().toString('hex'));

            this.emit('block', block, entry);

          case 60:
            _context3.next = 3;
            break;

          case 62:
            job = this.stopJob;


            if (job) {
              this.stopJob = null;
              job.resolve();
            }

          case 64:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this, [[4, 10], [19, 25], [36, 42]]);
  }));

  function _start() {
    return _ref3.apply(this, arguments);
  }

  return _start;
}();

/**
 * Stop mining.
 * @method
 * @returns {Promise}
 */

CPUMiner.prototype.stop = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4() {
    var unlock;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _context4.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context4.sent;
            _context4.prev = 3;
            _context4.next = 6;
            return this._stop();

          case 6:
            return _context4.abrupt('return', _context4.sent);

          case 7:
            _context4.prev = 7;

            unlock();
            return _context4.finish(7);

          case 10:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[3,, 7, 10]]);
  }));

  function stop() {
    return _ref4.apply(this, arguments);
  }

  return stop;
}();

/**
 * Stop mining (without a lock).
 * @method
 * @returns {Promise}
 */

CPUMiner.prototype._stop = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5() {
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            if (this.running) {
              _context5.next = 2;
              break;
            }

            return _context5.abrupt('return');

          case 2:

            assert(this.running, 'Miner is not running.');
            assert(!this.stopping, 'Miner is already stopping.');

            this.stopping = true;

            if (this.job) {
              this.job.destroy();
              this.job = null;
            }

            _context5.next = 8;
            return this.wait();

          case 8:

            this.running = false;
            this.stopping = false;
            this.job = null;

          case 11:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function _stop() {
    return _ref5.apply(this, arguments);
  }

  return _stop;
}();

/**
 * Wait for `done` event.
 * @private
 * @returns {Promise}
 */

CPUMiner.prototype.wait = function wait() {
  var _this2 = this;

  return new _promise2.default(function (resolve, reject) {
    assert(!_this2.stopJob);
    _this2.stopJob = co.job(resolve, reject);
  });
};

/**
 * Create a mining job.
 * @method
 * @param {ChainEntry?} tip
 * @param {Address?} address
 * @returns {Promise} - Returns {@link Job}.
 */

CPUMiner.prototype.createJob = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(tip, address) {
    var attempt;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            _context6.next = 2;
            return this.miner.createBlock(tip, address);

          case 2:
            attempt = _context6.sent;
            return _context6.abrupt('return', new CPUJob(this, attempt));

          case 4:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function createJob(_x, _x2) {
    return _ref6.apply(this, arguments);
  }

  return createJob;
}();

/**
 * Mine a single block.
 * @method
 * @param {ChainEntry?} tip
 * @param {Address?} address
 * @returns {Promise} - Returns [{@link Block}].
 */

CPUMiner.prototype.mineBlock = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(tip, address) {
    var job;
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            _context7.next = 2;
            return this.createJob(tip, address);

          case 2:
            job = _context7.sent;
            _context7.next = 5;
            return this.mineAsync(job);

          case 5:
            return _context7.abrupt('return', _context7.sent);

          case 6:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  function mineBlock(_x3, _x4) {
    return _ref7.apply(this, arguments);
  }

  return mineBlock;
}();

/**
 * Notify the miner that a new
 * tx has entered the mempool.
 */

CPUMiner.prototype.notifyEntry = function notifyEntry() {
  if (!this.running) return;

  if (!this.job) return;

  if (util.now() - this.job.start > 10) {
    this.job.destroy();
    this.job = null;
  }
};

/**
 * Hash until the nonce overflows.
 * @param {CPUJob} job
 * @returns {Number} nonce
 */

CPUMiner.prototype.findNonce = function findNonce(job) {
  var data = job.getHeader();
  var target = job.attempt.target;
  var interval = CPUMiner.INTERVAL;

  var min = 0;
  var max = interval;
  var nonce = void 0;

  while (max <= 0xffffffff) {
    nonce = mine(data, target, min, max);

    if (nonce !== -1) break;

    this.sendStatus(job, max);

    min += interval;
    max += interval;
  }

  return nonce;
};

/**
 * Hash until the nonce overflows.
 * @method
 * @param {CPUJob} job
 * @returns {Promise} Returns Number.
 */

CPUMiner.prototype.findNonceAsync = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(job) {
    var data, target, interval, min, max, nonce;
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            if (this.workers) {
              _context8.next = 2;
              break;
            }

            return _context8.abrupt('return', this.findNonce(job));

          case 2:
            data = job.getHeader();
            target = job.attempt.target;
            interval = CPUMiner.INTERVAL;
            min = 0;
            max = interval;
            nonce = void 0;

          case 8:
            if (!(max <= 0xffffffff)) {
              _context8.next = 21;
              break;
            }

            _context8.next = 11;
            return this.workers.mine(data, target, min, max);

          case 11:
            nonce = _context8.sent;

            if (!(nonce !== -1)) {
              _context8.next = 14;
              break;
            }

            return _context8.abrupt('break', 21);

          case 14:
            if (!job.destroyed) {
              _context8.next = 16;
              break;
            }

            return _context8.abrupt('return', nonce);

          case 16:

            this.sendStatus(job, max);

            min += interval;
            max += interval;
            _context8.next = 8;
            break;

          case 21:
            return _context8.abrupt('return', nonce);

          case 22:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  function findNonceAsync(_x5) {
    return _ref8.apply(this, arguments);
  }

  return findNonceAsync;
}();

/**
 * Mine synchronously until the block is found.
 * @param {CPUJob} job
 * @returns {Block}
 */

CPUMiner.prototype.mine = function mine(job) {
  job.start = util.now();

  var nonce = void 0;
  for (;;) {
    nonce = this.findNonce(job);

    if (nonce !== -1) break;

    job.updateNonce();

    this.sendStatus(job, 0);
  }

  return job.commit(nonce);
};

/**
 * Mine asynchronously until the block is found.
 * @method
 * @param {CPUJob} job
 * @returns {Promise} - Returns {@link Block}.
 */

CPUMiner.prototype.mineAsync = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(job) {
    var nonce;
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            nonce = void 0;


            job.start = util.now();

          case 2:
            _context9.next = 4;
            return this.findNonceAsync(job);

          case 4:
            nonce = _context9.sent;

            if (!(nonce !== -1)) {
              _context9.next = 7;
              break;
            }

            return _context9.abrupt('break', 13);

          case 7:
            if (!job.destroyed) {
              _context9.next = 9;
              break;
            }

            return _context9.abrupt('return', null);

          case 9:

            job.updateNonce();

            this.sendStatus(job, 0);

          case 11:
            _context9.next = 2;
            break;

          case 13:
            return _context9.abrupt('return', job.commit(nonce));

          case 14:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this);
  }));

  function mineAsync(_x6) {
    return _ref9.apply(this, arguments);
  }

  return mineAsync;
}();

/**
 * Send a progress report (emits `status`).
 * @param {CPUJob} job
 * @param {Number} nonce
 */

CPUMiner.prototype.sendStatus = function sendStatus(job, nonce) {
  var attempt = job.attempt;
  var tip = util.revHex(attempt.prevBlock);
  var hashes = job.getHashes(nonce);
  var hashrate = job.getRate(nonce);

  this.logger.info('Status: hashrate=%dkhs hashes=%d target=%d height=%d tip=%s', Math.floor(hashrate / 1000), hashes, attempt.bits, attempt.height, tip);

  this.emit('status', job, hashes, hashrate);
};

/**
 * Mining Job
 * @constructor
 * @ignore
 * @param {CPUMiner} miner
 * @param {BlockTemplate} attempt
 */

function CPUJob(miner, attempt) {
  this.miner = miner;
  this.attempt = attempt;
  this.destroyed = false;
  this.committed = false;
  this.start = util.now();
  this.nonce1 = 0;
  this.nonce2 = 0;
  this.refresh();
}

/**
 * Get the raw block header.
 * @param {Number} nonce
 * @returns {Buffer}
 */

CPUJob.prototype.getHeader = function getHeader() {
  var attempt = this.attempt;
  var n1 = this.nonce1;
  var n2 = this.nonce2;
  var time = attempt.time;
  var root = attempt.getRoot(n1, n2);
  var data = attempt.getHeader(root, time, 0);
  return data;
};

/**
 * Commit job and return a block.
 * @param {Number} nonce
 * @returns {Block}
 */

CPUJob.prototype.commit = function commit(nonce) {
  var attempt = this.attempt;
  var n1 = this.nonce1;
  var n2 = this.nonce2;
  var time = attempt.time;

  assert(!this.committed, 'Job already committed.');
  this.committed = true;

  var proof = attempt.getProof(n1, n2, time, nonce);

  return attempt.commit(proof);
};

/**
 * Mine block synchronously.
 * @returns {Block}
 */

CPUJob.prototype.mine = function mine() {
  return this.miner.mine(this);
};

/**
 * Mine block asynchronously.
 * @returns {Promise}
 */

CPUJob.prototype.mineAsync = function mineAsync() {
  return this.miner.mineAsync(this);
};

/**
 * Refresh the block template.
 */

CPUJob.prototype.refresh = function refresh() {
  return this.attempt.refresh();
};

/**
 * Increment the extraNonce.
 */

CPUJob.prototype.updateNonce = function updateNonce() {
  if (++this.nonce2 === 0x100000000) {
    this.nonce2 = 0;
    this.nonce1++;
  }
};

/**
 * Destroy the job.
 */

CPUJob.prototype.destroy = function destroy() {
  assert(!this.destroyed, 'Job already destroyed.');
  this.destroyed = true;
};

/**
 * Calculate number of hashes computed.
 * @param {Number} nonce
 * @returns {Number}
 */

CPUJob.prototype.getHashes = function getHashes(nonce) {
  var extra = this.nonce1 * 0x100000000 + this.nonce2;
  return extra * 0xffffffff + nonce;
};

/**
 * Calculate hashrate.
 * @param {Number} nonce
 * @returns {Number}
 */

CPUJob.prototype.getRate = function getRate(nonce) {
  var hashes = this.getHashes(nonce);
  var seconds = util.now() - this.start;
  return Math.floor(hashes / Math.max(1, seconds));
};

/**
 * Add a transaction to the block.
 * @param {TX} tx
 * @param {CoinView} view
 */

CPUJob.prototype.addTX = function addTX(tx, view) {
  return this.attempt.addTX(tx, view);
};

/**
 * Add a transaction to the block
 * (less verification than addTX).
 * @param {TX} tx
 * @param {CoinView?} view
 */

CPUJob.prototype.pushTX = function pushTX(tx, view) {
  return this.attempt.pushTX(tx, view);
};

/*
 * Expose
 */

module.exports = CPUMiner;