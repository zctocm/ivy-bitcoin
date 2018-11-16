/*!
 * mempoolentry.js - mempool entry object for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var policy = require('../protocol/policy');
var util = require('../utils/util');
var Script = require('../script/script');
var BufferReader = require('../utils/reader');
var StaticWriter = require('../utils/staticwriter');
var TX = require('../primitives/tx');

/**
 * Represents a mempool entry.
 * @alias module:mempool.MempoolEntry
 * @constructor
 * @param {Object} options
 * @param {TX} options.tx - Transaction in mempool.
 * @param {Number} options.height - Entry height.
 * @param {Number} options.priority - Entry priority.
 * @param {Number} options.time - Entry time.
 * @param {Amount} options.value - Value of on-chain coins.
 * @property {TX} tx
 * @property {Number} height
 * @property {Number} priority
 * @property {Number} time
 * @property {Amount} value
 */

function MempoolEntry(options) {
  if (!(this instanceof MempoolEntry)) return new MempoolEntry(options);

  this.tx = null;
  this.height = -1;
  this.size = 0;
  this.sigops = 0;
  this.priority = 0;
  this.fee = 0;
  this.deltaFee = 0;
  this.time = 0;
  this.value = 0;
  this.coinbase = false;
  this.dependencies = false;
  this.descFee = 0;
  this.descSize = 0;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from options object.
 * @private
 * @param {Object} options
 */

MempoolEntry.prototype.fromOptions = function fromOptions(options) {
  this.tx = options.tx;
  this.height = options.height;
  this.size = options.size;
  this.sigops = options.sigops;
  this.priority = options.priority;
  this.fee = options.fee;
  this.deltaFee = options.deltaFee;
  this.time = options.time;
  this.value = options.value;
  this.coinbase = options.coinbase;
  this.dependencies = options.dependencies;
  this.descFee = options.descFee;
  this.descSize = options.descSize;
  return this;
};

/**
 * Instantiate mempool entry from options.
 * @param {Object} options
 * @returns {MempoolEntry}
 */

MempoolEntry.fromOptions = function fromOptions(options) {
  return new MempoolEntry().fromOptions(options);
};

/**
 * Inject properties from transaction.
 * @private
 * @param {TX} tx
 * @param {Number} height
 */

MempoolEntry.prototype.fromTX = function fromTX(tx, view, height) {
  var flags = Script.flags.STANDARD_VERIFY_FLAGS;
  var value = tx.getChainValue(view);
  var sigops = tx.getSigopsCost(view, flags);
  var size = tx.getSigopsSize(sigops);
  var priority = tx.getPriority(view, height, size);
  var fee = tx.getFee(view);

  var dependencies = false;
  var coinbase = false;

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(tx.inputs), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var _ref = _step.value;
      var prevout = _ref.prevout;

      if (view.isCoinbase(prevout)) coinbase = true;

      if (view.getHeight(prevout) === -1) dependencies = true;
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

  this.tx = tx;
  this.height = height;
  this.size = size;
  this.sigops = sigops;
  this.priority = priority;
  this.fee = fee;
  this.deltaFee = fee;
  this.time = util.now();
  this.value = value;
  this.coinbase = coinbase;
  this.dependencies = dependencies;
  this.descFee = fee;
  this.descSize = size;

  return this;
};

/**
 * Create a mempool entry from a TX.
 * @param {TX} tx
 * @param {Number} height - Entry height.
 * @returns {MempoolEntry}
 */

MempoolEntry.fromTX = function fromTX(tx, view, height) {
  return new MempoolEntry().fromTX(tx, view, height);
};

/**
 * Calculate transaction hash.
 * @param {String?} enc
 * @returns {Hash}
 */

MempoolEntry.prototype.hash = function hash(enc) {
  return this.tx.hash(enc);
};

/**
 * Calculate reverse transaction hash.
 * @returns {Hash}
 */

MempoolEntry.prototype.txid = function txid() {
  return this.tx.txid();
};

/**
 * Calculate priority, taking into account
 * the entry height delta, modified size,
 * and chain value.
 * @param {Number} height
 * @returns {Number} Priority.
 */

MempoolEntry.prototype.getPriority = function getPriority(height) {
  var delta = height - this.height;
  var priority = delta * this.value / this.size;
  var result = this.priority + Math.floor(priority);
  if (result < 0) result = 0;
  return result;
};

/**
 * Get fee.
 * @returns {Amount}
 */

MempoolEntry.prototype.getFee = function getFee() {
  return this.fee;
};

/**
 * Get delta fee.
 * @returns {Amount}
 */

MempoolEntry.prototype.getDeltaFee = function getDeltaFee() {
  return this.deltaFee;
};

/**
 * Calculate fee rate.
 * @returns {Rate}
 */

MempoolEntry.prototype.getRate = function getRate() {
  return policy.getRate(this.size, this.fee);
};

/**
 * Calculate delta fee rate.
 * @returns {Rate}
 */

MempoolEntry.prototype.getDeltaRate = function getDeltaRate() {
  return policy.getRate(this.size, this.deltaFee);
};

/**
 * Calculate fee cumulative descendant rate.
 * @returns {Rate}
 */

MempoolEntry.prototype.getDescRate = function getDescRate() {
  return policy.getRate(this.descSize, this.descFee);
};

/**
 * Calculate the memory usage of a transaction.
 * Note that this only calculates the JS heap
 * size. Sizes of buffers are ignored (the v8
 * heap is what we care most about). All numbers
 * are based on the output of v8 heap snapshots
 * of TX objects.
 * @returns {Number} Usage in bytes.
 */

MempoolEntry.prototype.memUsage = function memUsage() {
  var tx = this.tx;
  var total = 0;

  total += 176; // mempool entry
  total += 48; // coinbase
  total += 48; // dependencies

  total += 208; // tx
  total += 80; // _hash
  total += 88; // _hhash
  total += 80; // _raw
  total += 80; // _whash
  total += 48; // mutable

  total += 32; // input array

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(tx.inputs), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var input = _step2.value;

      total += 120; // input
      total += 104; // prevout
      total += 88; // prevout hash

      total += 40; // script
      total += 80; // script raw buffer
      total += 32; // script code array
      total += input.script.code.length * 40; // opcodes

      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = (0, _getIterator3.default)(input.script.code), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var op = _step4.value;

          if (op.data) total += 80; // op buffers
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

      total += 96; // witness
      total += 32; // witness items
      total += input.witness.items.length * 80; // witness buffers
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

  total += 32; // output array

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(tx.outputs), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var output = _step3.value;

      total += 104; // output
      total += 40; // script
      total += 80; // script raw buffer
      total += 32; // script code array
      total += output.script.code.length * 40; // opcodes

      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        for (var _iterator5 = (0, _getIterator3.default)(output.script.code), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var _op = _step5.value;

          if (_op.data) total += 80; // op buffers
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

  return total;
};

/**
 * Test whether the entry is free with
 * the current priority (calculated by
 * current height).
 * @param {Number} height
 * @returns {Boolean}
 */

MempoolEntry.prototype.isFree = function isFree(height) {
  var priority = this.getPriority(height);
  return priority > policy.FREE_THRESHOLD;
};

/**
 * Get entry serialization size.
 * @returns {Number}
 */

MempoolEntry.prototype.getSize = function getSize() {
  return this.tx.getSize() + 42;
};

/**
 * Serialize entry to a buffer.
 * @returns {Buffer}
 */

MempoolEntry.prototype.toRaw = function toRaw() {
  var bw = new StaticWriter(this.getSize());
  bw.writeBytes(this.tx.toRaw());
  bw.writeU32(this.height);
  bw.writeU32(this.size);
  bw.writeU32(this.sigops);
  bw.writeDouble(this.priority);
  bw.writeU64(this.fee);
  bw.writeU32(this.time);
  bw.writeU64(this.value);
  bw.writeU8(this.coinbase ? 1 : 0);
  bw.writeU8(this.dependencies ? 1 : 0);
  return bw.render();
};

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 * @returns {MempoolEntry}
 */

MempoolEntry.prototype.fromRaw = function fromRaw(data) {
  var br = new BufferReader(data);
  this.tx = TX.fromReader(br);
  this.height = br.readU32();
  this.size = br.readU32();
  this.sigops = br.readU32();
  this.priority = br.readDouble();
  this.fee = br.readU64();
  this.deltaFee = this.fee;
  this.time = br.readU32();
  this.value = br.readU64();
  this.coinbase = br.readU8() === 1;
  this.dependencies = br.readU8() === 1;
  this.descFee = this.fee;
  this.descSize = this.size;
  return this;
};

/**
 * Instantiate entry from serialized data.
 * @param {Buffer} data
 * @returns {MempoolEntry}
 */

MempoolEntry.fromRaw = function fromRaw(data) {
  return new MempoolEntry().fromRaw(data);
};

/*
 * Expose
 */

module.exports = MempoolEntry;