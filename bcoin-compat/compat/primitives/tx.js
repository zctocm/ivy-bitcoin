/*!
 * tx.js - transaction object for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _isSafeInteger = require('babel-runtime/core-js/number/is-safe-integer');

var _isSafeInteger2 = _interopRequireDefault(_isSafeInteger);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var util = require('../utils/util');
var encoding = require('../utils/encoding');
var digest = require('../crypto/digest');
var secp256k1 = require('../crypto/secp256k1');
var Amount = require('../btc/amount');
var Network = require('../protocol/network');
var Script = require('../script/script');
var BufferReader = require('../utils/reader');
var StaticWriter = require('../utils/staticwriter');
var Input = require('./input');
var Output = require('./output');
var Outpoint = require('./outpoint');
var InvItem = require('./invitem');
var Bloom = require('../utils/bloom');
var consensus = require('../protocol/consensus');
var policy = require('../protocol/policy');
var ScriptError = require('../script/scripterror');
var hashType = Script.hashType;

/**
 * A static transaction object.
 * @alias module:primitives.TX
 * @constructor
 * @param {Object} options - Transaction fields.
 * @property {Number} version - Transaction version. Note that Bcoin reads
 * versions as unsigned even though they are signed at the protocol level.
 * This value will never be negative.
 * @property {Number} flag - Flag field for segregated witness.
 * Always non-zero (1 if not present).
 * @property {Input[]} inputs
 * @property {Output[]} outputs
 * @property {Number} locktime - nLockTime
 */

function TX(options) {
  if (!(this instanceof TX)) return new TX(options);

  this.version = 1;
  this.inputs = [];
  this.outputs = [];
  this.locktime = 0;

  this.mutable = false;

  this._hash = null;
  this._hhash = null;
  this._whash = null;

  this._raw = null;
  this._size = -1;
  this._witness = -1;
  this._sigops = -1;

  this._hashPrevouts = null;
  this._hashSequence = null;
  this._hashOutputs = null;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from options object.
 * @private
 * @param {NakedTX} options
 */

TX.prototype.fromOptions = function fromOptions(options) {
  assert(options, 'TX data is required.');

  if (options.version != null) {
    assert(util.isU32(options.version), 'Version must be a uint32.');
    this.version = options.version;
  }

  if (options.inputs) {
    assert(Array.isArray(options.inputs), 'Inputs must be an array.');
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = (0, _getIterator3.default)(options.inputs), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var input = _step.value;

        this.inputs.push(new Input(input));
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
  }

  if (options.outputs) {
    assert(Array.isArray(options.outputs), 'Outputs must be an array.');
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = (0, _getIterator3.default)(options.outputs), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var output = _step2.value;

        this.outputs.push(new Output(output));
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

  if (options.locktime != null) {
    assert(util.isU32(options.locktime), 'Locktime must be a uint32.');
    this.locktime = options.locktime;
  }

  return this;
};

/**
 * Instantiate TX from options object.
 * @param {NakedTX} options
 * @returns {TX}
 */

TX.fromOptions = function fromOptions(options) {
  return new TX().fromOptions(options);
};

/**
 * Clone the transaction.
 * @returns {TX}
 */

TX.prototype.clone = function clone() {
  return new TX().inject(this);
};

/**
 * Inject properties from tx.
 * Used for cloning.
 * @private
 * @param {TX} tx
 * @returns {TX}
 */

TX.prototype.inject = function inject(tx) {
  this.version = tx.version;

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(tx.inputs), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var input = _step3.value;

      this.inputs.push(input.clone());
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

  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(tx.outputs), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var output = _step4.value;

      this.outputs.push(output.clone());
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

  this.locktime = tx.locktime;

  return this;
};

/**
 * Clear any cached values.
 */

TX.prototype.refresh = function refresh() {
  this._hash = null;
  this._hhash = null;
  this._whash = null;

  this._raw = null;
  this._size = -1;
  this._witness = -1;
  this._sigops = -1;

  this._hashPrevouts = null;
  this._hashSequence = null;
  this._hashOutputs = null;
};

/**
 * Hash the transaction with the non-witness serialization.
 * @param {String?} enc - Can be `'hex'` or `null`.
 * @returns {Hash|Buffer} hash
 */

TX.prototype.hash = function hash(enc) {
  var h = this._hash;

  if (!h) {
    h = digest.hash256(this.toNormal());
    if (!this.mutable) this._hash = h;
  }

  if (enc === 'hex') {
    var hex = this._hhash;
    if (!hex) {
      hex = h.toString('hex');
      if (!this.mutable) this._hhash = hex;
    }
    h = hex;
  }

  return h;
};

/**
 * Hash the transaction with the witness
 * serialization, return the wtxid (normal
 * hash if no witness is present, all zeroes
 * if coinbase).
 * @param {String?} enc - Can be `'hex'` or `null`.
 * @returns {Hash|Buffer} hash
 */

TX.prototype.witnessHash = function witnessHash(enc) {
  if (!this.hasWitness()) return this.hash(enc);

  var hash = this._whash;

  if (!hash) {
    hash = digest.hash256(this.toRaw());
    if (!this.mutable) this._whash = hash;
  }

  return enc === 'hex' ? hash.toString('hex') : hash;
};

/**
 * Serialize the transaction. Note
 * that this is cached. This will use
 * the witness serialization if a
 * witness is present.
 * @returns {Buffer} Serialized transaction.
 */

TX.prototype.toRaw = function toRaw() {
  return this.frame().data;
};

/**
 * Serialize the transaction without the
 * witness vector, regardless of whether it
 * is a witness transaction or not.
 * @returns {Buffer} Serialized transaction.
 */

TX.prototype.toNormal = function toNormal() {
  if (this.hasWitness()) return this.frameNormal().data;
  return this.toRaw();
};

/**
 * Write the transaction to a buffer writer.
 * @param {BufferWriter} bw
 */

TX.prototype.toWriter = function toWriter(bw) {
  if (this.mutable) {
    if (this.hasWitness()) return this.writeWitness(bw);
    return this.writeNormal(bw);
  }

  bw.writeBytes(this.toRaw());

  return bw;
};

/**
 * Write the transaction to a buffer writer.
 * Uses non-witness serialization.
 * @param {BufferWriter} bw
 */

TX.prototype.toNormalWriter = function toNormalWriter(bw) {
  if (this.hasWitness()) {
    this.writeNormal(bw);
    return bw;
  }
  return this.toWriter(bw);
};

/**
 * Serialize the transaction. Note
 * that this is cached. This will use
 * the witness serialization if a
 * witness is present.
 * @private
 * @returns {RawTX}
 */

TX.prototype.frame = function frame() {
  if (this.mutable) {
    assert(!this._raw);
    if (this.hasWitness()) return this.frameWitness();
    return this.frameNormal();
  }

  if (this._raw) {
    assert(this._size >= 0);
    assert(this._witness >= 0);
    var _raw = new RawTX(this._size, this._witness);
    _raw.data = this._raw;
    return _raw;
  }

  var raw = void 0;
  if (this.hasWitness()) raw = this.frameWitness();else raw = this.frameNormal();

  this._raw = raw.data;
  this._size = raw.size;
  this._witness = raw.witness;

  return raw;
};

/**
 * Calculate total size and size of the witness bytes.
 * @returns {Object} Contains `size` and `witness`.
 */

TX.prototype.getSizes = function getSizes() {
  if (this.mutable) {
    if (this.hasWitness()) return this.getWitnessSizes();
    return this.getNormalSizes();
  }
  return this.frame();
};

/**
 * Calculate the virtual size of the transaction.
 * Note that this is cached.
 * @returns {Number} vsize
 */

TX.prototype.getVirtualSize = function getVirtualSize() {
  var scale = consensus.WITNESS_SCALE_FACTOR;
  return (this.getWeight() + scale - 1) / scale | 0;
};

/**
 * Calculate the virtual size of the transaction
 * (weighted against bytes per sigop cost).
 * @param {Number} sigops - Sigops cost.
 * @returns {Number} vsize
 */

TX.prototype.getSigopsSize = function getSigopsSize(sigops) {
  var scale = consensus.WITNESS_SCALE_FACTOR;
  var bytes = policy.BYTES_PER_SIGOP;
  var weight = Math.max(this.getWeight(), sigops * bytes);
  return (weight + scale - 1) / scale | 0;
};

/**
 * Calculate the weight of the transaction.
 * Note that this is cached.
 * @returns {Number} weight
 */

TX.prototype.getWeight = function getWeight() {
  var raw = this.getSizes();
  var base = raw.size - raw.witness;
  return base * (consensus.WITNESS_SCALE_FACTOR - 1) + raw.size;
};

/**
 * Calculate the real size of the transaction
 * with the witness included.
 * @returns {Number} size
 */

TX.prototype.getSize = function getSize() {
  return this.getSizes().size;
};

/**
 * Calculate the size of the transaction
 * without the witness.
 * with the witness included.
 * @returns {Number} size
 */

TX.prototype.getBaseSize = function getBaseSize() {
  var raw = this.getSizes();
  return raw.size - raw.witness;
};

/**
 * Test whether the transaction has a non-empty witness.
 * @returns {Boolean}
 */

TX.prototype.hasWitness = function hasWitness() {
  if (this._witness !== -1) return this._witness !== 0;

  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = (0, _getIterator3.default)(this.inputs), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var input = _step5.value;

      if (input.witness.items.length > 0) return true;
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

  return false;
};

/**
 * Get the signature hash of the transaction for signing verifying.
 * @param {Number} index - Index of input being signed/verified.
 * @param {Script} prev - Previous output script or redeem script
 * (in the case of witnesspubkeyhash, this should be the generated
 * p2pkh script).
 * @param {Amount} value - Previous output value.
 * @param {SighashType} type - Sighash type.
 * @param {Number} version - Sighash version (0=legacy, 1=segwit).
 * @returns {Buffer} Signature hash.
 */

TX.prototype.signatureHash = function signatureHash(index, prev, value, type, version) {
  assert(index >= 0 && index < this.inputs.length);
  assert(prev instanceof Script);
  assert(typeof value === 'number');
  assert(typeof type === 'number');

  // Traditional sighashing
  if (version === 0) return this.signatureHashV0(index, prev, type);

  // Segwit sighashing
  if (version === 1) return this.signatureHashV1(index, prev, value, type);

  throw new Error('Unknown sighash version.');
};

/**
 * Legacy sighashing -- O(n^2).
 * @private
 * @param {Number} index
 * @param {Script} prev
 * @param {SighashType} type
 * @returns {Buffer}
 */

TX.prototype.signatureHashV0 = function signatureHashV0(index, prev, type) {
  if ((type & 0x1f) === hashType.SINGLE) {
    // Bitcoind used to return 1 as an error code:
    // it ended up being treated like a hash.
    if (index >= this.outputs.length) return Buffer.from(encoding.ONE_HASH);
  }

  // Remove all code separators.
  prev = prev.removeSeparators();

  // Calculate buffer size.
  var size = this.hashSize(index, prev, type);
  var bw = StaticWriter.pool(size);

  bw.writeU32(this.version);

  // Serialize inputs.
  if (type & hashType.ANYONECANPAY) {
    // Serialize only the current
    // input if ANYONECANPAY.
    var input = this.inputs[index];

    // Count.
    bw.writeVarint(1);

    // Outpoint.
    input.prevout.toWriter(bw);

    // Replace script with previous
    // output script if current index.
    bw.writeVarBytes(prev.toRaw());
    bw.writeU32(input.sequence);
  } else {
    bw.writeVarint(this.inputs.length);
    for (var i = 0; i < this.inputs.length; i++) {
      var _input = this.inputs[i];

      // Outpoint.
      _input.prevout.toWriter(bw);

      // Replace script with previous
      // output script if current index.
      if (i === index) {
        bw.writeVarBytes(prev.toRaw());
        bw.writeU32(_input.sequence);
        continue;
      }

      // Script is null.
      bw.writeVarint(0);

      // Sequences are 0 if NONE or SINGLE.
      switch (type & 0x1f) {
        case hashType.NONE:
        case hashType.SINGLE:
          bw.writeU32(0);
          break;
        default:
          bw.writeU32(_input.sequence);
          break;
      }
    }
  }

  // Serialize outputs.
  switch (type & 0x1f) {
    case hashType.NONE:
      {
        // No outputs if NONE.
        bw.writeVarint(0);
        break;
      }
    case hashType.SINGLE:
      {
        var output = this.outputs[index];

        // Drop all outputs after the
        // current input index if SINGLE.
        bw.writeVarint(index + 1);

        for (var _i = 0; _i < index; _i++) {
          // Null all outputs not at
          // current input index.
          bw.writeI64(-1);
          bw.writeVarint(0);
        }

        // Regular serialization
        // at current input index.
        output.toWriter(bw);

        break;
      }
    default:
      {
        // Regular output serialization if ALL.
        bw.writeVarint(this.outputs.length);
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
          for (var _iterator6 = (0, _getIterator3.default)(this.outputs), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var _output = _step6.value;

            _output.toWriter(bw);
          }
        } catch (err) {
          _didIteratorError6 = true;
          _iteratorError6 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }
          } finally {
            if (_didIteratorError6) {
              throw _iteratorError6;
            }
          }
        }

        break;
      }
  }

  bw.writeU32(this.locktime);

  // Append the hash type.
  bw.writeU32(type);

  return digest.hash256(bw.render());
};

/**
 * Calculate sighash size.
 * @private
 * @param {Number} index
 * @param {Script} prev
 * @param {Number} type
 * @returns {Number}
 */

TX.prototype.hashSize = function hashSize(index, prev, type) {
  var size = 0;

  size += 4;

  if (type & hashType.ANYONECANPAY) {
    size += 1;
    size += 36;
    size += prev.getVarSize();
    size += 4;
  } else {
    size += encoding.sizeVarint(this.inputs.length);
    size += 41 * (this.inputs.length - 1);
    size += 36;
    size += prev.getVarSize();
    size += 4;
  }

  switch (type & 0x1f) {
    case hashType.NONE:
      size += 1;
      break;
    case hashType.SINGLE:
      size += encoding.sizeVarint(index + 1);
      size += 9 * index;
      size += this.outputs[index].getSize();
      break;
    default:
      size += encoding.sizeVarint(this.outputs.length);
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;
      var _iteratorError7 = undefined;

      try {
        for (var _iterator7 = (0, _getIterator3.default)(this.outputs), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
          var output = _step7.value;

          size += output.getSize();
        }
      } catch (err) {
        _didIteratorError7 = true;
        _iteratorError7 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion7 && _iterator7.return) {
            _iterator7.return();
          }
        } finally {
          if (_didIteratorError7) {
            throw _iteratorError7;
          }
        }
      }

      break;
  }

  size += 8;

  return size;
};

/**
 * Witness sighashing -- O(n).
 * @private
 * @param {Number} index
 * @param {Script} prev
 * @param {Amount} value
 * @param {SighashType} type
 * @returns {Buffer}
 */

TX.prototype.signatureHashV1 = function signatureHashV1(index, prev, value, type) {
  var input = this.inputs[index];
  var prevouts = encoding.ZERO_HASH;
  var sequences = encoding.ZERO_HASH;
  var outputs = encoding.ZERO_HASH;

  if (!(type & hashType.ANYONECANPAY)) {
    if (this._hashPrevouts) {
      prevouts = this._hashPrevouts;
    } else {
      var _bw = StaticWriter.pool(this.inputs.length * 36);

      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = undefined;

      try {
        for (var _iterator8 = (0, _getIterator3.default)(this.inputs), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var _input2 = _step8.value;

          _input2.prevout.toWriter(_bw);
        }
      } catch (err) {
        _didIteratorError8 = true;
        _iteratorError8 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion8 && _iterator8.return) {
            _iterator8.return();
          }
        } finally {
          if (_didIteratorError8) {
            throw _iteratorError8;
          }
        }
      }

      prevouts = digest.hash256(_bw.render());

      if (!this.mutable) this._hashPrevouts = prevouts;
    }
  }

  if (!(type & hashType.ANYONECANPAY) && (type & 0x1f) !== hashType.SINGLE && (type & 0x1f) !== hashType.NONE) {
    if (this._hashSequence) {
      sequences = this._hashSequence;
    } else {
      var _bw2 = StaticWriter.pool(this.inputs.length * 4);

      var _iteratorNormalCompletion9 = true;
      var _didIteratorError9 = false;
      var _iteratorError9 = undefined;

      try {
        for (var _iterator9 = (0, _getIterator3.default)(this.inputs), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
          var _input3 = _step9.value;

          _bw2.writeU32(_input3.sequence);
        }
      } catch (err) {
        _didIteratorError9 = true;
        _iteratorError9 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion9 && _iterator9.return) {
            _iterator9.return();
          }
        } finally {
          if (_didIteratorError9) {
            throw _iteratorError9;
          }
        }
      }

      sequences = digest.hash256(_bw2.render());

      if (!this.mutable) this._hashSequence = sequences;
    }
  }

  if ((type & 0x1f) !== hashType.SINGLE && (type & 0x1f) !== hashType.NONE) {
    if (this._hashOutputs) {
      outputs = this._hashOutputs;
    } else {
      var _size = 0;

      var _iteratorNormalCompletion10 = true;
      var _didIteratorError10 = false;
      var _iteratorError10 = undefined;

      try {
        for (var _iterator10 = (0, _getIterator3.default)(this.outputs), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
          var output = _step10.value;

          _size += output.getSize();
        }
      } catch (err) {
        _didIteratorError10 = true;
        _iteratorError10 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion10 && _iterator10.return) {
            _iterator10.return();
          }
        } finally {
          if (_didIteratorError10) {
            throw _iteratorError10;
          }
        }
      }

      var _bw3 = StaticWriter.pool(_size);

      var _iteratorNormalCompletion11 = true;
      var _didIteratorError11 = false;
      var _iteratorError11 = undefined;

      try {
        for (var _iterator11 = (0, _getIterator3.default)(this.outputs), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
          var _output2 = _step11.value;

          _output2.toWriter(_bw3);
        }
      } catch (err) {
        _didIteratorError11 = true;
        _iteratorError11 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion11 && _iterator11.return) {
            _iterator11.return();
          }
        } finally {
          if (_didIteratorError11) {
            throw _iteratorError11;
          }
        }
      }

      outputs = digest.hash256(_bw3.render());

      if (!this.mutable) this._hashOutputs = outputs;
    }
  } else if ((type & 0x1f) === hashType.SINGLE) {
    if (index < this.outputs.length) {
      var _output3 = this.outputs[index];
      outputs = digest.hash256(_output3.toRaw());
    }
  }

  var size = 156 + prev.getVarSize();
  var bw = StaticWriter.pool(size);

  bw.writeU32(this.version);
  bw.writeBytes(prevouts);
  bw.writeBytes(sequences);
  bw.writeHash(input.prevout.hash);
  bw.writeU32(input.prevout.index);
  bw.writeVarBytes(prev.toRaw());
  bw.writeI64(value);
  bw.writeU32(input.sequence);
  bw.writeBytes(outputs);
  bw.writeU32(this.locktime);
  bw.writeU32(type);

  return digest.hash256(bw.render());
};

/**
 * Verify signature.
 * @param {Number} index
 * @param {Script} prev
 * @param {Amount} value
 * @param {Buffer} sig
 * @param {Buffer} key
 * @param {Number} version
 * @returns {Boolean}
 */

TX.prototype.checksig = function checksig(index, prev, value, sig, key, version) {
  if (sig.length === 0) return false;

  var type = sig[sig.length - 1];
  var hash = this.signatureHash(index, prev, value, type, version);

  return secp256k1.verify(hash, sig.slice(0, -1), key);
};

/**
 * Create a signature suitable for inserting into scriptSigs/witnesses.
 * @param {Number} index - Index of input being signed.
 * @param {Script} prev - Previous output script or redeem script
 * (in the case of witnesspubkeyhash, this should be the generated
 * p2pkh script).
 * @param {Amount} value - Previous output value.
 * @param {Buffer} key
 * @param {SighashType} type
 * @param {Number} version - Sighash version (0=legacy, 1=segwit).
 * @returns {Buffer} Signature in DER format.
 */

TX.prototype.signature = function signature(index, prev, value, key, type, version) {
  if (type == null) type = hashType.ALL;

  if (version == null) version = 0;

  var hash = this.signatureHash(index, prev, value, type, version);
  var sig = secp256k1.sign(hash, key);
  var bw = new StaticWriter(sig.length + 1);

  bw.writeBytes(sig);
  bw.writeU8(type);

  return bw.render();
};

/**
 * Verify all transaction inputs.
 * @param {CoinView} view
 * @param {VerifyFlags?} [flags=STANDARD_VERIFY_FLAGS]
 * @throws {ScriptError} on invalid inputs
 */

TX.prototype.check = function check(view, flags) {
  if (this.inputs.length === 0) throw new ScriptError('UNKNOWN_ERROR', 'No inputs.');

  if (this.isCoinbase()) return;

  for (var i = 0; i < this.inputs.length; i++) {
    var prevout = this.inputs[i].prevout;

    var coin = view.getOutput(prevout);

    if (!coin) throw new ScriptError('UNKNOWN_ERROR', 'No coin available.');

    this.checkInput(i, coin, flags);
  }
};

/**
 * Verify a transaction input.
 * @param {Number} index - Index of output being
 * verified.
 * @param {Coin|Output} coin - Previous output.
 * @param {VerifyFlags} [flags=STANDARD_VERIFY_FLAGS]
 * @throws {ScriptError} on invalid input
 */

TX.prototype.checkInput = function checkInput(index, coin, flags) {
  var input = this.inputs[index];

  assert(input, 'Input does not exist.');
  assert(coin, 'No coin passed.');

  Script.verify(input.script, input.witness, coin.script, this, index, coin.value, flags);
};

/**
 * Verify the transaction inputs on the worker pool
 * (if workers are enabled).
 * @param {CoinView} view
 * @param {VerifyFlags?} [flags=STANDARD_VERIFY_FLAGS]
 * @param {WorkerPool?} pool
 * @returns {Promise}
 */

TX.prototype.checkAsync = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(view, flags, pool) {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!(this.inputs.length === 0)) {
              _context.next = 2;
              break;
            }

            throw new ScriptError('UNKNOWN_ERROR', 'No inputs.');

          case 2:
            if (!this.isCoinbase()) {
              _context.next = 4;
              break;
            }

            return _context.abrupt('return');

          case 4:
            if (pool) {
              _context.next = 7;
              break;
            }

            this.check(view, flags);
            return _context.abrupt('return');

          case 7:
            _context.next = 9;
            return pool.check(this, view, flags);

          case 9:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function checkAsync(_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  }

  return checkAsync;
}();

/**
 * Verify a transaction input asynchronously.
 * @param {Number} index - Index of output being
 * verified.
 * @param {Coin|Output} coin - Previous output.
 * @param {VerifyFlags} [flags=STANDARD_VERIFY_FLAGS]
 * @param {WorkerPool?} pool
 * @returns {Promise}
 */

TX.prototype.checkInputAsync = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(index, coin, flags, pool) {
    var input;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            input = this.inputs[index];


            assert(input, 'Input does not exist.');
            assert(coin, 'No coin passed.');

            if (pool) {
              _context2.next = 6;
              break;
            }

            this.checkInput(index, coin, flags);
            return _context2.abrupt('return');

          case 6:
            _context2.next = 8;
            return pool.checkInput(this, index, coin, flags);

          case 8:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function checkInputAsync(_x4, _x5, _x6, _x7) {
    return _ref2.apply(this, arguments);
  }

  return checkInputAsync;
}();

/**
 * Verify all transaction inputs.
 * @param {CoinView} view
 * @param {VerifyFlags?} [flags=STANDARD_VERIFY_FLAGS]
 * @returns {Boolean} Whether the inputs are valid.
 */

TX.prototype.verify = function verify(view, flags) {
  try {
    this.check(view, flags);
  } catch (e) {
    if (e.type === 'ScriptError') return false;
    throw e;
  }
  return true;
};

/**
 * Verify a transaction input.
 * @param {Number} index - Index of output being
 * verified.
 * @param {Coin|Output} coin - Previous output.
 * @param {VerifyFlags} [flags=STANDARD_VERIFY_FLAGS]
 * @returns {Boolean} Whether the input is valid.
 */

TX.prototype.verifyInput = function verifyInput(index, coin, flags) {
  try {
    this.checkInput(index, coin, flags);
  } catch (e) {
    if (e.type === 'ScriptError') return false;
    throw e;
  }
  return true;
};

/**
 * Verify the transaction inputs on the worker pool
 * (if workers are enabled).
 * @param {CoinView} view
 * @param {VerifyFlags?} [flags=STANDARD_VERIFY_FLAGS]
 * @param {WorkerPool?} pool
 * @returns {Promise}
 */

TX.prototype.verifyAsync = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(view, flags, pool) {
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.prev = 0;
            _context3.next = 3;
            return this.checkAsync(view, flags, pool);

          case 3:
            _context3.next = 10;
            break;

          case 5:
            _context3.prev = 5;
            _context3.t0 = _context3['catch'](0);

            if (!(_context3.t0.type === 'ScriptError')) {
              _context3.next = 9;
              break;
            }

            return _context3.abrupt('return', false);

          case 9:
            throw _context3.t0;

          case 10:
            return _context3.abrupt('return', true);

          case 11:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this, [[0, 5]]);
  }));

  function verifyAsync(_x8, _x9, _x10) {
    return _ref3.apply(this, arguments);
  }

  return verifyAsync;
}();

/**
 * Verify a transaction input asynchronously.
 * @param {Number} index - Index of output being
 * verified.
 * @param {Coin|Output} coin - Previous output.
 * @param {VerifyFlags} [flags=STANDARD_VERIFY_FLAGS]
 * @param {WorkerPool?} pool
 * @returns {Promise}
 */

TX.prototype.verifyInputAsync = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(index, coin, flags, pool) {
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _context4.prev = 0;
            _context4.next = 3;
            return this.checkInput(index, coin, flags, pool);

          case 3:
            _context4.next = 10;
            break;

          case 5:
            _context4.prev = 5;
            _context4.t0 = _context4['catch'](0);

            if (!(_context4.t0.type === 'ScriptError')) {
              _context4.next = 9;
              break;
            }

            return _context4.abrupt('return', false);

          case 9:
            throw _context4.t0;

          case 10:
            return _context4.abrupt('return', true);

          case 11:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[0, 5]]);
  }));

  function verifyInputAsync(_x11, _x12, _x13, _x14) {
    return _ref4.apply(this, arguments);
  }

  return verifyInputAsync;
}();

/**
 * Test whether the transaction is a coinbase
 * by examining the inputs.
 * @returns {Boolean}
 */

TX.prototype.isCoinbase = function isCoinbase() {
  return this.inputs.length === 1 && this.inputs[0].prevout.isNull();
};

/**
 * Test whether the transaction is replaceable.
 * @returns {Boolean}
 */

TX.prototype.isRBF = function isRBF() {
  // Core doesn't do this, but it should:
  if (this.version === 2) return false;

  var _iteratorNormalCompletion12 = true;
  var _didIteratorError12 = false;
  var _iteratorError12 = undefined;

  try {
    for (var _iterator12 = (0, _getIterator3.default)(this.inputs), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
      var input = _step12.value;

      if (input.isRBF()) return true;
    }
  } catch (err) {
    _didIteratorError12 = true;
    _iteratorError12 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion12 && _iterator12.return) {
        _iterator12.return();
      }
    } finally {
      if (_didIteratorError12) {
        throw _iteratorError12;
      }
    }
  }

  return false;
};

/**
 * Calculate the fee for the transaction.
 * @param {CoinView} view
 * @returns {Amount} fee (zero if not all coins are available).
 */

TX.prototype.getFee = function getFee(view) {
  if (!this.hasCoins(view)) return 0;

  return this.getInputValue(view) - this.getOutputValue();
};

/**
 * Calculate the total input value.
 * @param {CoinView} view
 * @returns {Amount} value
 */

TX.prototype.getInputValue = function getInputValue(view) {
  var total = 0;

  var _iteratorNormalCompletion13 = true;
  var _didIteratorError13 = false;
  var _iteratorError13 = undefined;

  try {
    for (var _iterator13 = (0, _getIterator3.default)(this.inputs), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
      var _ref5 = _step13.value;
      var prevout = _ref5.prevout;

      var coin = view.getOutput(prevout);

      if (!coin) return 0;

      total += coin.value;
    }
  } catch (err) {
    _didIteratorError13 = true;
    _iteratorError13 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion13 && _iterator13.return) {
        _iterator13.return();
      }
    } finally {
      if (_didIteratorError13) {
        throw _iteratorError13;
      }
    }
  }

  return total;
};

/**
 * Calculate the total output value.
 * @returns {Amount} value
 */

TX.prototype.getOutputValue = function getOutputValue() {
  var total = 0;

  var _iteratorNormalCompletion14 = true;
  var _didIteratorError14 = false;
  var _iteratorError14 = undefined;

  try {
    for (var _iterator14 = (0, _getIterator3.default)(this.outputs), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
      var output = _step14.value;

      total += output.value;
    }
  } catch (err) {
    _didIteratorError14 = true;
    _iteratorError14 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion14 && _iterator14.return) {
        _iterator14.return();
      }
    } finally {
      if (_didIteratorError14) {
        throw _iteratorError14;
      }
    }
  }

  return total;
};

/**
 * Get all input addresses.
 * @private
 * @param {CoinView} view
 * @returns {Array} [addrs, table]
 */

TX.prototype._getInputAddresses = function _getInputAddresses(view) {
  var table = (0, _create2.default)(null);
  var addrs = [];

  if (this.isCoinbase()) return [addrs, table];

  var _iteratorNormalCompletion15 = true;
  var _didIteratorError15 = false;
  var _iteratorError15 = undefined;

  try {
    for (var _iterator15 = (0, _getIterator3.default)(this.inputs), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
      var input = _step15.value;

      var coin = view ? view.getOutputFor(input) : null;
      var addr = input.getAddress(coin);

      if (!addr) continue;

      var hash = addr.getHash('hex');

      if (!table[hash]) {
        table[hash] = true;
        addrs.push(addr);
      }
    }
  } catch (err) {
    _didIteratorError15 = true;
    _iteratorError15 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion15 && _iterator15.return) {
        _iterator15.return();
      }
    } finally {
      if (_didIteratorError15) {
        throw _iteratorError15;
      }
    }
  }

  return [addrs, table];
};

/**
 * Get all output addresses.
 * @private
 * @returns {Array} [addrs, table]
 */

TX.prototype._getOutputAddresses = function _getOutputAddresses() {
  var table = (0, _create2.default)(null);
  var addrs = [];

  var _iteratorNormalCompletion16 = true;
  var _didIteratorError16 = false;
  var _iteratorError16 = undefined;

  try {
    for (var _iterator16 = (0, _getIterator3.default)(this.outputs), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
      var output = _step16.value;

      var addr = output.getAddress();

      if (!addr) continue;

      var hash = addr.getHash('hex');

      if (!table[hash]) {
        table[hash] = true;
        addrs.push(addr);
      }
    }
  } catch (err) {
    _didIteratorError16 = true;
    _iteratorError16 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion16 && _iterator16.return) {
        _iterator16.return();
      }
    } finally {
      if (_didIteratorError16) {
        throw _iteratorError16;
      }
    }
  }

  return [addrs, table];
};

/**
 * Get all addresses.
 * @private
 * @param {CoinView} view
 * @returns {Array} [addrs, table]
 */

TX.prototype._getAddresses = function _getAddresses(view) {
  var _getInputAddresses2 = this._getInputAddresses(view),
      _getInputAddresses3 = (0, _slicedToArray3.default)(_getInputAddresses2, 2),
      addrs = _getInputAddresses3[0],
      table = _getInputAddresses3[1];

  var output = this.getOutputAddresses();

  var _iteratorNormalCompletion17 = true;
  var _didIteratorError17 = false;
  var _iteratorError17 = undefined;

  try {
    for (var _iterator17 = (0, _getIterator3.default)(output), _step17; !(_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done); _iteratorNormalCompletion17 = true) {
      var addr = _step17.value;

      var hash = addr.getHash('hex');

      if (!table[hash]) {
        table[hash] = true;
        addrs.push(addr);
      }
    }
  } catch (err) {
    _didIteratorError17 = true;
    _iteratorError17 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion17 && _iterator17.return) {
        _iterator17.return();
      }
    } finally {
      if (_didIteratorError17) {
        throw _iteratorError17;
      }
    }
  }

  return [addrs, table];
};

/**
 * Get all input addresses.
 * @param {CoinView|null} view
 * @returns {Address[]} addresses
 */

TX.prototype.getInputAddresses = function getInputAddresses(view) {
  var _getInputAddresses4 = this._getInputAddresses(view),
      _getInputAddresses5 = (0, _slicedToArray3.default)(_getInputAddresses4, 1),
      addrs = _getInputAddresses5[0];

  return addrs;
};

/**
 * Get all output addresses.
 * @returns {Address[]} addresses
 */

TX.prototype.getOutputAddresses = function getOutputAddresses() {
  var _getOutputAddresses2 = this._getOutputAddresses(),
      _getOutputAddresses3 = (0, _slicedToArray3.default)(_getOutputAddresses2, 1),
      addrs = _getOutputAddresses3[0];

  return addrs;
};

/**
 * Get all addresses.
 * @param {CoinView|null} view
 * @returns {Address[]} addresses
 */

TX.prototype.getAddresses = function getAddresses(view) {
  var _getAddresses2 = this._getAddresses(view),
      _getAddresses3 = (0, _slicedToArray3.default)(_getAddresses2, 1),
      addrs = _getAddresses3[0];

  return addrs;
};

/**
 * Get all input address hashes.
 * @param {CoinView|null} view
 * @returns {Hash[]} hashes
 */

TX.prototype.getInputHashes = function getInputHashes(view, enc) {
  if (enc === 'hex') {
    var _getInputAddresses6 = this._getInputAddresses(view),
        _getInputAddresses7 = (0, _slicedToArray3.default)(_getInputAddresses6, 2),
        table = _getInputAddresses7[1];

    return (0, _keys2.default)(table);
  }

  var addrs = this.getInputAddresses(view);
  var hashes = [];

  var _iteratorNormalCompletion18 = true;
  var _didIteratorError18 = false;
  var _iteratorError18 = undefined;

  try {
    for (var _iterator18 = (0, _getIterator3.default)(addrs), _step18; !(_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done); _iteratorNormalCompletion18 = true) {
      var addr = _step18.value;

      hashes.push(addr.getHash());
    }
  } catch (err) {
    _didIteratorError18 = true;
    _iteratorError18 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion18 && _iterator18.return) {
        _iterator18.return();
      }
    } finally {
      if (_didIteratorError18) {
        throw _iteratorError18;
      }
    }
  }

  return hashes;
};

/**
 * Get all output address hashes.
 * @returns {Hash[]} hashes
 */

TX.prototype.getOutputHashes = function getOutputHashes(enc) {
  if (enc === 'hex') {
    var _getOutputAddresses4 = this._getOutputAddresses(),
        _getOutputAddresses5 = (0, _slicedToArray3.default)(_getOutputAddresses4, 2),
        table = _getOutputAddresses5[1];

    return (0, _keys2.default)(table);
  }

  var addrs = this.getOutputAddresses();
  var hashes = [];

  var _iteratorNormalCompletion19 = true;
  var _didIteratorError19 = false;
  var _iteratorError19 = undefined;

  try {
    for (var _iterator19 = (0, _getIterator3.default)(addrs), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
      var addr = _step19.value;

      hashes.push(addr.getHash());
    }
  } catch (err) {
    _didIteratorError19 = true;
    _iteratorError19 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion19 && _iterator19.return) {
        _iterator19.return();
      }
    } finally {
      if (_didIteratorError19) {
        throw _iteratorError19;
      }
    }
  }

  return hashes;
};

/**
 * Get all address hashes.
 * @param {CoinView|null} view
 * @returns {Hash[]} hashes
 */

TX.prototype.getHashes = function getHashes(view, enc) {
  if (enc === 'hex') {
    var _getAddresses4 = this._getAddresses(view),
        _getAddresses5 = (0, _slicedToArray3.default)(_getAddresses4, 2),
        table = _getAddresses5[1];

    return (0, _keys2.default)(table);
  }

  var addrs = this.getAddresses(view);
  var hashes = [];

  var _iteratorNormalCompletion20 = true;
  var _didIteratorError20 = false;
  var _iteratorError20 = undefined;

  try {
    for (var _iterator20 = (0, _getIterator3.default)(addrs), _step20; !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
      var addr = _step20.value;

      hashes.push(addr.getHash());
    }
  } catch (err) {
    _didIteratorError20 = true;
    _iteratorError20 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion20 && _iterator20.return) {
        _iterator20.return();
      }
    } finally {
      if (_didIteratorError20) {
        throw _iteratorError20;
      }
    }
  }

  return hashes;
};

/**
 * Test whether the transaction has
 * all coins available.
 * @param {CoinView} view
 * @returns {Boolean}
 */

TX.prototype.hasCoins = function hasCoins(view) {
  if (this.inputs.length === 0) return false;

  var _iteratorNormalCompletion21 = true;
  var _didIteratorError21 = false;
  var _iteratorError21 = undefined;

  try {
    for (var _iterator21 = (0, _getIterator3.default)(this.inputs), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
      var _ref6 = _step21.value;
      var prevout = _ref6.prevout;

      if (!view.hasEntry(prevout)) return false;
    }
  } catch (err) {
    _didIteratorError21 = true;
    _iteratorError21 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion21 && _iterator21.return) {
        _iterator21.return();
      }
    } finally {
      if (_didIteratorError21) {
        throw _iteratorError21;
      }
    }
  }

  return true;
};

/**
 * Check finality of transaction by examining
 * nLocktime and nSequence values.
 * @example
 * tx.isFinal(chain.height + 1, network.now());
 * @param {Number} height - Height at which to test. This
 * is usually the chain height, or the chain height + 1
 * when the transaction entered the mempool.
 * @param {Number} time - Time at which to test. This is
 * usually the chain tip's parent's median time, or the
 * time at which the transaction entered the mempool. If
 * MEDIAN_TIME_PAST is enabled this will be the median
 * time of the chain tip's previous entry's median time.
 * @returns {Boolean}
 */

TX.prototype.isFinal = function isFinal(height, time) {
  var THRESHOLD = consensus.LOCKTIME_THRESHOLD;

  if (this.locktime === 0) return true;

  if (this.locktime < (this.locktime < THRESHOLD ? height : time)) return true;

  var _iteratorNormalCompletion22 = true;
  var _didIteratorError22 = false;
  var _iteratorError22 = undefined;

  try {
    for (var _iterator22 = (0, _getIterator3.default)(this.inputs), _step22; !(_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done); _iteratorNormalCompletion22 = true) {
      var input = _step22.value;

      if (input.sequence !== 0xffffffff) return false;
    }
  } catch (err) {
    _didIteratorError22 = true;
    _iteratorError22 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion22 && _iterator22.return) {
        _iterator22.return();
      }
    } finally {
      if (_didIteratorError22) {
        throw _iteratorError22;
      }
    }
  }

  return true;
};

/**
 * Verify the absolute locktime of a transaction.
 * Called by OP_CHECKLOCKTIMEVERIFY.
 * @param {Number} index - Index of input being verified.
 * @param {Number} predicate - Locktime to verify against.
 * @returns {Boolean}
 */

TX.prototype.verifyLocktime = function verifyLocktime(index, predicate) {
  var THRESHOLD = consensus.LOCKTIME_THRESHOLD;
  var input = this.inputs[index];

  assert(input, 'Input does not exist.');
  assert(predicate >= 0, 'Locktime must be non-negative.');

  // Locktimes must be of the same type (blocks or seconds).
  if (this.locktime < THRESHOLD !== predicate < THRESHOLD) return false;

  if (predicate > this.locktime) return false;

  if (input.sequence === 0xffffffff) return false;

  return true;
};

/**
 * Verify the relative locktime of an input.
 * Called by OP_CHECKSEQUENCEVERIFY.
 * @param {Number} index - Index of input being verified.
 * @param {Number} predicate - Relative locktime to verify against.
 * @returns {Boolean}
 */

TX.prototype.verifySequence = function verifySequence(index, predicate) {
  var DISABLE_FLAG = consensus.SEQUENCE_DISABLE_FLAG;
  var TYPE_FLAG = consensus.SEQUENCE_TYPE_FLAG;
  var MASK = consensus.SEQUENCE_MASK;
  var input = this.inputs[index];

  assert(input, 'Input does not exist.');
  assert(predicate >= 0, 'Locktime must be non-negative.');

  // For future softfork capability.
  if (predicate & DISABLE_FLAG) return true;

  // Version must be >=2.
  if (this.version < 2) return false;

  // Cannot use the disable flag without
  // the predicate also having the disable
  // flag (for future softfork capability).
  if (input.sequence & DISABLE_FLAG) return false;

  // Locktimes must be of the same type (blocks or seconds).
  if ((input.sequence & TYPE_FLAG) !== (predicate & TYPE_FLAG)) return false;

  if ((predicate & MASK) > (input.sequence & MASK)) return false;

  return true;
};

/**
 * Calculate legacy (inaccurate) sigop count.
 * @returns {Number} sigop count
 */

TX.prototype.getLegacySigops = function getLegacySigops() {
  if (this._sigops !== -1) return this._sigops;

  var total = 0;

  var _iteratorNormalCompletion23 = true;
  var _didIteratorError23 = false;
  var _iteratorError23 = undefined;

  try {
    for (var _iterator23 = (0, _getIterator3.default)(this.inputs), _step23; !(_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done); _iteratorNormalCompletion23 = true) {
      var input = _step23.value;

      total += input.script.getSigops(false);
    }
  } catch (err) {
    _didIteratorError23 = true;
    _iteratorError23 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion23 && _iterator23.return) {
        _iterator23.return();
      }
    } finally {
      if (_didIteratorError23) {
        throw _iteratorError23;
      }
    }
  }

  var _iteratorNormalCompletion24 = true;
  var _didIteratorError24 = false;
  var _iteratorError24 = undefined;

  try {
    for (var _iterator24 = (0, _getIterator3.default)(this.outputs), _step24; !(_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done); _iteratorNormalCompletion24 = true) {
      var output = _step24.value;

      total += output.script.getSigops(false);
    }
  } catch (err) {
    _didIteratorError24 = true;
    _iteratorError24 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion24 && _iterator24.return) {
        _iterator24.return();
      }
    } finally {
      if (_didIteratorError24) {
        throw _iteratorError24;
      }
    }
  }

  if (!this.mutable) this._sigops = total;

  return total;
};

/**
 * Calculate accurate sigop count, taking into account redeem scripts.
 * @param {CoinView} view
 * @returns {Number} sigop count
 */

TX.prototype.getScripthashSigops = function getScripthashSigops(view) {
  if (this.isCoinbase()) return 0;

  var total = 0;

  var _iteratorNormalCompletion25 = true;
  var _didIteratorError25 = false;
  var _iteratorError25 = undefined;

  try {
    for (var _iterator25 = (0, _getIterator3.default)(this.inputs), _step25; !(_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done); _iteratorNormalCompletion25 = true) {
      var input = _step25.value;

      var coin = view.getOutputFor(input);

      if (!coin) continue;

      if (!coin.script.isScripthash()) continue;

      total += coin.script.getScripthashSigops(input.script);
    }
  } catch (err) {
    _didIteratorError25 = true;
    _iteratorError25 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion25 && _iterator25.return) {
        _iterator25.return();
      }
    } finally {
      if (_didIteratorError25) {
        throw _iteratorError25;
      }
    }
  }

  return total;
};

/**
 * Calculate accurate sigop count, taking into account redeem scripts.
 * @param {CoinView} view
 * @returns {Number} sigop count
 */

TX.prototype.getWitnessSigops = function getWitnessSigops(view) {
  if (this.isCoinbase()) return 0;

  var total = 0;

  var _iteratorNormalCompletion26 = true;
  var _didIteratorError26 = false;
  var _iteratorError26 = undefined;

  try {
    for (var _iterator26 = (0, _getIterator3.default)(this.inputs), _step26; !(_iteratorNormalCompletion26 = (_step26 = _iterator26.next()).done); _iteratorNormalCompletion26 = true) {
      var input = _step26.value;

      var coin = view.getOutputFor(input);

      if (!coin) continue;

      total += coin.script.getWitnessSigops(input.script, input.witness);
    }
  } catch (err) {
    _didIteratorError26 = true;
    _iteratorError26 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion26 && _iterator26.return) {
        _iterator26.return();
      }
    } finally {
      if (_didIteratorError26) {
        throw _iteratorError26;
      }
    }
  }

  return total;
};

/**
 * Calculate sigops cost, taking into account witness programs.
 * @param {CoinView} view
 * @param {VerifyFlags?} flags
 * @returns {Number} sigop weight
 */

TX.prototype.getSigopsCost = function getSigopsCost(view, flags) {
  if (flags == null) flags = Script.flags.STANDARD_VERIFY_FLAGS;

  var scale = consensus.WITNESS_SCALE_FACTOR;

  var cost = this.getLegacySigops() * scale;

  if (flags & Script.flags.VERIFY_P2SH) cost += this.getScripthashSigops(view) * scale;

  if (flags & Script.flags.VERIFY_WITNESS) cost += this.getWitnessSigops(view);

  return cost;
};

/**
 * Calculate virtual sigop count.
 * @param {CoinView} view
 * @param {VerifyFlags?} flags
 * @returns {Number} sigop count
 */

TX.prototype.getSigops = function getSigops(view, flags) {
  var scale = consensus.WITNESS_SCALE_FACTOR;
  return (this.getSigopsCost(view, flags) + scale - 1) / scale | 0;
};

/**
 * Non-contextual sanity checks for the transaction.
 * Will mostly verify coin and output values.
 * @see CheckTransaction()
 * @returns {Array} [result, reason, score]
 */

TX.prototype.isSane = function isSane() {
  var _checkSanity = this.checkSanity(),
      _checkSanity2 = (0, _slicedToArray3.default)(_checkSanity, 1),
      valid = _checkSanity2[0];

  return valid;
};

/**
 * Non-contextual sanity checks for the transaction.
 * Will mostly verify coin and output values.
 * @see CheckTransaction()
 * @returns {Array} [valid, reason, score]
 */

TX.prototype.checkSanity = function checkSanity() {
  if (this.inputs.length === 0) return [false, 'bad-txns-vin-empty', 100];

  if (this.outputs.length === 0) return [false, 'bad-txns-vout-empty', 100];

  if (this.getBaseSize() > consensus.MAX_BLOCK_SIZE) return [false, 'bad-txns-oversize', 100];

  var total = 0;

  var _iteratorNormalCompletion27 = true;
  var _didIteratorError27 = false;
  var _iteratorError27 = undefined;

  try {
    for (var _iterator27 = (0, _getIterator3.default)(this.outputs), _step27; !(_iteratorNormalCompletion27 = (_step27 = _iterator27.next()).done); _iteratorNormalCompletion27 = true) {
      var output = _step27.value;

      if (output.value < 0) return [false, 'bad-txns-vout-negative', 100];

      if (output.value > consensus.MAX_MONEY) return [false, 'bad-txns-vout-toolarge', 100];

      total += output.value;

      if (total < 0 || total > consensus.MAX_MONEY) return [false, 'bad-txns-txouttotal-toolarge', 100];
    }
  } catch (err) {
    _didIteratorError27 = true;
    _iteratorError27 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion27 && _iterator27.return) {
        _iterator27.return();
      }
    } finally {
      if (_didIteratorError27) {
        throw _iteratorError27;
      }
    }
  }

  var prevout = new _set2.default();

  var _iteratorNormalCompletion28 = true;
  var _didIteratorError28 = false;
  var _iteratorError28 = undefined;

  try {
    for (var _iterator28 = (0, _getIterator3.default)(this.inputs), _step28; !(_iteratorNormalCompletion28 = (_step28 = _iterator28.next()).done); _iteratorNormalCompletion28 = true) {
      var input = _step28.value;

      var key = input.prevout.toKey();

      if (prevout.has(key)) return [false, 'bad-txns-inputs-duplicate', 100];

      prevout.add(key);
    }
  } catch (err) {
    _didIteratorError28 = true;
    _iteratorError28 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion28 && _iterator28.return) {
        _iterator28.return();
      }
    } finally {
      if (_didIteratorError28) {
        throw _iteratorError28;
      }
    }
  }

  if (this.isCoinbase()) {
    var size = this.inputs[0].script.getSize();
    if (size < 2 || size > 100) return [false, 'bad-cb-length', 100];
  } else {
    var _iteratorNormalCompletion29 = true;
    var _didIteratorError29 = false;
    var _iteratorError29 = undefined;

    try {
      for (var _iterator29 = (0, _getIterator3.default)(this.inputs), _step29; !(_iteratorNormalCompletion29 = (_step29 = _iterator29.next()).done); _iteratorNormalCompletion29 = true) {
        var _input4 = _step29.value;

        if (_input4.prevout.isNull()) return [false, 'bad-txns-prevout-null', 10];
      }
    } catch (err) {
      _didIteratorError29 = true;
      _iteratorError29 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion29 && _iterator29.return) {
          _iterator29.return();
        }
      } finally {
        if (_didIteratorError29) {
          throw _iteratorError29;
        }
      }
    }
  }

  return [true, 'valid', 0];
};

/**
 * Non-contextual checks to determine whether the
 * transaction has all standard output script
 * types and standard input script size with only
 * pushdatas in the code.
 * Will mostly verify coin and output values.
 * @see IsStandardTx()
 * @returns {Array} [valid, reason, score]
 */

TX.prototype.isStandard = function isStandard() {
  var _checkStandard = this.checkStandard(),
      _checkStandard2 = (0, _slicedToArray3.default)(_checkStandard, 1),
      valid = _checkStandard2[0];

  return valid;
};

/**
 * Non-contextual checks to determine whether the
 * transaction has all standard output script
 * types and standard input script size with only
 * pushdatas in the code.
 * Will mostly verify coin and output values.
 * @see IsStandardTx()
 * @returns {Array} [valid, reason, score]
 */

TX.prototype.checkStandard = function checkStandard() {
  if (this.version < 1 || this.version > policy.MAX_TX_VERSION) return [false, 'version', 0];

  if (this.getWeight() >= policy.MAX_TX_WEIGHT) return [false, 'tx-size', 0];

  var _iteratorNormalCompletion30 = true;
  var _didIteratorError30 = false;
  var _iteratorError30 = undefined;

  try {
    for (var _iterator30 = (0, _getIterator3.default)(this.inputs), _step30; !(_iteratorNormalCompletion30 = (_step30 = _iterator30.next()).done); _iteratorNormalCompletion30 = true) {
      var input = _step30.value;

      if (input.script.getSize() > 1650) return [false, 'scriptsig-size', 0];

      if (!input.script.isPushOnly()) return [false, 'scriptsig-not-pushonly', 0];
    }
  } catch (err) {
    _didIteratorError30 = true;
    _iteratorError30 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion30 && _iterator30.return) {
        _iterator30.return();
      }
    } finally {
      if (_didIteratorError30) {
        throw _iteratorError30;
      }
    }
  }

  var nulldata = 0;

  var _iteratorNormalCompletion31 = true;
  var _didIteratorError31 = false;
  var _iteratorError31 = undefined;

  try {
    for (var _iterator31 = (0, _getIterator3.default)(this.outputs), _step31; !(_iteratorNormalCompletion31 = (_step31 = _iterator31.next()).done); _iteratorNormalCompletion31 = true) {
      var output = _step31.value;

      if (!output.script.isStandard()) return [false, 'scriptpubkey', 0];

      if (output.script.isNulldata()) {
        nulldata++;
        continue;
      }

      if (output.script.isMultisig() && !policy.BARE_MULTISIG) return [false, 'bare-multisig', 0];

      if (output.isDust(policy.MIN_RELAY)) return [false, 'dust', 0];
    }
  } catch (err) {
    _didIteratorError31 = true;
    _iteratorError31 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion31 && _iterator31.return) {
        _iterator31.return();
      }
    } finally {
      if (_didIteratorError31) {
        throw _iteratorError31;
      }
    }
  }

  if (nulldata > 1) return [false, 'multi-op-return', 0];

  return [true, 'valid', 0];
};

/**
 * Perform contextual checks to verify coin and input
 * script standardness (including the redeem script).
 * @see AreInputsStandard()
 * @param {CoinView} view
 * @param {VerifyFlags?} flags
 * @returns {Boolean}
 */

TX.prototype.hasStandardInputs = function hasStandardInputs(view) {
  if (this.isCoinbase()) return true;

  var _iteratorNormalCompletion32 = true;
  var _didIteratorError32 = false;
  var _iteratorError32 = undefined;

  try {
    for (var _iterator32 = (0, _getIterator3.default)(this.inputs), _step32; !(_iteratorNormalCompletion32 = (_step32 = _iterator32.next()).done); _iteratorNormalCompletion32 = true) {
      var input = _step32.value;

      var coin = view.getOutputFor(input);

      if (!coin) return false;

      if (coin.script.isPubkeyhash()) continue;

      if (coin.script.isScripthash()) {
        var redeem = input.script.getRedeem();

        if (!redeem) return false;

        if (redeem.getSigops(true) > policy.MAX_P2SH_SIGOPS) return false;

        continue;
      }

      if (coin.script.isUnknown()) return false;
    }
  } catch (err) {
    _didIteratorError32 = true;
    _iteratorError32 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion32 && _iterator32.return) {
        _iterator32.return();
      }
    } finally {
      if (_didIteratorError32) {
        throw _iteratorError32;
      }
    }
  }

  return true;
};

/**
 * Perform contextual checks to verify coin and witness standardness.
 * @see IsBadWitness()
 * @param {CoinView} view
 * @returns {Boolean}
 */

TX.prototype.hasStandardWitness = function hasStandardWitness(view) {
  if (this.isCoinbase()) return true;

  var _iteratorNormalCompletion33 = true;
  var _didIteratorError33 = false;
  var _iteratorError33 = undefined;

  try {
    for (var _iterator33 = (0, _getIterator3.default)(this.inputs), _step33; !(_iteratorNormalCompletion33 = (_step33 = _iterator33.next()).done); _iteratorNormalCompletion33 = true) {
      var input = _step33.value;

      var witness = input.witness;
      var coin = view.getOutputFor(input);

      if (!coin) continue;

      if (witness.items.length === 0) continue;

      var prev = coin.script;

      if (prev.isScripthash()) {
        prev = input.script.getRedeem();
        if (!prev) return false;
      }

      if (!prev.isProgram()) return false;

      if (prev.isWitnessPubkeyhash()) {
        if (witness.items.length !== 2) return false;

        if (witness.items[0].length > 73) return false;

        if (witness.items[1].length > 65) return false;

        continue;
      }

      if (prev.isWitnessScripthash()) {
        if (witness.items.length - 1 > policy.MAX_P2WSH_STACK) return false;

        for (var i = 0; i < witness.items.length - 1; i++) {
          var item = witness.items[i];
          if (item.length > policy.MAX_P2WSH_PUSH) return false;
        }

        var raw = witness.items[witness.items.length - 1];

        if (raw.length > policy.MAX_P2WSH_SIZE) return false;

        var redeem = Script.fromRaw(raw);

        if (redeem.isPubkey()) {
          if (witness.items.length - 1 !== 1) return false;

          if (witness.items[0].length > 73) return false;

          continue;
        }

        if (redeem.isPubkeyhash()) {
          if (input.witness.items.length - 1 !== 2) return false;

          if (witness.items[0].length > 73) return false;

          if (witness.items[1].length > 65) return false;

          continue;
        }

        var _redeem$getMultisig = redeem.getMultisig(),
            _redeem$getMultisig2 = (0, _slicedToArray3.default)(_redeem$getMultisig, 1),
            m = _redeem$getMultisig2[0];

        if (m !== -1) {
          if (witness.items.length - 1 !== m + 1) return false;

          if (witness.items[0].length !== 0) return false;

          for (var _i2 = 1; _i2 < witness.items.length - 1; _i2++) {
            var _item = witness.items[_i2];
            if (_item.length > 73) return false;
          }
        }

        continue;
      }

      if (witness.items.length > policy.MAX_P2WSH_STACK) return false;

      var _iteratorNormalCompletion34 = true;
      var _didIteratorError34 = false;
      var _iteratorError34 = undefined;

      try {
        for (var _iterator34 = (0, _getIterator3.default)(witness.items), _step34; !(_iteratorNormalCompletion34 = (_step34 = _iterator34.next()).done); _iteratorNormalCompletion34 = true) {
          var _item2 = _step34.value;

          if (_item2.length > policy.MAX_P2WSH_PUSH) return false;
        }
      } catch (err) {
        _didIteratorError34 = true;
        _iteratorError34 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion34 && _iterator34.return) {
            _iterator34.return();
          }
        } finally {
          if (_didIteratorError34) {
            throw _iteratorError34;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError33 = true;
    _iteratorError33 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion33 && _iterator33.return) {
        _iterator33.return();
      }
    } finally {
      if (_didIteratorError33) {
        throw _iteratorError33;
      }
    }
  }

  return true;
};

/**
 * Perform contextual checks to verify input, output,
 * and fee values, as well as coinbase spend maturity
 * (coinbases can only be spent 100 blocks or more
 * after they're created). Note that this function is
 * consensus critical.
 * @param {CoinView} view
 * @param {Number} height - Height at which the
 * transaction is being spent. In the mempool this is
 * the chain height plus one at the time it entered the pool.
 * @returns {Boolean}
 */

TX.prototype.verifyInputs = function verifyInputs(view, height) {
  var _checkInputs = this.checkInputs(view, height),
      _checkInputs2 = (0, _slicedToArray3.default)(_checkInputs, 1),
      fee = _checkInputs2[0];

  return fee !== -1;
};

/**
 * Perform contextual checks to verify input, output,
 * and fee values, as well as coinbase spend maturity
 * (coinbases can only be spent 100 blocks or more
 * after they're created). Note that this function is
 * consensus critical.
 * @param {CoinView} view
 * @param {Number} height - Height at which the
 * transaction is being spent. In the mempool this is
 * the chain height plus one at the time it entered the pool.
 * @returns {Array} [fee, reason, score]
 */

TX.prototype.checkInputs = function checkInputs(view, height) {
  assert(typeof height === 'number');

  var total = 0;

  var _iteratorNormalCompletion35 = true;
  var _didIteratorError35 = false;
  var _iteratorError35 = undefined;

  try {
    for (var _iterator35 = (0, _getIterator3.default)(this.inputs), _step35; !(_iteratorNormalCompletion35 = (_step35 = _iterator35.next()).done); _iteratorNormalCompletion35 = true) {
      var _ref7 = _step35.value;
      var prevout = _ref7.prevout;

      var entry = view.getEntry(prevout);

      if (!entry) return [-1, 'bad-txns-inputs-missingorspent', 0];

      if (entry.coinbase) {
        if (height - entry.height < consensus.COINBASE_MATURITY) return [-1, 'bad-txns-premature-spend-of-coinbase', 0];
      }

      var coin = view.getOutput(prevout);
      assert(coin);

      if (coin.value < 0 || coin.value > consensus.MAX_MONEY) return [-1, 'bad-txns-inputvalues-outofrange', 100];

      total += coin.value;

      if (total < 0 || total > consensus.MAX_MONEY) return [-1, 'bad-txns-inputvalues-outofrange', 100];
    }

    // Overflows already checked in `isSane()`.
  } catch (err) {
    _didIteratorError35 = true;
    _iteratorError35 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion35 && _iterator35.return) {
        _iterator35.return();
      }
    } finally {
      if (_didIteratorError35) {
        throw _iteratorError35;
      }
    }
  }

  var value = this.getOutputValue();

  if (total < value) return [-1, 'bad-txns-in-belowout', 100];

  var fee = total - value;

  if (fee < 0) return [-1, 'bad-txns-fee-negative', 100];

  if (fee > consensus.MAX_MONEY) return [-1, 'bad-txns-fee-outofrange', 100];

  return [fee, 'valid', 0];
};

/**
 * Calculate the modified size of the transaction. This
 * is used in the mempool for calculating priority.
 * @param {Number?} size - The size to modify. If not present,
 * virtual size will be used.
 * @returns {Number} Modified size.
 */

TX.prototype.getModifiedSize = function getModifiedSize(size) {
  if (size == null) size = this.getVirtualSize();

  var _iteratorNormalCompletion36 = true;
  var _didIteratorError36 = false;
  var _iteratorError36 = undefined;

  try {
    for (var _iterator36 = (0, _getIterator3.default)(this.inputs), _step36; !(_iteratorNormalCompletion36 = (_step36 = _iterator36.next()).done); _iteratorNormalCompletion36 = true) {
      var input = _step36.value;

      var offset = 41 + Math.min(110, input.script.getSize());
      if (size > offset) size -= offset;
    }
  } catch (err) {
    _didIteratorError36 = true;
    _iteratorError36 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion36 && _iterator36.return) {
        _iterator36.return();
      }
    } finally {
      if (_didIteratorError36) {
        throw _iteratorError36;
      }
    }
  }

  return size;
};

/**
 * Calculate the transaction priority.
 * @param {CoinView} view
 * @param {Number} height
 * @param {Number?} size - Size to calculate priority
 * based on. If not present, virtual size will be used.
 * @returns {Number}
 */

TX.prototype.getPriority = function getPriority(view, height, size) {
  assert(typeof height === 'number', 'Must pass in height.');

  if (this.isCoinbase()) return 0;

  if (size == null) size = this.getVirtualSize();

  var sum = 0;

  var _iteratorNormalCompletion37 = true;
  var _didIteratorError37 = false;
  var _iteratorError37 = undefined;

  try {
    for (var _iterator37 = (0, _getIterator3.default)(this.inputs), _step37; !(_iteratorNormalCompletion37 = (_step37 = _iterator37.next()).done); _iteratorNormalCompletion37 = true) {
      var _ref8 = _step37.value;
      var prevout = _ref8.prevout;

      var coin = view.getOutput(prevout);

      if (!coin) continue;

      var coinHeight = view.getHeight(prevout);

      if (coinHeight === -1) continue;

      if (coinHeight <= height) {
        var age = height - coinHeight;
        sum += coin.value * age;
      }
    }
  } catch (err) {
    _didIteratorError37 = true;
    _iteratorError37 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion37 && _iterator37.return) {
        _iterator37.return();
      }
    } finally {
      if (_didIteratorError37) {
        throw _iteratorError37;
      }
    }
  }

  return Math.floor(sum / size);
};

/**
 * Calculate the transaction's on-chain value.
 * @param {CoinView} view
 * @returns {Number}
 */

TX.prototype.getChainValue = function getChainValue(view) {
  if (this.isCoinbase()) return 0;

  var value = 0;

  var _iteratorNormalCompletion38 = true;
  var _didIteratorError38 = false;
  var _iteratorError38 = undefined;

  try {
    for (var _iterator38 = (0, _getIterator3.default)(this.inputs), _step38; !(_iteratorNormalCompletion38 = (_step38 = _iterator38.next()).done); _iteratorNormalCompletion38 = true) {
      var _ref9 = _step38.value;
      var prevout = _ref9.prevout;

      var coin = view.getOutput(prevout);

      if (!coin) continue;

      var height = view.getHeight(prevout);

      if (height === -1) continue;

      value += coin.value;
    }
  } catch (err) {
    _didIteratorError38 = true;
    _iteratorError38 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion38 && _iterator38.return) {
        _iterator38.return();
      }
    } finally {
      if (_didIteratorError38) {
        throw _iteratorError38;
      }
    }
  }

  return value;
};

/**
 * Determine whether the transaction is above the
 * free threshold in priority. A transaction which
 * passed this test is most likely relayable
 * without a fee.
 * @param {CoinView} view
 * @param {Number?} height - If not present, tx
 * height or network height will be used.
 * @param {Number?} size - If not present, modified
 * size will be calculated and used.
 * @returns {Boolean}
 */

TX.prototype.isFree = function isFree(view, height, size) {
  var priority = this.getPriority(view, height, size);
  return priority > policy.FREE_THRESHOLD;
};

/**
 * Calculate minimum fee in order for the transaction
 * to be relayable (not the constant min relay fee).
 * @param {Number?} size - If not present, max size
 * estimation will be calculated and used.
 * @param {Rate?} rate - Rate of satoshi per kB.
 * @returns {Amount} fee
 */

TX.prototype.getMinFee = function getMinFee(size, rate) {
  if (size == null) size = this.getVirtualSize();

  return policy.getMinFee(size, rate);
};

/**
 * Calculate the minimum fee in order for the transaction
 * to be relayable, but _round to the nearest kilobyte
 * when taking into account size.
 * @param {Number?} size - If not present, max size
 * estimation will be calculated and used.
 * @param {Rate?} rate - Rate of satoshi per kB.
 * @returns {Amount} fee
 */

TX.prototype.getRoundFee = function getRoundFee(size, rate) {
  if (size == null) size = this.getVirtualSize();

  return policy.getRoundFee(size, rate);
};

/**
 * Calculate the transaction's rate based on size
 * and fees. Size will be calculated if not present.
 * @param {CoinView} view
 * @param {Number?} size
 * @returns {Rate}
 */

TX.prototype.getRate = function getRate(view, size) {
  var fee = this.getFee(view);

  if (fee < 0) return 0;

  if (size == null) size = this.getVirtualSize();

  return policy.getRate(size, fee);
};

/**
 * Get all unique outpoint hashes.
 * @returns {Hash[]} Outpoint hashes.
 */

TX.prototype.getPrevout = function getPrevout() {
  if (this.isCoinbase()) return [];

  var prevout = (0, _create2.default)(null);

  var _iteratorNormalCompletion39 = true;
  var _didIteratorError39 = false;
  var _iteratorError39 = undefined;

  try {
    for (var _iterator39 = (0, _getIterator3.default)(this.inputs), _step39; !(_iteratorNormalCompletion39 = (_step39 = _iterator39.next()).done); _iteratorNormalCompletion39 = true) {
      var input = _step39.value;

      prevout[input.prevout.hash] = true;
    }
  } catch (err) {
    _didIteratorError39 = true;
    _iteratorError39 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion39 && _iterator39.return) {
        _iterator39.return();
      }
    } finally {
      if (_didIteratorError39) {
        throw _iteratorError39;
      }
    }
  }

  return (0, _keys2.default)(prevout);
};

/**
 * Test a transaction against a bloom filter using
 * the BIP37 matching algorithm. Note that this may
 * update the filter depending on what the `update`
 * value is.
 * @see "Filter matching algorithm":
 * @see https://github.com/bitcoin/bips/blob/master/bip-0037.mediawiki
 * @param {Bloom} filter
 * @returns {Boolean} True if the transaction matched.
 */

TX.prototype.isWatched = function isWatched(filter) {
  var found = false;

  // 1. Test the tx hash
  if (filter.test(this.hash())) found = true;

  // 2. Test data elements in output scripts
  //    (may need to update filter on match)
  for (var i = 0; i < this.outputs.length; i++) {
    var output = this.outputs[i];
    // Test the output script
    if (output.script.test(filter)) {
      if (filter.update === Bloom.flags.ALL) {
        var prevout = Outpoint.fromTX(this, i);
        filter.add(prevout.toRaw());
      } else if (filter.update === Bloom.flags.PUBKEY_ONLY) {
        if (output.script.isPubkey() || output.script.isMultisig()) {
          var _prevout = Outpoint.fromTX(this, i);
          filter.add(_prevout.toRaw());
        }
      }
      found = true;
    }
  }

  if (found) return found;

  // 3. Test prev_out structure
  // 4. Test data elements in input scripts
  var _iteratorNormalCompletion40 = true;
  var _didIteratorError40 = false;
  var _iteratorError40 = undefined;

  try {
    for (var _iterator40 = (0, _getIterator3.default)(this.inputs), _step40; !(_iteratorNormalCompletion40 = (_step40 = _iterator40.next()).done); _iteratorNormalCompletion40 = true) {
      var input = _step40.value;

      var _prevout2 = input.prevout;

      // Test the COutPoint structure
      if (filter.test(_prevout2.toRaw())) return true;

      // Test the input script
      if (input.script.test(filter)) return true;
    }

    // 5. No match
  } catch (err) {
    _didIteratorError40 = true;
    _iteratorError40 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion40 && _iterator40.return) {
        _iterator40.return();
      }
    } finally {
      if (_didIteratorError40) {
        throw _iteratorError40;
      }
    }
  }

  return false;
};

/**
 * Get little-endian tx hash.
 * @returns {Hash}
 */

TX.prototype.rhash = function rhash() {
  return util.revHex(this.hash('hex'));
};

/**
 * Get little-endian wtx hash.
 * @returns {Hash}
 */

TX.prototype.rwhash = function rwhash() {
  return util.revHex(this.witnessHash('hex'));
};

/**
 * Get little-endian tx hash.
 * @returns {Hash}
 */

TX.prototype.txid = function txid() {
  return this.rhash();
};

/**
 * Get little-endian wtx hash.
 * @returns {Hash}
 */

TX.prototype.wtxid = function wtxid() {
  return this.rwhash();
};

/**
 * Convert the tx to an inv item.
 * @returns {InvItem}
 */

TX.prototype.toInv = function toInv() {
  return new InvItem(InvItem.types.TX, this.hash('hex'));
};

/**
 * Inspect the transaction and return a more
 * user-friendly representation of the data.
 * @returns {Object}
 */

TX.prototype.inspect = function inspect() {
  return this.format();
};

/**
 * Inspect the transaction and return a more
 * user-friendly representation of the data.
 * @param {CoinView} view
 * @param {ChainEntry} entry
 * @param {Number} index
 * @returns {Object}
 */

TX.prototype.format = function format(view, entry, index) {
  var rate = 0;
  var fee = 0;
  var height = -1;
  var block = null;
  var time = 0;
  var date = null;

  if (view) {
    fee = this.getFee(view);
    rate = this.getRate(view);

    // Rate can exceed 53 bits in testing.
    if (!(0, _isSafeInteger2.default)(rate)) rate = 0;
  }

  if (entry) {
    height = entry.height;
    block = util.revHex(entry.hash);
    time = entry.time;
    date = util.date(time);
  }

  if (index == null) index = -1;

  return {
    hash: this.txid(),
    witnessHash: this.wtxid(),
    size: this.getSize(),
    virtualSize: this.getVirtualSize(),
    value: Amount.btc(this.getOutputValue()),
    fee: Amount.btc(fee),
    rate: Amount.btc(rate),
    minFee: Amount.btc(this.getMinFee()),
    height: height,
    block: block,
    time: time,
    date: date,
    index: index,
    version: this.version,
    inputs: this.inputs.map(function (input) {
      var coin = view ? view.getOutputFor(input) : null;
      return input.format(coin);
    }),
    outputs: this.outputs,
    locktime: this.locktime
  };
};

/**
 * Convert the transaction to an object suitable
 * for JSON serialization.
 * @returns {Object}
 */

TX.prototype.toJSON = function toJSON() {
  return this.getJSON();
};

/**
 * Convert the transaction to an object suitable
 * for JSON serialization. Note that the hashes
 * will be reversed to abide by bitcoind's legacy
 * of little-endian uint256s.
 * @param {Network} network
 * @param {CoinView} view
 * @param {ChainEntry} entry
 * @param {Number} index
 * @returns {Object}
 */

TX.prototype.getJSON = function getJSON(network, view, entry, index) {
  var rate = void 0,
      fee = void 0,
      height = void 0,
      block = void 0,
      time = void 0,
      date = void 0;

  if (view) {
    fee = this.getFee(view);
    rate = this.getRate(view);

    // Rate can exceed 53 bits in testing.
    if (!(0, _isSafeInteger2.default)(rate)) rate = 0;
  }

  if (entry) {
    height = entry.height;
    block = util.revHex(entry.hash);
    time = entry.time;
    date = util.date(time);
  }

  network = Network.get(network);

  return {
    hash: this.txid(),
    witnessHash: this.wtxid(),
    fee: fee,
    rate: rate,
    mtime: util.now(),
    height: height,
    block: block,
    time: time,
    date: date,
    index: index,
    version: this.version,
    inputs: this.inputs.map(function (input) {
      var coin = view ? view.getCoinFor(input) : null;
      return input.getJSON(network, coin);
    }),
    outputs: this.outputs.map(function (output) {
      return output.getJSON(network);
    }),
    locktime: this.locktime,
    hex: this.toRaw().toString('hex')
  };
};

/**
 * Inject properties from a json object.
 * @private
 * @param {Object} json
 */

TX.prototype.fromJSON = function fromJSON(json) {
  assert(json, 'TX data is required.');
  assert(util.isU32(json.version), 'Version must be a uint32.');
  assert(Array.isArray(json.inputs), 'Inputs must be an array.');
  assert(Array.isArray(json.outputs), 'Outputs must be an array.');
  assert(util.isU32(json.locktime), 'Locktime must be a uint32.');

  this.version = json.version;

  var _iteratorNormalCompletion41 = true;
  var _didIteratorError41 = false;
  var _iteratorError41 = undefined;

  try {
    for (var _iterator41 = (0, _getIterator3.default)(json.inputs), _step41; !(_iteratorNormalCompletion41 = (_step41 = _iterator41.next()).done); _iteratorNormalCompletion41 = true) {
      var input = _step41.value;

      this.inputs.push(Input.fromJSON(input));
    }
  } catch (err) {
    _didIteratorError41 = true;
    _iteratorError41 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion41 && _iterator41.return) {
        _iterator41.return();
      }
    } finally {
      if (_didIteratorError41) {
        throw _iteratorError41;
      }
    }
  }

  var _iteratorNormalCompletion42 = true;
  var _didIteratorError42 = false;
  var _iteratorError42 = undefined;

  try {
    for (var _iterator42 = (0, _getIterator3.default)(json.outputs), _step42; !(_iteratorNormalCompletion42 = (_step42 = _iterator42.next()).done); _iteratorNormalCompletion42 = true) {
      var output = _step42.value;

      this.outputs.push(Output.fromJSON(output));
    }
  } catch (err) {
    _didIteratorError42 = true;
    _iteratorError42 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion42 && _iterator42.return) {
        _iterator42.return();
      }
    } finally {
      if (_didIteratorError42) {
        throw _iteratorError42;
      }
    }
  }

  this.locktime = json.locktime;

  return this;
};

/**
 * Instantiate a transaction from a
 * jsonified transaction object.
 * @param {Object} json - The jsonified transaction object.
 * @returns {TX}
 */

TX.fromJSON = function fromJSON(json) {
  return new TX().fromJSON(json);
};

/**
 * Instantiate a transaction from a serialized Buffer.
 * @param {Buffer} data
 * @param {String?} enc - Encoding, can be `'hex'` or null.
 * @returns {TX}
 */

TX.fromRaw = function fromRaw(data, enc) {
  if (typeof data === 'string') data = Buffer.from(data, enc);
  return new TX().fromRaw(data);
};

/**
 * Instantiate a transaction from a buffer reader.
 * @param {BufferReader} br
 * @returns {TX}
 */

TX.fromReader = function fromReader(br) {
  return new TX().fromReader(br);
};

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 */

TX.prototype.fromRaw = function fromRaw(data) {
  return this.fromReader(new BufferReader(data));
};

/**
 * Inject properties from buffer reader.
 * @private
 * @param {BufferReader} br
 */

TX.prototype.fromReader = function fromReader(br) {
  if (hasWitnessBytes(br)) return this.fromWitnessReader(br);

  br.start();

  this.version = br.readU32();

  var inCount = br.readVarint();

  for (var i = 0; i < inCount; i++) {
    this.inputs.push(Input.fromReader(br));
  }var outCount = br.readVarint();

  for (var _i3 = 0; _i3 < outCount; _i3++) {
    this.outputs.push(Output.fromReader(br));
  }this.locktime = br.readU32();

  if (!this.mutable) {
    this._raw = br.endData();
    this._size = this._raw.length;
    this._witness = 0;
  } else {
    br.end();
  }

  return this;
};

/**
 * Inject properties from serialized
 * buffer reader (witness serialization).
 * @private
 * @param {BufferReader} br
 */

TX.prototype.fromWitnessReader = function fromWitnessReader(br) {
  br.start();

  this.version = br.readU32();

  assert(br.readU8() === 0, 'Non-zero marker.');

  var flags = br.readU8();

  assert(flags !== 0, 'Flags byte is zero.');

  var inCount = br.readVarint();

  for (var i = 0; i < inCount; i++) {
    this.inputs.push(Input.fromReader(br));
  }var outCount = br.readVarint();

  for (var _i4 = 0; _i4 < outCount; _i4++) {
    this.outputs.push(Output.fromReader(br));
  }var witness = 0;
  var hasWitness = false;

  if (flags & 1) {
    flags ^= 1;

    witness = br.offset;

    var _iteratorNormalCompletion43 = true;
    var _didIteratorError43 = false;
    var _iteratorError43 = undefined;

    try {
      for (var _iterator43 = (0, _getIterator3.default)(this.inputs), _step43; !(_iteratorNormalCompletion43 = (_step43 = _iterator43.next()).done); _iteratorNormalCompletion43 = true) {
        var input = _step43.value;

        input.witness.fromReader(br);
        if (input.witness.items.length > 0) hasWitness = true;
      }
    } catch (err) {
      _didIteratorError43 = true;
      _iteratorError43 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion43 && _iterator43.return) {
          _iterator43.return();
        }
      } finally {
        if (_didIteratorError43) {
          throw _iteratorError43;
        }
      }
    }

    witness = br.offset - witness + 2;
  }

  if (flags !== 0) throw new Error('Unknown witness flag.');

  // We'll never be able to reserialize
  // this to get the regular txid, and
  // there's no way it's valid anyway.
  if (this.inputs.length === 0 && this.outputs.length !== 0) throw new Error('Zero input witness tx.');

  this.locktime = br.readU32();

  if (!this.mutable && hasWitness) {
    this._raw = br.endData();
    this._size = this._raw.length;
    this._witness = witness;
  } else {
    br.end();
  }

  return this;
};

/**
 * Serialize transaction without witness.
 * @private
 * @returns {RawTX}
 */

TX.prototype.frameNormal = function frameNormal() {
  var raw = this.getNormalSizes();
  var bw = new StaticWriter(raw.size);
  this.writeNormal(bw);
  raw.data = bw.render();
  return raw;
};

/**
 * Serialize transaction with witness. Calculates the witness
 * size as it is framing (exposed on return value as `witness`).
 * @private
 * @returns {RawTX}
 */

TX.prototype.frameWitness = function frameWitness() {
  var raw = this.getWitnessSizes();
  var bw = new StaticWriter(raw.size);
  this.writeWitness(bw);
  raw.data = bw.render();
  return raw;
};

/**
 * Serialize transaction without witness.
 * @private
 * @param {BufferWriter} bw
 * @returns {RawTX}
 */

TX.prototype.writeNormal = function writeNormal(bw) {
  if (this.inputs.length === 0 && this.outputs.length !== 0) throw new Error('Cannot serialize zero-input tx.');

  bw.writeU32(this.version);

  bw.writeVarint(this.inputs.length);

  var _iteratorNormalCompletion44 = true;
  var _didIteratorError44 = false;
  var _iteratorError44 = undefined;

  try {
    for (var _iterator44 = (0, _getIterator3.default)(this.inputs), _step44; !(_iteratorNormalCompletion44 = (_step44 = _iterator44.next()).done); _iteratorNormalCompletion44 = true) {
      var input = _step44.value;

      input.toWriter(bw);
    }
  } catch (err) {
    _didIteratorError44 = true;
    _iteratorError44 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion44 && _iterator44.return) {
        _iterator44.return();
      }
    } finally {
      if (_didIteratorError44) {
        throw _iteratorError44;
      }
    }
  }

  bw.writeVarint(this.outputs.length);

  var _iteratorNormalCompletion45 = true;
  var _didIteratorError45 = false;
  var _iteratorError45 = undefined;

  try {
    for (var _iterator45 = (0, _getIterator3.default)(this.outputs), _step45; !(_iteratorNormalCompletion45 = (_step45 = _iterator45.next()).done); _iteratorNormalCompletion45 = true) {
      var output = _step45.value;

      output.toWriter(bw);
    }
  } catch (err) {
    _didIteratorError45 = true;
    _iteratorError45 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion45 && _iterator45.return) {
        _iterator45.return();
      }
    } finally {
      if (_didIteratorError45) {
        throw _iteratorError45;
      }
    }
  }

  bw.writeU32(this.locktime);

  return bw;
};

/**
 * Serialize transaction with witness. Calculates the witness
 * size as it is framing (exposed on return value as `witness`).
 * @private
 * @param {BufferWriter} bw
 * @returns {RawTX}
 */

TX.prototype.writeWitness = function writeWitness(bw) {
  if (this.inputs.length === 0 && this.outputs.length !== 0) throw new Error('Cannot serialize zero-input tx.');

  bw.writeU32(this.version);
  bw.writeU8(0);
  bw.writeU8(1);

  bw.writeVarint(this.inputs.length);

  var _iteratorNormalCompletion46 = true;
  var _didIteratorError46 = false;
  var _iteratorError46 = undefined;

  try {
    for (var _iterator46 = (0, _getIterator3.default)(this.inputs), _step46; !(_iteratorNormalCompletion46 = (_step46 = _iterator46.next()).done); _iteratorNormalCompletion46 = true) {
      var input = _step46.value;

      input.toWriter(bw);
    }
  } catch (err) {
    _didIteratorError46 = true;
    _iteratorError46 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion46 && _iterator46.return) {
        _iterator46.return();
      }
    } finally {
      if (_didIteratorError46) {
        throw _iteratorError46;
      }
    }
  }

  bw.writeVarint(this.outputs.length);

  var _iteratorNormalCompletion47 = true;
  var _didIteratorError47 = false;
  var _iteratorError47 = undefined;

  try {
    for (var _iterator47 = (0, _getIterator3.default)(this.outputs), _step47; !(_iteratorNormalCompletion47 = (_step47 = _iterator47.next()).done); _iteratorNormalCompletion47 = true) {
      var output = _step47.value;

      output.toWriter(bw);
    }
  } catch (err) {
    _didIteratorError47 = true;
    _iteratorError47 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion47 && _iterator47.return) {
        _iterator47.return();
      }
    } finally {
      if (_didIteratorError47) {
        throw _iteratorError47;
      }
    }
  }

  var start = bw.offset;

  var _iteratorNormalCompletion48 = true;
  var _didIteratorError48 = false;
  var _iteratorError48 = undefined;

  try {
    for (var _iterator48 = (0, _getIterator3.default)(this.inputs), _step48; !(_iteratorNormalCompletion48 = (_step48 = _iterator48.next()).done); _iteratorNormalCompletion48 = true) {
      var _input5 = _step48.value;

      _input5.witness.toWriter(bw);
    }
  } catch (err) {
    _didIteratorError48 = true;
    _iteratorError48 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion48 && _iterator48.return) {
        _iterator48.return();
      }
    } finally {
      if (_didIteratorError48) {
        throw _iteratorError48;
      }
    }
  }

  var witness = bw.offset - start;

  bw.writeU32(this.locktime);

  if (witness === this.inputs.length) throw new Error('Cannot serialize empty-witness tx.');

  return bw;
};

/**
 * Calculate the real size of the transaction
 * without the witness vector.
 * @returns {RawTX}
 */

TX.prototype.getNormalSizes = function getNormalSizes() {
  var base = 0;

  base += 4;

  base += encoding.sizeVarint(this.inputs.length);

  var _iteratorNormalCompletion49 = true;
  var _didIteratorError49 = false;
  var _iteratorError49 = undefined;

  try {
    for (var _iterator49 = (0, _getIterator3.default)(this.inputs), _step49; !(_iteratorNormalCompletion49 = (_step49 = _iterator49.next()).done); _iteratorNormalCompletion49 = true) {
      var input = _step49.value;

      base += input.getSize();
    }
  } catch (err) {
    _didIteratorError49 = true;
    _iteratorError49 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion49 && _iterator49.return) {
        _iterator49.return();
      }
    } finally {
      if (_didIteratorError49) {
        throw _iteratorError49;
      }
    }
  }

  base += encoding.sizeVarint(this.outputs.length);

  var _iteratorNormalCompletion50 = true;
  var _didIteratorError50 = false;
  var _iteratorError50 = undefined;

  try {
    for (var _iterator50 = (0, _getIterator3.default)(this.outputs), _step50; !(_iteratorNormalCompletion50 = (_step50 = _iterator50.next()).done); _iteratorNormalCompletion50 = true) {
      var output = _step50.value;

      base += output.getSize();
    }
  } catch (err) {
    _didIteratorError50 = true;
    _iteratorError50 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion50 && _iterator50.return) {
        _iterator50.return();
      }
    } finally {
      if (_didIteratorError50) {
        throw _iteratorError50;
      }
    }
  }

  base += 4;

  return new RawTX(base, 0);
};

/**
 * Calculate the real size of the transaction
 * with the witness included.
 * @returns {RawTX}
 */

TX.prototype.getWitnessSizes = function getWitnessSizes() {
  var base = 0;
  var witness = 0;

  base += 4;
  witness += 2;

  base += encoding.sizeVarint(this.inputs.length);

  var _iteratorNormalCompletion51 = true;
  var _didIteratorError51 = false;
  var _iteratorError51 = undefined;

  try {
    for (var _iterator51 = (0, _getIterator3.default)(this.inputs), _step51; !(_iteratorNormalCompletion51 = (_step51 = _iterator51.next()).done); _iteratorNormalCompletion51 = true) {
      var input = _step51.value;

      base += input.getSize();
      witness += input.witness.getVarSize();
    }
  } catch (err) {
    _didIteratorError51 = true;
    _iteratorError51 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion51 && _iterator51.return) {
        _iterator51.return();
      }
    } finally {
      if (_didIteratorError51) {
        throw _iteratorError51;
      }
    }
  }

  base += encoding.sizeVarint(this.outputs.length);

  var _iteratorNormalCompletion52 = true;
  var _didIteratorError52 = false;
  var _iteratorError52 = undefined;

  try {
    for (var _iterator52 = (0, _getIterator3.default)(this.outputs), _step52; !(_iteratorNormalCompletion52 = (_step52 = _iterator52.next()).done); _iteratorNormalCompletion52 = true) {
      var output = _step52.value;

      base += output.getSize();
    }
  } catch (err) {
    _didIteratorError52 = true;
    _iteratorError52 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion52 && _iterator52.return) {
        _iterator52.return();
      }
    } finally {
      if (_didIteratorError52) {
        throw _iteratorError52;
      }
    }
  }

  base += 4;

  return new RawTX(base + witness, witness);
};

/**
 * Test whether an object is a TX.
 * @param {Object} obj
 * @returns {Boolean}
 */

TX.isTX = function isTX(obj) {
  return obj instanceof TX;
};

/*
 * Helpers
 */

function hasWitnessBytes(br) {
  if (br.left() < 6) return false;

  return br.data[br.offset + 4] === 0 && br.data[br.offset + 5] !== 0;
}

function RawTX(size, witness) {
  this.data = null;
  this.size = size;
  this.witness = witness;
}

/*
 * Expose
 */

module.exports = TX;