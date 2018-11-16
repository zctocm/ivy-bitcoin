/*!
 * mtx.js - mutable transaction object for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var util = require('../utils/util');
var Script = require('../script/script');
var TX = require('./tx');
var Input = require('./input');
var Output = require('./output');
var Coin = require('./coin');
var Outpoint = require('./outpoint');
var CoinView = require('../coins/coinview');
var Address = require('./address');
var encoding = require('../utils/encoding');
var consensus = require('../protocol/consensus');
var policy = require('../protocol/policy');
var Amount = require('../btc/amount');
var Stack = require('../script/stack');

/**
 * A mutable transaction object.
 * @alias module:primitives.MTX
 * @extends TX
 * @constructor
 * @param {Object} options
 * @param {Number?} options.version
 * @param {Number?} options.changeIndex
 * @param {Input[]?} options.inputs
 * @param {Output[]?} options.outputs
 * @property {Number} version - Transaction version.
 * @property {Number} flag - Flag field for segregated witness.
 * Always non-zero (1 if not present).
 * @property {Input[]} inputs
 * @property {Output[]} outputs
 * @property {Number} locktime - nLockTime
 * @property {CoinView} view
 */

function MTX(options) {
  if (!(this instanceof MTX)) return new MTX(options);

  TX.call(this);

  this.mutable = true;
  this.changeIndex = -1;
  this.view = new CoinView();

  if (options) this.fromOptions(options);
}

(0, _setPrototypeOf2.default)(MTX.prototype, TX.prototype);

/**
 * Inject properties from options object.
 * @private
 * @param {Object} options
 */

MTX.prototype.fromOptions = function fromOptions(options) {
  if (options.version != null) {
    assert(util.isU32(options.version), 'Version must a be uint32.');
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

        this.addInput(input);
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

        this.addOutput(output);
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

  if (options.changeIndex != null) {
    if (options.changeIndex !== -1) {
      assert(util.isU32(options.changeIndex), 'Change index must be a uint32.');
      this.changeIndex = options.changeIndex;
    } else {
      this.changeIndex = -1;
    }
  }

  return this;
};

/**
 * Instantiate MTX from options.
 * @param {Object} options
 * @returns {MTX}
 */

MTX.fromOptions = function fromOptions(options) {
  return new MTX().fromOptions(options);
};

/**
 * Clone the transaction. Note that
 * this will not carry over the view.
 * @returns {MTX}
 */

MTX.prototype.clone = function clone() {
  var mtx = new MTX();
  mtx.inject(this);
  mtx.changeIndex = this.changeIndex;
  return mtx;
};

/**
 * Add an input to the transaction.
 * @param {Input|Object} options
 * @returns {Input}
 *
 * @example
 * mtx.addInput({ prevout: { hash: ... }, script: ... });
 * mtx.addInput(new Input());
 */

MTX.prototype.addInput = function addInput(options) {
  var input = Input.fromOptions(options);
  this.inputs.push(input);
  return input;
};

/**
 * Add an outpoint as an input.
 * @param {Outpoint|Object} outpoint
 * @returns {Input}
 *
 * @example
 * mtx.addOutpoint({ hash: ..., index: 0 });
 * mtx.addOutpoint(new Outpoint(hash, index));
 */

MTX.prototype.addOutpoint = function addOutpoint(outpoint) {
  var prevout = Outpoint.fromOptions(outpoint);
  var input = Input.fromOutpoint(prevout);
  this.inputs.push(input);
  return input;
};

/**
 * Add a coin as an input. Note that this will
 * add the coin to the internal coin viewpoint.
 * @param {Coin} coin
 * @returns {Input}
 *
 * @example
 * mtx.addCoin(Coin.fromTX(tx, 0, -1));
 */

MTX.prototype.addCoin = function addCoin(coin) {
  assert(coin instanceof Coin, 'Cannot add non-coin.');

  var input = Input.fromCoin(coin);

  this.inputs.push(input);
  this.view.addCoin(coin);

  return input;
};

/**
 * Add a transaction as an input. Note that
 * this will add the coin to the internal
 * coin viewpoint.
 * @param {TX} tx
 * @param {Number} index
 * @param {Number?} height
 * @returns {Input}
 *
 * @example
 * mtx.addTX(tx, 0);
 */

MTX.prototype.addTX = function addTX(tx, index, height) {
  assert(tx instanceof TX, 'Cannot add non-transaction.');

  if (height == null) height = -1;

  var input = Input.fromTX(tx, index);

  this.inputs.push(input);

  this.view.addIndex(tx, index, height);

  return input;
};

/**
 * Add an output.
 * @param {Address|Script|Output|Object} script - Script or output options.
 * @param {Amount?} value
 * @returns {Output}
 *
 * @example
 * mtx.addOutput(new Output());
 * mtx.addOutput({ address: ..., value: 100000 });
 * mtx.addOutput(address, 100000);
 * mtx.addOutput(script, 100000);
 */

MTX.prototype.addOutput = function addOutput(script, value) {
  var output = void 0;

  if (value != null) {
    assert(util.isU64(value), 'Value must be a uint64.');
    output = Output.fromScript(script, value);
  } else {
    output = Output.fromOptions(script);
  }

  this.outputs.push(output);

  return output;
};

/**
 * Verify all transaction inputs.
 * @param {VerifyFlags} [flags=STANDARD_VERIFY_FLAGS]
 * @returns {Boolean} Whether the inputs are valid.
 * @throws {ScriptError} on invalid inputs
 */

MTX.prototype.check = function check(flags) {
  return TX.prototype.check.call(this, this.view, flags);
};

/**
 * Verify the transaction inputs on the worker pool
 * (if workers are enabled).
 * @param {VerifyFlags?} [flags=STANDARD_VERIFY_FLAGS]
 * @param {WorkerPool?} pool
 * @returns {Promise}
 */

MTX.prototype.checkAsync = function checkAsync(flags, pool) {
  return TX.prototype.checkAsync.call(this, this.view, flags, pool);
};

/**
 * Verify all transaction inputs.
 * @param {VerifyFlags} [flags=STANDARD_VERIFY_FLAGS]
 * @returns {Boolean} Whether the inputs are valid.
 */

MTX.prototype.verify = function verify(flags) {
  try {
    this.check(flags);
  } catch (e) {
    if (e.type === 'ScriptError') return false;
    throw e;
  }
  return true;
};

/**
 * Verify the transaction inputs on the worker pool
 * (if workers are enabled).
 * @param {VerifyFlags?} [flags=STANDARD_VERIFY_FLAGS]
 * @param {WorkerPool?} pool
 * @returns {Promise}
 */

MTX.prototype.verifyAsync = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(flags, pool) {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;
            _context.next = 3;
            return this.checkAsync(flags, pool);

          case 3:
            _context.next = 10;
            break;

          case 5:
            _context.prev = 5;
            _context.t0 = _context['catch'](0);

            if (!(_context.t0.type === 'ScriptError')) {
              _context.next = 9;
              break;
            }

            return _context.abrupt('return', false);

          case 9:
            throw _context.t0;

          case 10:
            return _context.abrupt('return', true);

          case 11:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[0, 5]]);
  }));

  function verifyAsync(_x, _x2) {
    return _ref.apply(this, arguments);
  }

  return verifyAsync;
}();

/**
 * Calculate the fee for the transaction.
 * @returns {Amount} fee (zero if not all coins are available).
 */

MTX.prototype.getFee = function getFee() {
  return TX.prototype.getFee.call(this, this.view);
};

/**
 * Calculate the total input value.
 * @returns {Amount} value
 */

MTX.prototype.getInputValue = function getInputValue() {
  return TX.prototype.getInputValue.call(this, this.view);
};

/**
 * Get all input addresses.
 * @returns {Address[]} addresses
 */

MTX.prototype.getInputAddresses = function getInputAddresses() {
  return TX.prototype.getInputAddresses.call(this, this.view);
};

/**
 * Get all addresses.
 * @returns {Address[]} addresses
 */

MTX.prototype.getAddresses = function getAddresses() {
  return TX.prototype.getAddresses.call(this, this.view);
};

/**
 * Get all input address hashes.
 * @returns {Hash[]} hashes
 */

MTX.prototype.getInputHashes = function getInputHashes(enc) {
  return TX.prototype.getInputHashes.call(this, this.view, enc);
};

/**
 * Get all address hashes.
 * @returns {Hash[]} hashes
 */

MTX.prototype.getHashes = function getHashes(enc) {
  return TX.prototype.getHashes.call(this, this.view, enc);
};

/**
 * Test whether the transaction has
 * all coins available/filled.
 * @returns {Boolean}
 */

MTX.prototype.hasCoins = function hasCoins() {
  return TX.prototype.hasCoins.call(this, this.view);
};

/**
 * Calculate virtual sigop count.
 * @param {VerifyFlags?} flags
 * @returns {Number} sigop count
 */

MTX.prototype.getSigops = function getSigops(flags) {
  return TX.prototype.getSigops.call(this, this.view, flags);
};

/**
 * Calculate sigops weight, taking into account witness programs.
 * @param {VerifyFlags?} flags
 * @returns {Number} sigop weight
 */

MTX.prototype.getSigopsCost = function getSigopsCost(flags) {
  return TX.prototype.getSigopsCost.call(this, this.view, flags);
};

/**
 * Calculate the virtual size of the transaction
 * (weighted against bytes per sigop cost).
 * @returns {Number} vsize
 */

MTX.prototype.getSigopsSize = function getSigopsSize() {
  return TX.prototype.getSigopsSize.call(this, this.getSigopsCost());
};

/**
 * Perform contextual checks to verify input, output,
 * and fee values, as well as coinbase spend maturity
 * (coinbases can only be spent 100 blocks or more
 * after they're created). Note that this function is
 * consensus critical.
 * @param {Number} height - Height at which the
 * transaction is being spent. In the mempool this is
 * the chain height plus one at the time it entered the pool.
 * @returns {Boolean}
 */

MTX.prototype.verifyInputs = function verifyInputs(height) {
  var _checkInputs = this.checkInputs(height),
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
 * @param {Number} height - Height at which the
 * transaction is being spent. In the mempool this is
 * the chain height plus one at the time it entered the pool.
 * @returns {Array} [fee, reason, score]
 */

MTX.prototype.checkInputs = function checkInputs(height) {
  return TX.prototype.checkInputs.call(this, this.view, height);
};

/**
 * Build input script (or witness) templates (with
 * OP_0 in place of signatures).
 * @param {Number} index - Input index.
 * @param {Coin|Output} coin
 * @param {KeyRing} ring
 * @returns {Boolean} Whether the script was able to be built.
 */

MTX.prototype.scriptInput = function scriptInput(index, coin, ring) {
  var input = this.inputs[index];

  assert(input, 'Input does not exist.');
  assert(coin, 'No coin passed.');

  // Don't bother with any below calculation
  // if the output is already templated.
  if (input.script.raw.length !== 0 || input.witness.items.length !== 0) {
    return true;
  }

  // Get the previous output's script
  var prev = coin.script;

  // This is easily the hardest part about
  // building a transaction with segwit:
  // figuring out where the redeem script
  // and witness redeem scripts go.
  var sh = prev.getScripthash();

  if (sh) {
    var redeem = ring.getRedeem(sh);

    if (!redeem) return false;

    // Witness program nested in regular P2SH.
    if (redeem.isProgram()) {
      // P2WSH nested within pay-to-scripthash.
      var wsh = redeem.getWitnessScripthash();
      if (wsh) {
        var wredeem = ring.getRedeem(wsh);

        if (!wredeem) return false;

        var witness = this.scriptVector(wredeem, ring);

        if (!witness) return false;

        witness.push(wredeem.toRaw());

        input.witness.fromStack(witness);
        input.script.fromItems([redeem.toRaw()]);

        return true;
      }

      // P2WPKH nested within pay-to-scripthash.
      var wpkh = redeem.getWitnessPubkeyhash();
      if (wpkh) {
        var pkh = Script.fromPubkeyhash(wpkh);
        var _witness = this.scriptVector(pkh, ring);

        if (!_witness) return false;

        input.witness.fromStack(_witness);
        input.script.fromItems([redeem.toRaw()]);

        return true;
      }

      // Unknown witness program.
      return false;
    }

    // Regular P2SH.
    var _vector = this.scriptVector(redeem, ring);

    if (!_vector) return false;

    _vector.push(redeem.toRaw());

    input.script.fromStack(_vector);

    return true;
  }

  // Witness program.
  if (prev.isProgram()) {
    // Bare P2WSH.
    var _wsh = prev.getWitnessScripthash();
    if (_wsh) {
      var _wredeem = ring.getRedeem(_wsh);

      if (!_wredeem) return false;

      var _vector2 = this.scriptVector(_wredeem, ring);

      if (!_vector2) return false;

      _vector2.push(_wredeem.toRaw());

      input.witness.fromStack(_vector2);

      return true;
    }

    // Bare P2WPKH.
    var _wpkh = prev.getWitnessPubkeyhash();
    if (_wpkh) {
      var _pkh = Script.fromPubkeyhash(_wpkh);
      var _vector3 = this.scriptVector(_pkh, ring);

      if (!_vector3) return false;

      input.witness.fromStack(_vector3);

      return true;
    }

    // Bare... who knows?
    return false;
  }

  // Wow, a normal output! Praise be to Jengus and Gord.
  var vector = this.scriptVector(prev, ring);

  if (!vector) return false;

  input.script.fromStack(vector);

  return true;
};

/**
 * Build script for a single vector
 * based on a previous script.
 * @param {Script} prev
 * @param {Buffer} ring
 * @return {Boolean}
 */

MTX.prototype.scriptVector = function scriptVector(prev, ring) {
  // P2PK
  var pk = prev.getPubkey();
  if (pk) {
    if (!pk.equals(ring.publicKey)) return null;

    var stack = new Stack();

    stack.pushInt(0);

    return stack;
  }

  // P2PKH
  var pkh = prev.getPubkeyhash();
  if (pkh) {
    if (!pkh.equals(ring.getKeyHash())) return null;

    var _stack = new Stack();

    _stack.pushInt(0);
    _stack.pushData(ring.publicKey);

    return _stack;
  }

  // Multisig

  var _prev$getMultisig = prev.getMultisig(),
      _prev$getMultisig2 = (0, _slicedToArray3.default)(_prev$getMultisig, 2),
      n = _prev$getMultisig2[1];

  if (n !== -1) {
    if (prev.indexOf(ring.publicKey) === -1) return null;

    // Technically we should create m signature slots,
    // but we create n signature slots so we can order
    // the signatures properly.
    var _stack2 = new Stack();

    _stack2.pushInt(0);

    // Fill script with `n` signature slots.
    for (var i = 0; i < n; i++) {
      _stack2.pushInt(0);
    }return _stack2;
  }

  return null;
};

/**
 * Sign a transaction input on the worker pool
 * (if workers are enabled).
 * @param {Number} index
 * @param {Coin|Output} coin
 * @param {KeyRing} ring
 * @param {SighashType?} type
 * @param {WorkerPool?} pool
 * @returns {Promise}
 */

MTX.prototype.signInputAsync = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(index, coin, ring, type, pool) {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (pool) {
              _context2.next = 2;
              break;
            }

            return _context2.abrupt('return', this.signInput(index, coin, ring, type));

          case 2:
            _context2.next = 4;
            return pool.signInput(this, index, coin, ring, type, pool);

          case 4:
            return _context2.abrupt('return', _context2.sent);

          case 5:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function signInputAsync(_x3, _x4, _x5, _x6, _x7) {
    return _ref2.apply(this, arguments);
  }

  return signInputAsync;
}();

/**
 * Sign an input.
 * @param {Number} index - Index of input being signed.
 * @param {Coin|Output} coin
 * @param {KeyRing} ring - Private key.
 * @param {SighashType} type
 * @returns {Boolean} Whether the input was able to be signed.
 */

MTX.prototype.signInput = function signInput(index, coin, ring, type) {
  var input = this.inputs[index];
  var key = ring.privateKey;

  assert(input, 'Input does not exist.');
  assert(coin, 'No coin passed.');

  // Get the previous output's script
  var value = coin.value;
  var prev = coin.script;
  var vector = input.script;
  var version = 0;
  var redeem = false;

  // Grab regular p2sh redeem script.
  if (prev.isScripthash()) {
    prev = input.script.getRedeem();
    if (!prev) throw new Error('Input has not been templated.');
    redeem = true;
  }

  // If the output script is a witness program,
  // we have to switch the vector to the witness
  // and potentially alter the length. Note that
  // witnesses are stack items, so the `dummy`
  // _has_ to be an empty buffer (what OP_0
  // pushes onto the stack).
  if (prev.isWitnessScripthash()) {
    prev = input.witness.getRedeem();
    if (!prev) throw new Error('Input has not been templated.');
    vector = input.witness;
    redeem = true;
    version = 1;
  } else {
    var wpkh = prev.getWitnessPubkeyhash();
    if (wpkh) {
      prev = Script.fromPubkeyhash(wpkh);
      vector = input.witness;
      redeem = false;
      version = 1;
    }
  }

  // Create our signature.
  var sig = this.signature(index, prev, value, key, type, version);

  if (redeem) {
    var _stack3 = vector.toStack();
    var _redeem = _stack3.pop();

    var _result = this.signVector(prev, _stack3, sig, ring);

    if (!_result) return false;

    _result.push(_redeem);

    vector.fromStack(_result);

    return true;
  }

  var stack = vector.toStack();
  var result = this.signVector(prev, stack, sig, ring);

  if (!result) return false;

  vector.fromStack(result);

  return true;
};

/**
 * Add a signature to a vector
 * based on a previous script.
 * @param {Script} prev
 * @param {Stack} vector
 * @param {Buffer} sig
 * @param {KeyRing} ring
 * @return {Boolean}
 */

MTX.prototype.signVector = function signVector(prev, vector, sig, ring) {
  // P2PK
  var pk = prev.getPubkey();
  if (pk) {
    // Make sure the pubkey is ours.
    if (!ring.publicKey.equals(pk)) return null;

    if (vector.length === 0) throw new Error('Input has not been templated.');

    // Already signed.
    if (vector.get(0).length > 0) return vector;

    vector.set(0, sig);

    return vector;
  }

  // P2PKH
  var pkh = prev.getPubkeyhash();
  if (pkh) {
    // Make sure the pubkey hash is ours.
    if (!ring.getKeyHash().equals(pkh)) return null;

    if (vector.length !== 2) throw new Error('Input has not been templated.');

    if (vector.get(1).length === 0) throw new Error('Input has not been templated.');

    // Already signed.
    if (vector.get(0).length > 0) return vector;

    vector.set(0, sig);

    return vector;
  }

  // Multisig

  var _prev$getMultisig3 = prev.getMultisig(),
      _prev$getMultisig4 = (0, _slicedToArray3.default)(_prev$getMultisig3, 2),
      m = _prev$getMultisig4[0],
      n = _prev$getMultisig4[1];

  if (m !== -1) {
    if (vector.length < 2) throw new Error('Input has not been templated.');

    if (vector.get(0).length !== 0) throw new Error('Input has not been templated.');

    // Too many signature slots. Abort.
    if (vector.length - 1 > n) throw new Error('Input has not been templated.');

    // Count the number of current signatures.
    var total = 0;
    for (var i = 1; i < vector.length; i++) {
      var item = vector.get(i);
      if (item.length > 0) total++;
    }

    // Signatures are already finalized.
    if (total === m && vector.length - 1 === m) return vector;

    // Add some signature slots for us to use if
    // there was for some reason not enough.
    while (vector.length - 1 < n) {
      vector.pushInt(0);
    } // Grab the redeem script's keys to figure
    // out where our key should go.
    var keys = [];
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
      for (var _iterator3 = (0, _getIterator3.default)(prev.code), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
        var op = _step3.value;

        if (op.data) keys.push(op.data);
      }

      // Find the key index so we can place
      // the signature in the same index.
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

    var keyIndex = util.indexOf(keys, ring.publicKey);

    // Our public key is not in the prev_out
    // script. We tried to sign a transaction
    // that is not redeemable by us.
    if (keyIndex === -1) return null;

    // Offset key index by one to turn it into
    // "sig index". Accounts for OP_0 byte at
    // the start.
    keyIndex++;

    // Add our signature to the correct slot
    // and increment the total number of
    // signatures.
    if (keyIndex < vector.length && total < m) {
      if (vector.get(keyIndex).length === 0) {
        vector.set(keyIndex, sig);
        total++;
      }
    }

    // All signatures added. Finalize.
    if (total >= m) {
      // Remove empty slots left over.
      for (var _i = vector.length - 1; _i >= 1; _i--) {
        var _item = vector.get(_i);
        if (_item.length === 0) vector.remove(_i);
      }

      // Remove signatures which are not required.
      // This should never happen.
      while (total > m) {
        vector.pop();
        total--;
      }

      // Sanity checks.
      assert(total === m);
      assert(vector.length - 1 === m);
    }

    return vector;
  }

  return null;
};

/**
 * Test whether the transaction is fully-signed.
 * @returns {Boolean}
 */

MTX.prototype.isSigned = function isSigned() {
  for (var i = 0; i < this.inputs.length; i++) {
    var prevout = this.inputs[i].prevout;

    var coin = this.view.getOutput(prevout);

    if (!coin) return false;

    if (!this.isInputSigned(i, coin)) return false;
  }

  return true;
};

/**
 * Test whether an input is fully-signed.
 * @param {Number} index
 * @param {Coin|Output} coin
 * @returns {Boolean}
 */

MTX.prototype.isInputSigned = function isInputSigned(index, coin) {
  var input = this.inputs[index];

  assert(input, 'Input does not exist.');
  assert(coin, 'No coin passed.');

  var prev = coin.script;
  var vector = input.script;
  var redeem = false;

  // Grab redeem script if possible.
  if (prev.isScripthash()) {
    prev = input.script.getRedeem();
    if (!prev) return false;
    redeem = true;
  }

  // If the output script is a witness program,
  // we have to switch the vector to the witness
  // and potentially alter the length.
  if (prev.isWitnessScripthash()) {
    prev = input.witness.getRedeem();
    if (!prev) return false;
    vector = input.witness;
    redeem = true;
  } else {
    var wpkh = prev.getWitnessPubkeyhash();
    if (wpkh) {
      prev = Script.fromPubkeyhash(wpkh);
      vector = input.witness;
      redeem = false;
    }
  }

  var stack = vector.toStack();

  if (redeem) stack.pop();

  return this.isVectorSigned(prev, stack);
};

/**
 * Test whether a vector is fully-signed.
 * @param {Script} prev
 * @param {Stack} vector
 * @returns {Boolean}
 */

MTX.prototype.isVectorSigned = function isVectorSigned(prev, vector) {
  if (prev.isPubkey()) {
    if (vector.length !== 1) return false;

    if (vector.get(0).length === 0) return false;

    return true;
  }

  if (prev.isPubkeyhash()) {
    if (vector.length !== 2) return false;

    if (vector.get(0).length === 0) return false;

    if (vector.get(1).length === 0) return false;

    return true;
  }

  var _prev$getMultisig5 = prev.getMultisig(),
      _prev$getMultisig6 = (0, _slicedToArray3.default)(_prev$getMultisig5, 1),
      m = _prev$getMultisig6[0];

  if (m !== -1) {
    // Ensure we have the correct number
    // of required signatures.
    if (vector.length - 1 !== m) return false;

    // Ensure all members are signatures.
    for (var i = 1; i < vector.length; i++) {
      var item = vector.get(i);
      if (item.length === 0) return false;
    }

    return true;
  }

  return false;
};

/**
 * Build input scripts (or witnesses).
 * @param {KeyRing} ring - Address used to sign. The address
 * must be able to redeem the coin.
 * @returns {Number} Number of inputs templated.
 */

MTX.prototype.template = function template(ring) {
  if (Array.isArray(ring)) {
    var _total = 0;
    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
      for (var _iterator4 = (0, _getIterator3.default)(ring), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
        var key = _step4.value;

        _total += this.template(key);
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

    return _total;
  }

  var total = 0;

  for (var i = 0; i < this.inputs.length; i++) {
    var prevout = this.inputs[i].prevout;

    var coin = this.view.getOutput(prevout);

    if (!coin) continue;

    if (!ring.ownOutput(coin)) continue;

    // Build script for input
    if (!this.scriptInput(i, coin, ring)) continue;

    total++;
  }

  return total;
};

/**
 * Built input scripts (or witnesses) and sign the inputs.
 * @param {KeyRing} ring - Address used to sign. The address
 * must be able to redeem the coin.
 * @param {SighashType} type
 * @returns {Number} Number of inputs signed.
 */

MTX.prototype.sign = function sign(ring, type) {
  if (Array.isArray(ring)) {
    var _total2 = 0;
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
      for (var _iterator5 = (0, _getIterator3.default)(ring), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
        var key = _step5.value;

        _total2 += this.sign(key, type);
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

    return _total2;
  }

  assert(ring.privateKey, 'No private key available.');

  var total = 0;

  for (var i = 0; i < this.inputs.length; i++) {
    var prevout = this.inputs[i].prevout;

    var coin = this.view.getOutput(prevout);

    if (!coin) continue;

    if (!ring.ownOutput(coin)) continue;

    // Build script for input
    if (!this.scriptInput(i, coin, ring)) continue;

    // Sign input
    if (!this.signInput(i, coin, ring, type)) continue;

    total++;
  }

  return total;
};

/**
 * Sign the transaction inputs on the worker pool
 * (if workers are enabled).
 * @param {KeyRing} ring
 * @param {SighashType?} type
 * @param {WorkerPool?} pool
 * @returns {Promise}
 */

MTX.prototype.signAsync = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(ring, type, pool) {
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            if (pool) {
              _context3.next = 2;
              break;
            }

            return _context3.abrupt('return', this.sign(ring, type));

          case 2:
            _context3.next = 4;
            return pool.sign(this, ring, type);

          case 4:
            return _context3.abrupt('return', _context3.sent);

          case 5:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function signAsync(_x8, _x9, _x10) {
    return _ref3.apply(this, arguments);
  }

  return signAsync;
}();

/**
 * Estimate maximum possible size.
 * @param {Function?} estimate - Input script size estimator.
 * @returns {Number}
 */

MTX.prototype.estimateSize = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(estimate) {
    var scale, total, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, output, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, _ref5, prevout, coin, prev, _prev$getMultisig7, _prev$getMultisig8, m, size, _size, _size2, _size3;

    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            scale = consensus.WITNESS_SCALE_FACTOR;
            total = 0;

            // Calculate the size, minus the input scripts.

            total += 4;
            total += encoding.sizeVarint(this.inputs.length);
            total += this.inputs.length * 40;

            total += encoding.sizeVarint(this.outputs.length);

            _iteratorNormalCompletion6 = true;
            _didIteratorError6 = false;
            _iteratorError6 = undefined;
            _context4.prev = 9;
            for (_iterator6 = (0, _getIterator3.default)(this.outputs); !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
              output = _step6.value;

              total += output.getSize();
            }_context4.next = 17;
            break;

          case 13:
            _context4.prev = 13;
            _context4.t0 = _context4['catch'](9);
            _didIteratorError6 = true;
            _iteratorError6 = _context4.t0;

          case 17:
            _context4.prev = 17;
            _context4.prev = 18;

            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }

          case 20:
            _context4.prev = 20;

            if (!_didIteratorError6) {
              _context4.next = 23;
              break;
            }

            throw _iteratorError6;

          case 23:
            return _context4.finish(20);

          case 24:
            return _context4.finish(17);

          case 25:
            total += 4;

            // Add size for signatures and public keys
            _iteratorNormalCompletion7 = true;
            _didIteratorError7 = false;
            _iteratorError7 = undefined;
            _context4.prev = 29;
            _iterator7 = (0, _getIterator3.default)(this.inputs);

          case 31:
            if (_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done) {
              _context4.next = 86;
              break;
            }

            _ref5 = _step7.value;
            prevout = _ref5.prevout;
            coin = this.view.getOutput(prevout);

            // We're out of luck here.
            // Just assume it's a p2pkh.

            if (coin) {
              _context4.next = 38;
              break;
            }

            total += 110;
            return _context4.abrupt('continue', 83);

          case 38:

            // Previous output script.
            prev = coin.script;

            // P2PK

            if (!prev.isPubkey()) {
              _context4.next = 43;
              break;
            }

            // varint script size
            total += 1;
            // OP_PUSHDATA0 [signature]
            total += 1 + 73;
            return _context4.abrupt('continue', 83);

          case 43:
            if (!prev.isPubkeyhash()) {
              _context4.next = 48;
              break;
            }

            // varint script size
            total += 1;
            // OP_PUSHDATA0 [signature]
            total += 1 + 73;
            // OP_PUSHDATA0 [key]
            total += 1 + 33;
            return _context4.abrupt('continue', 83);

          case 48:
            _prev$getMultisig7 = prev.getMultisig(), _prev$getMultisig8 = (0, _slicedToArray3.default)(_prev$getMultisig7, 1), m = _prev$getMultisig8[0];

            if (!(m !== -1)) {
              _context4.next = 56;
              break;
            }

            size = 0;
            // Bare Multisig
            // OP_0

            size += 1;
            // OP_PUSHDATA0 [signature] ...
            size += (1 + 73) * m;
            // varint len
            size += encoding.sizeVarint(size);
            total += size;
            return _context4.abrupt('continue', 83);

          case 56:
            if (!prev.isWitnessPubkeyhash()) {
              _context4.next = 64;
              break;
            }

            _size = 0;
            // varint-items-len

            _size += 1;
            // varint-len [signature]
            _size += 1 + 73;
            // varint-len [key]
            _size += 1 + 33;
            // vsize
            _size = (_size + scale - 1) / scale | 0;
            total += _size;
            return _context4.abrupt('continue', 83);

          case 64:
            if (!estimate) {
              _context4.next = 71;
              break;
            }

            _context4.next = 67;
            return estimate(prev);

          case 67:
            _size2 = _context4.sent;

            if (!(_size2 !== -1)) {
              _context4.next = 71;
              break;
            }

            total += _size2;
            return _context4.abrupt('continue', 83);

          case 71:
            if (!prev.isScripthash()) {
              _context4.next = 75;
              break;
            }

            // varint size
            total += 1;
            // 2-of-3 multisig input
            total += 149;
            return _context4.abrupt('continue', 83);

          case 75:
            if (!prev.isWitnessScripthash()) {
              _context4.next = 82;
              break;
            }

            _size3 = 0;
            // varint-items-len

            _size3 += 1;
            // 2-of-3 multisig input
            _size3 += 149;
            // vsize
            _size3 = (_size3 + scale - 1) / scale | 0;
            total += _size3;
            return _context4.abrupt('continue', 83);

          case 82:

            // Unknown.
            total += 110;

          case 83:
            _iteratorNormalCompletion7 = true;
            _context4.next = 31;
            break;

          case 86:
            _context4.next = 92;
            break;

          case 88:
            _context4.prev = 88;
            _context4.t1 = _context4['catch'](29);
            _didIteratorError7 = true;
            _iteratorError7 = _context4.t1;

          case 92:
            _context4.prev = 92;
            _context4.prev = 93;

            if (!_iteratorNormalCompletion7 && _iterator7.return) {
              _iterator7.return();
            }

          case 95:
            _context4.prev = 95;

            if (!_didIteratorError7) {
              _context4.next = 98;
              break;
            }

            throw _iteratorError7;

          case 98:
            return _context4.finish(95);

          case 99:
            return _context4.finish(92);

          case 100:
            return _context4.abrupt('return', total);

          case 101:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[9, 13, 17, 25], [18,, 20, 24], [29, 88, 92, 100], [93,, 95, 99]]);
  }));

  function estimateSize(_x11) {
    return _ref4.apply(this, arguments);
  }

  return estimateSize;
}();

/**
 * Select necessary coins based on total output value.
 * @param {Coin[]} coins
 * @param {Object?} options
 * @returns {CoinSelection}
 * @throws on not enough funds available.
 */

MTX.prototype.selectCoins = function selectCoins(coins, options) {
  var selector = new CoinSelector(this, options);
  return selector.select(coins);
};

/**
 * Attempt to subtract a fee from a single output.
 * @param {Number} index
 * @param {Amount} fee
 */

MTX.prototype.subtractIndex = function subtractIndex(index, fee) {
  assert(typeof index === 'number');
  assert(typeof fee === 'number');

  var output = this.outputs[index];

  if (!output) throw new Error('Subtraction index does not exist.');

  if (output.value < fee + output.getDustThreshold()) throw new Error('Could not subtract fee.');

  output.value -= fee;
};

/**
 * Attempt to subtract a fee from all outputs evenly.
 * @param {Amount} fee
 */

MTX.prototype.subtractFee = function subtractFee(fee) {
  assert(typeof fee === 'number');

  var outputs = 0;

  var _iteratorNormalCompletion8 = true;
  var _didIteratorError8 = false;
  var _iteratorError8 = undefined;

  try {
    for (var _iterator8 = (0, _getIterator3.default)(this.outputs), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
      var output = _step8.value;

      // Ignore nulldatas and
      // other OP_RETURN scripts.
      if (output.script.isUnspendable()) continue;
      outputs += 1;
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

  if (outputs === 0) throw new Error('Could not subtract fee.');

  var left = fee % outputs;
  var share = (fee - left) / outputs;

  // First pass, remove even shares.
  var _iteratorNormalCompletion9 = true;
  var _didIteratorError9 = false;
  var _iteratorError9 = undefined;

  try {
    for (var _iterator9 = (0, _getIterator3.default)(this.outputs), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
      var _output = _step9.value;

      if (_output.script.isUnspendable()) continue;

      if (_output.value < share + _output.getDustThreshold()) throw new Error('Could not subtract fee.');

      _output.value -= share;
    }

    // Second pass, remove the remainder
    // for the one unlucky output.
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

  var _iteratorNormalCompletion10 = true;
  var _didIteratorError10 = false;
  var _iteratorError10 = undefined;

  try {
    for (var _iterator10 = (0, _getIterator3.default)(this.outputs), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
      var _output2 = _step10.value;

      if (_output2.script.isUnspendable()) continue;

      if (_output2.value >= left + _output2.getDustThreshold()) {
        _output2.value -= left;
        return;
      }
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

  throw new Error('Could not subtract fee.');
};

/**
 * Select coins and fill the inputs.
 * @param {Coin[]} coins
 * @param {Object} options - See {@link MTX#selectCoins} options.
 * @returns {CoinSelector}
 */

MTX.prototype.fund = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(coins, options) {
    var select, _iteratorNormalCompletion11, _didIteratorError11, _iteratorError11, _iterator11, _step11, coin, index, output;

    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            assert(options, 'Options are required.');
            assert(options.changeAddress, 'Change address is required.');
            assert(this.inputs.length === 0, 'TX is already funded.');

            // Select necessary coins.
            _context5.next = 5;
            return this.selectCoins(coins, options);

          case 5:
            select = _context5.sent;


            // Add coins to transaction.
            _iteratorNormalCompletion11 = true;
            _didIteratorError11 = false;
            _iteratorError11 = undefined;
            _context5.prev = 9;
            for (_iterator11 = (0, _getIterator3.default)(select.chosen); !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
              coin = _step11.value;

              this.addCoin(coin);
            } // Attempt to subtract fee.
            _context5.next = 17;
            break;

          case 13:
            _context5.prev = 13;
            _context5.t0 = _context5['catch'](9);
            _didIteratorError11 = true;
            _iteratorError11 = _context5.t0;

          case 17:
            _context5.prev = 17;
            _context5.prev = 18;

            if (!_iteratorNormalCompletion11 && _iterator11.return) {
              _iterator11.return();
            }

          case 20:
            _context5.prev = 20;

            if (!_didIteratorError11) {
              _context5.next = 23;
              break;
            }

            throw _iteratorError11;

          case 23:
            return _context5.finish(20);

          case 24:
            return _context5.finish(17);

          case 25:
            if (select.subtractFee) {
              index = select.subtractIndex;

              if (index !== -1) this.subtractIndex(index, select.fee);else this.subtractFee(select.fee);
            }

            // Add a change output.
            output = new Output();

            output.value = select.change;
            output.script.fromAddress(select.changeAddress);

            if (output.isDust(policy.MIN_RELAY)) {
              // Do nothing. Change is added to fee.
              this.changeIndex = -1;
              assert.strictEqual(this.getFee(), select.fee + select.change);
            } else {
              this.outputs.push(output);
              this.changeIndex = this.outputs.length - 1;
              assert.strictEqual(this.getFee(), select.fee);
            }

            return _context5.abrupt('return', select);

          case 31:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this, [[9, 13, 17, 25], [18,, 20, 24]]);
  }));

  function fund(_x12, _x13) {
    return _ref6.apply(this, arguments);
  }

  return fund;
}();

/**
 * Sort inputs and outputs according to BIP69.
 * @see https://github.com/bitcoin/bips/blob/master/bip-0069.mediawiki
 */

MTX.prototype.sortMembers = function sortMembers() {
  var changeOutput = null;

  if (this.changeIndex !== -1) {
    changeOutput = this.outputs[this.changeIndex];
    assert(changeOutput);
  }

  this.inputs.sort(sortInputs);
  this.outputs.sort(sortOutputs);

  if (this.changeIndex !== -1) {
    this.changeIndex = this.outputs.indexOf(changeOutput);
    assert(this.changeIndex !== -1);
  }
};

/**
 * Avoid fee sniping.
 * @param {Number} - Current chain height.
 * @see bitcoin/src/wallet/wallet.cpp
 */

MTX.prototype.avoidFeeSniping = function avoidFeeSniping(height) {
  assert(typeof height === 'number', 'Must pass in height.');

  if (util.random(0, 10) === 0) {
    height -= util.random(0, 100);

    if (height < 0) height = 0;
  }

  this.setLocktime(height);
};

/**
 * Set locktime and sequences appropriately.
 * @param {Number} locktime
 */

MTX.prototype.setLocktime = function setLocktime(locktime) {
  assert(util.isU32(locktime), 'Locktime must be a uint32.');
  assert(this.inputs.length > 0, 'Cannot set sequence with no inputs.');

  var _iteratorNormalCompletion12 = true;
  var _didIteratorError12 = false;
  var _iteratorError12 = undefined;

  try {
    for (var _iterator12 = (0, _getIterator3.default)(this.inputs), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
      var input = _step12.value;

      if (input.sequence === 0xffffffff) input.sequence = 0xfffffffe;
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

  this.locktime = locktime;
};

/**
 * Set sequence locktime.
 * @param {Number} index - Input index.
 * @param {Number} locktime
 * @param {Boolean?} seconds
 */

MTX.prototype.setSequence = function setSequence(index, locktime, seconds) {
  var input = this.inputs[index];

  assert(input, 'Input does not exist.');
  assert(util.isU32(locktime), 'Locktime must be a uint32.');

  this.version = 2;

  if (seconds) {
    locktime >>>= consensus.SEQUENCE_GRANULARITY;
    locktime &= consensus.SEQUENCE_MASK;
    locktime |= consensus.SEQUENCE_TYPE_FLAG;
  } else {
    locktime &= consensus.SEQUENCE_MASK;
  }

  input.sequence = locktime;
};

/**
 * Inspect the transaction.
 * @returns {Object}
 */

MTX.prototype.inspect = function inspect() {
  return this.format();
};

/**
 * Inspect the transaction.
 * @returns {Object}
 */

MTX.prototype.format = function format() {
  return TX.prototype.format.call(this, this.view);
};

/**
 * Convert transaction to JSON.
 * @returns {Object}
 */

MTX.prototype.toJSON = function toJSON() {
  return TX.prototype.getJSON.call(this, null, this.view);
};

/**
 * Convert transaction to JSON.
 * @param {Network} network
 * @returns {Object}
 */

MTX.prototype.getJSON = function getJSON(network) {
  return TX.prototype.getJSON.call(this, network, this.view);
};

/**
 * Instantiate a transaction from a
 * jsonified transaction object.
 * @param {Object} json - The jsonified transaction object.
 * @returns {MTX}
 */

MTX.fromJSON = function fromJSON(json) {
  return new MTX().fromJSON(json);
};

/**
 * Instantiate a transaction from a buffer reader.
 * @param {BufferReader} br
 * @returns {MTX}
 */

MTX.fromReader = function fromReader(br) {
  return new MTX().fromReader(br);
};

/**
 * Instantiate a transaction from a serialized Buffer.
 * @param {Buffer} data
 * @param {String?} enc - Encoding, can be `'hex'` or null.
 * @returns {MTX}
 */

MTX.fromRaw = function fromRaw(data, enc) {
  if (typeof data === 'string') data = Buffer.from(data, enc);
  return new MTX().fromRaw(data);
};

/**
 * Convert the MTX to a TX.
 * @returns {TX}
 */

MTX.prototype.toTX = function toTX() {
  return new TX().inject(this);
};

/**
 * Convert the MTX to a TX.
 * @returns {Array} [tx, view]
 */

MTX.prototype.commit = function commit() {
  return [this.toTX(), this.view];
};

/**
 * Instantiate MTX from TX.
 * @param {TX} tx
 * @returns {MTX}
 */

MTX.fromTX = function fromTX(tx) {
  return new MTX().inject(tx);
};

/**
 * Test whether an object is an MTX.
 * @param {Object} obj
 * @returns {Boolean}
 */

MTX.isMTX = function isMTX(obj) {
  return obj instanceof MTX;
};

/**
 * Coin Selector
 * @alias module:primitives.CoinSelector
 * @constructor
 * @param {TX} tx
 * @param {Object?} options
 */

function CoinSelector(tx, options) {
  if (!(this instanceof CoinSelector)) return new CoinSelector(tx, options);

  this.tx = tx.clone();
  this.coins = [];
  this.outputValue = 0;
  this.index = 0;
  this.chosen = [];
  this.change = 0;
  this.fee = CoinSelector.MIN_FEE;

  this.selection = 'value';
  this.subtractFee = false;
  this.subtractIndex = -1;
  this.height = -1;
  this.depth = -1;
  this.hardFee = -1;
  this.rate = CoinSelector.FEE_RATE;
  this.maxFee = -1;
  this.round = false;
  this.changeAddress = null;

  // Needed for size estimation.
  this.estimate = null;

  if (options) this.fromOptions(options);
}

/**
 * Default fee rate
 * for coin selection.
 * @const {Amount}
 * @default
 */

CoinSelector.FEE_RATE = 10000;

/**
 * Minimum fee to start with
 * during coin selection.
 * @const {Amount}
 * @default
 */

CoinSelector.MIN_FEE = 10000;

/**
 * Maximum fee to allow
 * after coin selection.
 * @const {Amount}
 * @default
 */

CoinSelector.MAX_FEE = consensus.COIN / 10;

/**
 * Initialize selector options.
 * @param {Object} options
 * @private
 */

CoinSelector.prototype.fromOptions = function fromOptions(options) {
  if (options.selection) {
    assert(typeof options.selection === 'string');
    this.selection = options.selection;
  }

  if (options.subtractFee != null) {
    if (typeof options.subtractFee === 'number') {
      assert(util.isInt(options.subtractFee));
      assert(options.subtractFee >= -1);
      this.subtractIndex = options.subtractFee;
      this.subtractFee = this.subtractIndex !== -1;
    } else {
      assert(typeof options.subtractFee === 'boolean');
      this.subtractFee = options.subtractFee;
    }
  }

  if (options.subtractIndex != null) {
    assert(util.isInt(options.subtractIndex));
    assert(options.subtractIndex >= -1);
    this.subtractIndex = options.subtractIndex;
    this.subtractFee = this.subtractIndex !== -1;
  }

  if (options.height != null) {
    assert(util.isInt(options.height));
    assert(options.height >= -1);
    this.height = options.height;
  }

  if (options.confirmations != null) {
    assert(util.isInt(options.confirmations));
    assert(options.confirmations >= -1);
    this.depth = options.confirmations;
  }

  if (options.depth != null) {
    assert(util.isInt(options.depth));
    assert(options.depth >= -1);
    this.depth = options.depth;
  }

  if (options.hardFee != null) {
    assert(util.isInt(options.hardFee));
    assert(options.hardFee >= -1);
    this.hardFee = options.hardFee;
  }

  if (options.rate != null) {
    assert(util.isU64(options.rate));
    this.rate = options.rate;
  }

  if (options.maxFee != null) {
    assert(util.isInt(options.maxFee));
    assert(options.maxFee >= -1);
    this.maxFee = options.maxFee;
  }

  if (options.round != null) {
    assert(typeof options.round === 'boolean');
    this.round = options.round;
  }

  if (options.changeAddress) {
    var addr = options.changeAddress;
    if (typeof addr === 'string') {
      this.changeAddress = Address.fromString(addr);
    } else {
      assert(addr instanceof Address);
      this.changeAddress = addr;
    }
  }

  if (options.estimate) {
    assert(typeof options.estimate === 'function');
    this.estimate = options.estimate;
  }

  return this;
};

/**
 * Initialize the selector with coins to select from.
 * @param {Coin[]} coins
 */

CoinSelector.prototype.init = function init(coins) {
  this.coins = coins.slice();
  this.outputValue = this.tx.getOutputValue();
  this.index = 0;
  this.chosen = [];
  this.change = 0;
  this.fee = CoinSelector.MIN_FEE;
  this.tx.inputs.length = 0;

  switch (this.selection) {
    case 'all':
    case 'random':
      this.coins.sort(sortRandom);
      break;
    case 'age':
      this.coins.sort(sortAge);
      break;
    case 'value':
      this.coins.sort(sortValue);
      break;
    default:
      throw new FundingError('Bad selection type: ' + this.selection + '.');
  }
};

/**
 * Calculate total value required.
 * @returns {Amount}
 */

CoinSelector.prototype.total = function total() {
  if (this.subtractFee) return this.outputValue;
  return this.outputValue + this.fee;
};

/**
 * Test whether the selector has
 * completely funded the transaction.
 * @returns {Boolean}
 */

CoinSelector.prototype.isFull = function isFull() {
  return this.tx.getInputValue() >= this.total();
};

/**
 * Test whether a coin is spendable
 * with regards to the options.
 * @param {Coin} coin
 * @returns {Boolean}
 */

CoinSelector.prototype.isSpendable = function isSpendable(coin) {
  if (this.height === -1) return true;

  if (coin.coinbase) {
    if (coin.height === -1) return false;

    if (this.height + 1 < coin.height + consensus.COINBASE_MATURITY) return false;

    return true;
  }

  if (this.depth === -1) return true;

  var depth = coin.getDepth(this.height);

  if (depth < this.depth) return false;

  return true;
};

/**
 * Get the current fee based on a size.
 * @param {Number} size
 * @returns {Amount}
 */

CoinSelector.prototype.getFee = function getFee(size) {
  // This is mostly here for testing.
  // i.e. A fee rounded to the nearest
  // kb is easier to predict ahead of time.
  if (this.round) {
    var _fee = policy.getRoundFee(size, this.rate);
    return Math.min(_fee, CoinSelector.MAX_FEE);
  }

  var fee = policy.getMinFee(size, this.rate);
  return Math.min(fee, CoinSelector.MAX_FEE);
};

/**
 * Fund the transaction with more
 * coins if the `output value + fee`
 * total was updated.
 */

CoinSelector.prototype.fund = function fund() {
  while (this.index < this.coins.length) {
    var coin = this.coins[this.index++];

    if (!this.isSpendable(coin)) continue;

    this.tx.addCoin(coin);
    this.chosen.push(coin);

    if (this.selection === 'all') continue;

    if (this.isFull()) break;
  }
};

/**
 * Initiate selection from `coins`.
 * @param {Coin[]} coins
 * @returns {CoinSelector}
 */

CoinSelector.prototype.select = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(coins) {
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            this.init(coins);

            if (!(this.hardFee !== -1)) {
              _context6.next = 5;
              break;
            }

            this.selectHard();
            _context6.next = 7;
            break;

          case 5:
            _context6.next = 7;
            return this.selectEstimate();

          case 7:
            if (this.isFull()) {
              _context6.next = 9;
              break;
            }

            throw new FundingError('Not enough funds.', this.tx.getInputValue(), this.total());

          case 9:

            // How much money is left after filling outputs.
            this.change = this.tx.getInputValue() - this.total();

            return _context6.abrupt('return', this);

          case 11:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function select(_x14) {
    return _ref7.apply(this, arguments);
  }

  return select;
}();

/**
 * Initialize selection based on size estimate.
 */

CoinSelector.prototype.selectEstimate = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7() {
    var change, size;
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            // Set minimum fee and do
            // an initial round of funding.
            this.fee = CoinSelector.MIN_FEE;
            this.fund();

            // Add dummy output for change.
            change = new Output();


            if (this.changeAddress) {
              change.script.fromAddress(this.changeAddress);
            } else {
              // In case we don't have a change address,
              // we use a fake p2pkh output to gauge size.
              change.script.fromPubkeyhash(encoding.ZERO_HASH160);
            }

            this.tx.outputs.push(change);

            // Keep recalculating the fee and funding
            // until we reach some sort of equilibrium.

          case 5:
            _context7.next = 7;
            return this.tx.estimateSize(this.estimate);

          case 7:
            size = _context7.sent;


            this.fee = this.getFee(size);

            if (!(this.maxFee > 0 && this.fee > this.maxFee)) {
              _context7.next = 11;
              break;
            }

            throw new FundingError('Fee is too high.');

          case 11:

            // Failed to get enough funds, add more coins.
            if (!this.isFull()) this.fund();

          case 12:
            if (!this.isFull() && this.index < this.coins.length) {
              _context7.next = 5;
              break;
            }

          case 13:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  function selectEstimate() {
    return _ref8.apply(this, arguments);
  }

  return selectEstimate;
}();

/**
 * Initiate selection based on a hard fee.
 */

CoinSelector.prototype.selectHard = function selectHard() {
  this.fee = Math.min(this.hardFee, CoinSelector.MAX_FEE);
  this.fund();
};

/**
 * An error thrown from the coin selector.
 * @constructor
 * @ignore
 * @extends Error
 * @param {String} msg
 * @param {Amount} available
 * @param {Amount} required
 * @property {String} message - Error message.
 * @property {Amount} availableFunds
 * @property {Amount} requiredFunds
 */

function FundingError(msg, available, required) {
  Error.call(this);

  this.type = 'FundingError';
  this.message = msg;
  this.availableFunds = -1;
  this.requiredFunds = -1;

  if (available != null) {
    this.message += ' (available=' + Amount.btc(available) + ',';
    this.message += ' required=' + Amount.btc(required) + ')';
    this.availableFunds = available;
    this.requiredFunds = required;
  }

  if (Error.captureStackTrace) Error.captureStackTrace(this, FundingError);
}

(0, _setPrototypeOf2.default)(FundingError.prototype, Error.prototype);

/*
 * Helpers
 */

function sortAge(a, b) {
  a = a.height === -1 ? 0x7fffffff : a.height;
  b = b.height === -1 ? 0x7fffffff : b.height;
  return a - b;
}

function sortRandom(a, b) {
  return Math.random() > 0.5 ? 1 : -1;
}

function sortValue(a, b) {
  if (a.height === -1 && b.height !== -1) return 1;

  if (a.height !== -1 && b.height === -1) return -1;

  return b.value - a.value;
}

function sortInputs(a, b) {
  return a.compare(b);
}

function sortOutputs(a, b) {
  return a.compare(b);
}

/*
 * Expose
 */

exports = MTX;
exports.MTX = MTX;
exports.Selector = CoinSelector;
exports.FundingError = FundingError;

module.exports = exports;