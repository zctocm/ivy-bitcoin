/*!
 * merkleblock.js - merkleblock object for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var util = require('../utils/util');
var BufferReader = require('../utils/reader');
var StaticWriter = require('../utils/staticwriter');
var encoding = require('../utils/encoding');
var digest = require('../crypto/digest');
var consensus = require('../protocol/consensus');
var AbstractBlock = require('./abstractblock');
var Headers = require('./headers');
var DUMMY = Buffer.from([0]);

/**
 * Represents a merkle (filtered) block.
 * @alias module:primitives.MerkleBlock
 * @constructor
 * @extends AbstractBlock
 * @param {NakedBlock} options
 */

function MerkleBlock(options) {
  if (!(this instanceof MerkleBlock)) return new MerkleBlock(options);

  AbstractBlock.call(this);

  this.txs = [];
  this.hashes = [];
  this.flags = DUMMY;

  this.totalTX = 0;
  this._tree = null;

  if (options) this.fromOptions(options);
}

(0, _setPrototypeOf2.default)(MerkleBlock.prototype, AbstractBlock.prototype);

/**
 * Inject properties from options object.
 * @private
 * @param {NakedBlock} options
 */

MerkleBlock.prototype.fromOptions = function fromOptions(options) {
  this.parseOptions(options);

  assert(options, 'MerkleBlock data is required.');
  assert(Array.isArray(options.hashes));
  assert(Buffer.isBuffer(options.flags));
  assert(util.isU32(options.totalTX));

  if (options.hashes) {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = (0, _getIterator3.default)(options.hashes), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var hash = _step.value;

        if (typeof hash === 'string') hash = Buffer.from(hash, 'hex');
        assert(Buffer.isBuffer(hash));
        this.hashes.push(hash);
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

  if (options.flags) {
    assert(Buffer.isBuffer(options.flags));
    this.flags = options.flags;
  }

  if (options.totalTX != null) {
    assert(util.isU32(options.totalTX));
    this.totalTX = options.totalTX;
  }

  return this;
};

/**
 * Instantiate merkle block from options object.
 * @param {NakedBlock} options
 * @returns {MerkleBlock}
 */

MerkleBlock.fromOptions = function fromOptions(data) {
  return new MerkleBlock().fromOptions(data);
};

/**
 * Clear any cached values.
 * @param {Boolean?} all - Clear transactions.
 */

MerkleBlock.prototype.refresh = function refresh(all) {
  this._refresh();
  this._tree = null;

  if (!all) return;

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(this.txs), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var tx = _step2.value;

      tx.refresh();
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
 * Test the block's _matched_ transaction vector against a hash.
 * @param {Hash} hash
 * @returns {Boolean}
 */

MerkleBlock.prototype.hasTX = function hasTX(hash) {
  return this.indexOf(hash) !== -1;
};

/**
 * Test the block's _matched_ transaction vector against a hash.
 * @param {Hash} hash
 * @returns {Number} Index.
 */

MerkleBlock.prototype.indexOf = function indexOf(hash) {
  var tree = this.getTree();
  var index = tree.map.get(hash);

  if (index == null) return -1;

  return index;
};

/**
 * Verify the partial merkletree.
 * @private
 * @returns {Boolean}
 */

MerkleBlock.prototype.verifyBody = function verifyBody() {
  var _checkBody = this.checkBody(),
      _checkBody2 = (0, _slicedToArray3.default)(_checkBody, 1),
      valid = _checkBody2[0];

  return valid;
};

/**
 * Verify the partial merkletree.
 * @private
 * @returns {Array} [valid, reason, score]
 */

MerkleBlock.prototype.checkBody = function checkBody() {
  var tree = this.getTree();

  if (tree.root !== this.merkleRoot) return [false, 'bad-txnmrklroot', 100];

  return [true, 'valid', 0];
};

/**
 * Extract the matches from partial merkle
 * tree and calculate merkle root.
 * @returns {Object}
 */

MerkleBlock.prototype.getTree = function getTree() {
  if (!this._tree) {
    try {
      this._tree = this.extractTree();
    } catch (e) {
      this._tree = new PartialTree();
    }
  }
  return this._tree;
};

/**
 * Extract the matches from partial merkle
 * tree and calculate merkle root.
 * @private
 * @returns {Object}
 */

MerkleBlock.prototype.extractTree = function extractTree() {
  var matches = [];
  var indexes = [];
  var map = new _map2.default();
  var hashes = this.hashes;
  var flags = this.flags;
  var totalTX = this.totalTX;
  var bitsUsed = 0;
  var hashUsed = 0;
  var failed = false;
  var height = 0;

  var width = function width(height) {
    return totalTX + (1 << height) - 1 >>> height;
  };

  var traverse = function traverse(height, pos) {
    if (bitsUsed >= flags.length * 8) {
      failed = true;
      return encoding.ZERO_HASH;
    }

    var parent = flags[bitsUsed / 8 | 0] >>> bitsUsed % 8 & 1;

    bitsUsed++;

    if (height === 0 || !parent) {
      if (hashUsed >= hashes.length) {
        failed = true;
        return encoding.ZERO_HASH;
      }

      var hash = hashes[hashUsed++];

      if (height === 0 && parent) {
        var txid = hash.toString('hex');
        matches.push(hash);
        indexes.push(pos);
        map.set(txid, pos);
      }

      return hash;
    }

    var left = traverse(height - 1, pos * 2);
    var right = void 0;

    if (pos * 2 + 1 < width(height - 1)) {
      right = traverse(height - 1, pos * 2 + 1);
      if (right.equals(left)) failed = true;
    } else {
      right = left;
    }

    return digest.root256(left, right);
  };

  if (totalTX === 0) throw new Error('Zero transactions.');

  if (totalTX > consensus.MAX_BLOCK_SIZE / 60) throw new Error('Too many transactions.');

  if (hashes.length > totalTX) throw new Error('Too many hashes.');

  if (flags.length * 8 < hashes.length) throw new Error('Flags too small.');

  while (width(height) > 1) {
    height++;
  }var root = traverse(height, 0);

  if (failed) throw new Error('Mutated merkle tree.');

  if (((bitsUsed + 7) / 8 | 0) !== flags.length) throw new Error('Too many flag bits.');

  if (hashUsed !== hashes.length) throw new Error('Incorrect number of hashes.');

  return new PartialTree(root, matches, indexes, map);
};

/**
 * Extract the coinbase height (always -1).
 * @returns {Number}
 */

MerkleBlock.prototype.getCoinbaseHeight = function getCoinbaseHeight() {
  return -1;
};

/**
 * Inspect the block and return a more
 * user-friendly representation of the data.
 * @returns {Object}
 */

MerkleBlock.prototype.inspect = function inspect() {
  return this.format();
};

/**
 * Inspect the block and return a more
 * user-friendly representation of the data.
 * @param {CoinView} view
 * @param {Number} height
 * @returns {Object}
 */

MerkleBlock.prototype.format = function format(view, height) {
  return {
    hash: this.rhash(),
    height: height != null ? height : -1,
    date: util.date(this.time),
    version: util.hex32(this.version),
    prevBlock: util.revHex(this.prevBlock),
    merkleRoot: util.revHex(this.merkleRoot),
    time: this.time,
    bits: this.bits,
    nonce: this.nonce,
    totalTX: this.totalTX,
    hashes: this.hashes.map(function (hash) {
      return hash.toString('hex');
    }),
    flags: this.flags,
    map: this.getTree().map,
    txs: this.txs.length
  };
};

/**
 * Get merkleblock size.
 * @returns {Number} Size.
 */

MerkleBlock.prototype.getSize = function getSize() {
  var size = 0;
  size += 80;
  size += 4;
  size += encoding.sizeVarint(this.hashes.length);
  size += this.hashes.length * 32;
  size += encoding.sizeVarint(this.flags.length);
  size += this.flags.length;
  return size;
};

/**
 * Write the merkleblock to a buffer writer.
 * @param {BufferWriter} bw
 */

MerkleBlock.prototype.toWriter = function toWriter(bw) {
  this.writeHead(bw);

  bw.writeU32(this.totalTX);

  bw.writeVarint(this.hashes.length);

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(this.hashes), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var hash = _step3.value;

      bw.writeHash(hash);
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

  bw.writeVarBytes(this.flags);

  return bw;
};

/**
 * Serialize the merkleblock.
 * @param {String?} enc - Encoding, can be `'hex'` or null.
 * @returns {Buffer|String}
 */

MerkleBlock.prototype.toRaw = function toRaw() {
  var size = this.getSize();
  return this.toWriter(new StaticWriter(size)).render();
};

/**
 * Inject properties from buffer reader.
 * @private
 * @param {BufferReader} br
 */

MerkleBlock.prototype.fromReader = function fromReader(br) {
  this.readHead(br);

  this.totalTX = br.readU32();

  var count = br.readVarint();

  for (var i = 0; i < count; i++) {
    this.hashes.push(br.readHash());
  }this.flags = br.readVarBytes();

  return this;
};

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 */

MerkleBlock.prototype.fromRaw = function fromRaw(data) {
  return this.fromReader(new BufferReader(data));
};

/**
 * Instantiate a merkleblock from a buffer reader.
 * @param {BufferReader} br
 * @returns {MerkleBlock}
 */

MerkleBlock.fromReader = function fromReader(br) {
  return new MerkleBlock().fromReader(br);
};

/**
 * Instantiate a merkleblock from a serialized data.
 * @param {Buffer} data
 * @param {String?} enc - Encoding, can be `'hex'` or null.
 * @returns {MerkleBlock}
 */

MerkleBlock.fromRaw = function fromRaw(data, enc) {
  if (typeof data === 'string') data = Buffer.from(data, enc);
  return new MerkleBlock().fromRaw(data);
};

/**
 * Convert the block to an object suitable
 * for JSON serialization.
 * @returns {Object}
 */

MerkleBlock.prototype.toJSON = function toJSON() {
  return this.getJSON();
};

/**
 * Convert the block to an object suitable
 * for JSON serialization. Note that the hashes
 * will be reversed to abide by bitcoind's legacy
 * of little-endian uint256s.
 * @param {Network} network
 * @param {CoinView} view
 * @param {Number} height
 * @returns {Object}
 */

MerkleBlock.prototype.getJSON = function getJSON(network, view, height) {
  return {
    hash: this.rhash(),
    height: height,
    version: this.version,
    prevBlock: util.revHex(this.prevBlock),
    merkleRoot: util.revHex(this.merkleRoot),
    time: this.time,
    bits: this.bits,
    nonce: this.nonce,
    totalTX: this.totalTX,
    hashes: this.hashes.map(function (hash) {
      return util.revHex(hash.toString('hex'));
    }),
    flags: this.flags.toString('hex')
  };
};

/**
 * Inject properties from json object.
 * @private
 * @param {Object} json
 */

MerkleBlock.prototype.fromJSON = function fromJSON(json) {
  assert(json, 'MerkleBlock data is required.');
  assert(Array.isArray(json.hashes));
  assert(typeof json.flags === 'string');
  assert(util.isU32(json.totalTX));

  this.parseJSON(json);

  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(json.hashes), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var hash = _step4.value;

      hash = util.revHex(hash);
      this.hashes.push(Buffer.from(hash, 'hex'));
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

  this.flags = Buffer.from(json.flags, 'hex');

  this.totalTX = json.totalTX;

  return this;
};

/**
 * Instantiate a merkle block from a jsonified block object.
 * @param {Object} json - The jsonified block object.
 * @returns {MerkleBlock}
 */

MerkleBlock.fromJSON = function fromJSON(json) {
  return new MerkleBlock().fromJSON(json);
};

/**
 * Create a merkleblock from a {@link Block} object, passing
 * it through a filter first. This will build the partial
 * merkle tree.
 * @param {Block} block
 * @param {Bloom} filter
 * @returns {MerkleBlock}
 */

MerkleBlock.fromBlock = function fromBlock(block, filter) {
  var matches = [];

  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = (0, _getIterator3.default)(block.txs), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var tx = _step5.value;

      matches.push(tx.isWatched(filter) ? 1 : 0);
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

  return MerkleBlock.fromMatches(block, matches);
};

/**
 * Create a merkleblock from an array of txids.
 * This will build the partial merkle tree.
 * @param {Block} block
 * @param {Hash[]} hashes
 * @returns {MerkleBlock}
 */

MerkleBlock.fromHashes = function fromHashes(block, hashes) {
  var filter = new _set2.default();

  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(hashes), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var hash = _step6.value;

      if (Buffer.isBuffer(hash)) hash = hash.toString('hex');
      filter.add(hash);
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

  var matches = [];

  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = (0, _getIterator3.default)(block.txs), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var tx = _step7.value;

      var _hash = tx.hash('hex');
      matches.push(filter.has(_hash) ? 1 : 0);
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

  return MerkleBlock.fromMatches(block, matches);
};

/**
 * Create a merkleblock from an array of matches.
 * This will build the partial merkle tree.
 * @param {Block} block
 * @param {Number[]} matches
 * @returns {MerkleBlock}
 */

MerkleBlock.fromMatches = function fromMatches(block, matches) {
  var txs = [];
  var leaves = [];
  var bits = [];
  var hashes = [];
  var totalTX = block.txs.length;
  var height = 0;

  var width = function width(height) {
    return totalTX + (1 << height) - 1 >>> height;
  };

  var hash = function hash(height, pos, leaves) {
    if (height === 0) return leaves[pos];

    var left = hash(height - 1, pos * 2, leaves);
    var right = void 0;

    if (pos * 2 + 1 < width(height - 1)) right = hash(height - 1, pos * 2 + 1, leaves);else right = left;

    return digest.root256(left, right);
  };

  var traverse = function traverse(height, pos, leaves, matches) {
    var parent = 0;

    for (var p = pos << height; p < pos + 1 << height && p < totalTX; p++) {
      parent |= matches[p];
    }bits.push(parent);

    if (height === 0 || !parent) {
      hashes.push(hash(height, pos, leaves));
      return;
    }

    traverse(height - 1, pos * 2, leaves, matches);

    if (pos * 2 + 1 < width(height - 1)) traverse(height - 1, pos * 2 + 1, leaves, matches);
  };

  for (var i = 0; i < block.txs.length; i++) {
    var tx = block.txs[i];

    if (matches[i]) txs.push(tx);

    leaves.push(tx.hash());
  }

  while (width(height) > 1) {
    height++;
  }traverse(height, 0, leaves, matches);

  var flags = Buffer.allocUnsafe((bits.length + 7) / 8 | 0);
  flags.fill(0);

  for (var p = 0; p < bits.length; p++) {
    flags[p / 8 | 0] |= bits[p] << p % 8;
  }var merkle = new MerkleBlock();
  merkle._hash = block._hash;
  merkle._hhash = block._hhash;
  merkle.version = block.version;
  merkle.prevBlock = block.prevBlock;
  merkle.merkleRoot = block.merkleRoot;
  merkle.time = block.time;
  merkle.bits = block.bits;
  merkle.nonce = block.nonce;
  merkle.totalTX = totalTX;
  merkle.hashes = hashes;
  merkle.flags = flags;
  merkle.txs = txs;

  return merkle;
};

/**
 * Test whether an object is a MerkleBlock.
 * @param {Object} obj
 * @returns {Boolean}
 */

MerkleBlock.isMerkleBlock = function isMerkleBlock(obj) {
  return obj instanceof MerkleBlock;
};

/**
 * Convert the block to a headers object.
 * @returns {Headers}
 */

MerkleBlock.prototype.toHeaders = function toHeaders() {
  return Headers.fromBlock(this);
};

/*
 * Helpers
 */

function PartialTree(root, matches, indexes, map) {
  this.root = root ? root.toString('hex') : encoding.NULL_HASH;
  this.matches = matches || [];
  this.indexes = indexes || [];
  this.map = map || new _map2.default();
}

/*
 * Expose
 */

module.exports = MerkleBlock;