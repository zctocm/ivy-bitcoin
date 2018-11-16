/*!
 * miner.js - block generator for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var util = require('../utils/util');
var Heap = require('../utils/heap');
var AsyncObject = require('../utils/asyncobject');
var Amount = require('../btc/amount');
var Address = require('../primitives/address');
var BlockTemplate = require('./template');
var Network = require('../protocol/network');
var consensus = require('../protocol/consensus');
var policy = require('../protocol/policy');
var CPUMiner = require('./cpuminer');
var BlockEntry = BlockTemplate.BlockEntry;

/**
 * A bitcoin miner and block generator.
 * @alias module:mining.Miner
 * @constructor
 * @param {Object} options
 */

function Miner(options) {
  if (!(this instanceof Miner)) return new Miner(options);

  AsyncObject.call(this);

  this.options = new MinerOptions(options);
  this.network = this.options.network;
  this.logger = this.options.logger.context('miner');
  this.workers = this.options.workers;
  this.chain = this.options.chain;
  this.mempool = this.options.mempool;
  this.addresses = this.options.addresses;
  this.locker = this.chain.locker;
  this.cpu = new CPUMiner(this);

  this.init();
}

(0, _setPrototypeOf2.default)(Miner.prototype, AsyncObject.prototype);

/**
 * Open the miner, wait for the chain and mempool to load.
 * @method
 * @alias module:mining.Miner#open
 * @returns {Promise}
 */

Miner.prototype.init = function init() {
  var _this = this;

  this.cpu.on('error', function (err) {
    _this.emit('error', err);
  });
};

/**
 * Open the miner, wait for the chain and mempool to load.
 * @method
 * @alias module:mining.Miner#open
 * @returns {Promise}
 */

Miner.prototype._open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return this.chain.open();

          case 2:
            if (!this.mempool) {
              _context.next = 5;
              break;
            }

            _context.next = 5;
            return this.mempool.open();

          case 5:
            _context.next = 7;
            return this.cpu.open();

          case 7:

            this.logger.info('Miner loaded (flags=%s).', this.options.coinbaseFlags.toString('utf8'));

            if (this.addresses.length === 0) this.logger.warning('No reward address is set for miner!');

          case 9:
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
 * @alias module:mining.Miner#close
 * @returns {Promise}
 */

Miner.prototype._close = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return this.cpu.close();

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
 * Create a block template.
 * @method
 * @param {ChainEntry?} tip
 * @param {Address?} address
 * @returns {Promise} - Returns {@link BlockTemplate}.
 */

Miner.prototype.createBlock = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(tip, address) {
    var unlock;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context3.sent;
            _context3.prev = 3;
            _context3.next = 6;
            return this._createBlock(tip, address);

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

  function createBlock(_x, _x2) {
    return _ref3.apply(this, arguments);
  }

  return createBlock;
}();

/**
 * Create a block template (without a lock).
 * @method
 * @private
 * @param {ChainEntry?} tip
 * @param {Address?} address
 * @returns {Promise} - Returns {@link BlockTemplate}.
 */

Miner.prototype._createBlock = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(tip, address) {
    var version, mtp, time, state, target, locktime, attempt, block;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            version = this.options.version;


            if (!tip) tip = this.chain.tip;

            if (!address) address = this.getAddress();

            if (!(version === -1)) {
              _context4.next = 7;
              break;
            }

            _context4.next = 6;
            return this.chain.computeBlockVersion(tip);

          case 6:
            version = _context4.sent;

          case 7:
            _context4.next = 9;
            return this.chain.getMedianTime(tip);

          case 9:
            mtp = _context4.sent;
            time = Math.max(this.network.now(), mtp + 1);
            _context4.next = 13;
            return this.chain.getDeployments(time, tip);

          case 13:
            state = _context4.sent;
            _context4.next = 16;
            return this.chain.getTarget(time, tip);

          case 16:
            target = _context4.sent;
            locktime = state.hasMTP() ? mtp : time;
            attempt = new BlockTemplate({
              prevBlock: tip.hash,
              height: tip.height + 1,
              version: version,
              time: time,
              bits: target,
              locktime: locktime,
              mtp: mtp,
              flags: state.flags,
              address: address,
              coinbaseFlags: this.options.coinbaseFlags,
              witness: state.hasWitness(),
              interval: this.network.halvingInterval,
              weight: this.options.reservedWeight,
              sigops: this.options.reservedSigops
            });


            this.assemble(attempt);

            this.logger.debug('Created block template (height=%d, weight=%d, fees=%d, txs=%s, diff=%d).', attempt.height, attempt.weight, Amount.btc(attempt.fees), attempt.items.length + 1, attempt.getDifficulty());

            if (!this.options.preverify) {
              _context4.next = 36;
              break;
            }

            block = attempt.toBlock();
            _context4.prev = 23;
            _context4.next = 26;
            return this.chain._verifyBlock(block);

          case 26:
            _context4.next = 35;
            break;

          case 28:
            _context4.prev = 28;
            _context4.t0 = _context4['catch'](23);

            if (!(_context4.t0.type === 'VerifyError')) {
              _context4.next = 34;
              break;
            }

            this.logger.warning('Miner created invalid block!');
            this.logger.error(_context4.t0);
            throw new Error('BUG: Miner created invalid block.');

          case 34:
            throw _context4.t0;

          case 35:

            this.logger.debug('Preverified block %d successfully!', attempt.height);

          case 36:
            return _context4.abrupt('return', attempt);

          case 37:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[23, 28]]);
  }));

  function _createBlock(_x3, _x4) {
    return _ref4.apply(this, arguments);
  }

  return _createBlock;
}();

/**
 * Update block timestamp.
 * @param {BlockTemplate} attempt
 */

Miner.prototype.updateTime = function updateTime(attempt) {
  attempt.time = Math.max(this.network.now(), attempt.mtp + 1);
};

/**
 * Create a cpu miner job.
 * @method
 * @param {ChainEntry?} tip
 * @param {Address?} address
 * @returns {Promise} Returns {@link CPUJob}.
 */

Miner.prototype.createJob = function createJob(tip, address) {
  return this.cpu.createJob(tip, address);
};

/**
 * Mine a single block.
 * @method
 * @param {ChainEntry?} tip
 * @param {Address?} address
 * @returns {Promise} Returns {@link Block}.
 */

Miner.prototype.mineBlock = function mineBlock(tip, address) {
  return this.cpu.mineBlock(tip, address);
};

/**
 * Add an address to the address list.
 * @param {Address} address
 */

Miner.prototype.addAddress = function addAddress(address) {
  this.addresses.push(Address(address));
};

/**
 * Get a random address from the address list.
 * @returns {Address}
 */

Miner.prototype.getAddress = function getAddress() {
  if (this.addresses.length === 0) return new Address();
  return this.addresses[Math.random() * this.addresses.length | 0];
};

/**
 * Get mempool entries, sort by dependency order.
 * Prioritize by priority and fee rates.
 * @param {BlockTemplate} attempt
 * @returns {MempoolEntry[]}
 */

Miner.prototype.assemble = function assemble(attempt) {
  if (!this.mempool) {
    attempt.refresh();
    return;
  }

  assert(this.mempool.tip === this.chain.tip.hash, 'Mempool/chain tip mismatch! Unsafe to create block.');

  var depMap = new _map2.default();
  var queue = new Heap(cmpRate);

  var priority = this.options.priorityWeight > 0;

  if (priority) queue.set(cmpPriority);

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(this.mempool.map.values()), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var entry = _step.value;

      var item = BlockEntry.fromEntry(entry, attempt);
      var tx = item.tx;

      if (tx.isCoinbase()) throw new Error('Cannot add coinbase to block.');

      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = (0, _getIterator3.default)(tx.inputs), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var _ref5 = _step3.value;
          var prevout = _ref5.prevout;

          var _hash = prevout.hash;

          if (!this.mempool.hasEntry(_hash)) continue;

          item.depCount += 1;

          if (!depMap.has(_hash)) depMap.set(_hash, []);

          depMap.get(_hash).push(item);
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

      if (item.depCount > 0) continue;

      queue.insert(item);
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

  while (queue.size() > 0) {
    var item = queue.shift();
    var tx = item.tx;
    var hash = item.hash;

    var weight = attempt.weight;
    var sigops = attempt.sigops;

    if (!tx.isFinal(attempt.height, attempt.locktime)) continue;

    if (!attempt.witness && tx.hasWitness()) continue;

    weight += tx.getWeight();

    if (weight > this.options.maxWeight) continue;

    sigops += item.sigops;

    if (sigops > this.options.maxSigops) continue;

    if (priority) {
      if (weight > this.options.priorityWeight || item.priority < this.options.priorityThreshold) {
        priority = false;
        queue.set(cmpRate);
        queue.init();
        queue.insert(item);
        continue;
      }
    } else {
      if (item.free && weight >= this.options.minWeight) continue;
    }

    attempt.weight = weight;
    attempt.sigops = sigops;
    attempt.fees += item.fee;
    attempt.items.push(item);

    var deps = depMap.get(hash);

    if (!deps) continue;

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = (0, _getIterator3.default)(deps), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var _item = _step2.value;

        if (--_item.depCount === 0) queue.insert(_item);
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
  }

  attempt.refresh();

  assert(attempt.weight <= consensus.MAX_BLOCK_WEIGHT, 'Block exceeds reserved weight!');

  if (this.options.preverify) {
    var block = attempt.toBlock();

    assert(block.getWeight() <= attempt.weight, 'Block exceeds reserved weight!');

    assert(block.getBaseSize() <= consensus.MAX_BLOCK_SIZE, 'Block exceeds max block size.');
  }
};

/**
 * MinerOptions
 * @alias module:mining.MinerOptions
 * @constructor
 * @param {Object}
 */

function MinerOptions(options) {
  if (!(this instanceof MinerOptions)) return new MinerOptions(options);

  this.network = Network.primary;
  this.logger = null;
  this.workers = null;
  this.chain = null;
  this.mempool = null;

  this.version = -1;
  this.addresses = [];
  this.coinbaseFlags = Buffer.from('mined by bcoin', 'ascii');
  this.preverify = false;

  this.minWeight = policy.MIN_BLOCK_WEIGHT;
  this.maxWeight = policy.MAX_BLOCK_WEIGHT;
  this.priorityWeight = policy.BLOCK_PRIORITY_WEIGHT;
  this.priorityThreshold = policy.BLOCK_PRIORITY_THRESHOLD;
  this.maxSigops = consensus.MAX_BLOCK_SIGOPS_COST;
  this.reservedWeight = 4000;
  this.reservedSigops = 400;

  this.fromOptions(options);
}

/**
 * Inject properties from object.
 * @private
 * @param {Object} options
 * @returns {MinerOptions}
 */

MinerOptions.prototype.fromOptions = function fromOptions(options) {
  assert(options, 'Miner requires options.');
  assert(options.chain && (0, _typeof3.default)(options.chain) === 'object', 'Miner requires a blockchain.');

  this.chain = options.chain;
  this.network = options.chain.network;
  this.logger = options.chain.logger;
  this.workers = options.chain.workers;

  if (options.logger != null) {
    assert((0, _typeof3.default)(options.logger) === 'object');
    this.logger = options.logger;
  }

  if (options.workers != null) {
    assert((0, _typeof3.default)(options.workers) === 'object');
    this.workers = options.workers;
  }

  if (options.mempool != null) {
    assert((0, _typeof3.default)(options.mempool) === 'object');
    this.mempool = options.mempool;
  }

  if (options.version != null) {
    assert(util.isInt(options.version));
    this.version = options.version;
  }

  if (options.address) {
    if (Array.isArray(options.address)) {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = (0, _getIterator3.default)(options.address), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var item = _step4.value;

          this.addresses.push(new Address(item));
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    } else {
      this.addresses.push(new Address(options.address));
    }
  }

  if (options.addresses) {
    assert(Array.isArray(options.addresses));
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
      for (var _iterator5 = (0, _getIterator3.default)(options.addresses), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
        var _item2 = _step5.value;

        this.addresses.push(new Address(_item2));
      }
    } catch (err) {
      _didIteratorError5 = true;
      _iteratorError5 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion5 && _iterator5.return) {
          _iterator5.return();
        }
      } finally {
        if (_didIteratorError5) {
          throw _iteratorError5;
        }
      }
    }
  }

  if (options.coinbaseFlags) {
    var flags = options.coinbaseFlags;
    if (typeof flags === 'string') flags = Buffer.from(flags, 'utf8');
    assert(Buffer.isBuffer(flags));
    assert(flags.length <= 20, 'Coinbase flags > 20 bytes.');
    this.coinbaseFlags = flags;
  }

  if (options.preverify != null) {
    assert(typeof options.preverify === 'boolean');
    this.preverify = options.preverify;
  }

  if (options.minWeight != null) {
    assert(util.isU32(options.minWeight));
    this.minWeight = options.minWeight;
  }

  if (options.maxWeight != null) {
    assert(util.isU32(options.maxWeight));
    assert(options.maxWeight <= consensus.MAX_BLOCK_WEIGHT, 'Max weight must be below MAX_BLOCK_WEIGHT');
    this.maxWeight = options.maxWeight;
  }

  if (options.maxSigops != null) {
    assert(util.isU32(options.maxSigops));
    assert(options.maxSigops <= consensus.MAX_BLOCK_SIGOPS_COST, 'Max sigops must be below MAX_BLOCK_SIGOPS_COST');
    this.maxSigops = options.maxSigops;
  }

  if (options.priorityWeight != null) {
    assert(util.isU32(options.priorityWeight));
    this.priorityWeight = options.priorityWeight;
  }

  if (options.priorityThreshold != null) {
    assert(util.isU32(options.priorityThreshold));
    this.priorityThreshold = options.priorityThreshold;
  }

  if (options.reservedWeight != null) {
    assert(util.isU32(options.reservedWeight));
    this.reservedWeight = options.reservedWeight;
  }

  if (options.reservedSigops != null) {
    assert(util.isU32(options.reservedSigops));
    this.reservedSigops = options.reservedSigops;
  }

  return this;
};

/**
 * Instantiate miner options from object.
 * @param {Object} options
 * @returns {MinerOptions}
 */

MinerOptions.fromOptions = function fromOptions(options) {
  return new MinerOptions().fromOptions(options);
};

/*
 * Helpers
 */

function cmpPriority(a, b) {
  if (a.priority === b.priority) return cmpRate(a, b);
  return b.priority - a.priority;
}

function cmpRate(a, b) {
  var x = a.rate;
  var y = b.rate;

  if (a.descRate > a.rate) x = a.descRate;

  if (b.descRate > b.rate) y = b.descRate;

  if (x === y) {
    x = a.priority;
    y = b.priority;
  }

  return y - x;
}

/*
 * Expose
 */

module.exports = Miner;