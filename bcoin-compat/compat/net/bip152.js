/*!
 * bip152.js - compact block object for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

/**
 * @module net/bip152
 */

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var util = require('../utils/util');
var BufferReader = require('../utils/reader');
var StaticWriter = require('../utils/staticwriter');
var encoding = require('../utils/encoding');
var consensus = require('../protocol/consensus');
var digest = require('../crypto/digest');
var siphash256 = require('../crypto/siphash').siphash256;
var AbstractBlock = require('../primitives/abstractblock');
var TX = require('../primitives/tx');
var Headers = require('../primitives/headers');
var Block = require('../primitives/block');

/**
 * Represents a compact block (bip152): `cmpctblock` packet.
 * @see https://github.com/bitcoin/bips/blob/master/bip-0152.mediawiki
 * @constructor
 * @extends AbstractBlock
 * @param {Object} options
 * @property {Buffer|null} keyNonce - Nonce for siphash key.
 * @property {Number[]} ids - Short IDs.
 * @property {Object[]} ptx - Prefilled transactions.
 * @property {TX[]} available - Available transaction vector.
 * @property {Object} idMap - Map of short ids to indexes.
 * @property {Number} count - Transactions resolved.
 * @property {Buffer|null} sipKey - Siphash key.
 */

function CompactBlock(options) {
  if (!(this instanceof CompactBlock)) return new CompactBlock(options);

  AbstractBlock.call(this);

  this.keyNonce = null;
  this.ids = [];
  this.ptx = [];

  this.available = [];
  this.idMap = new _map2.default();
  this.count = 0;
  this.sipKey = null;
  this.totalTX = 0;
  this.now = 0;

  if (options) this.fromOptions(options);
}

(0, _setPrototypeOf2.default)(CompactBlock.prototype, AbstractBlock.prototype);

/**
 * Inject properties from options object.
 * @private
 * @param {Object} options
 */

CompactBlock.prototype.fromOptions = function fromOptions(options) {
  this.parseOptions(options);

  assert(Buffer.isBuffer(options.keyNonce));
  assert(Array.isArray(options.ids));
  assert(Array.isArray(options.ptx));

  this.keyNonce = options.keyNonce;
  this.ids = options.ids;
  this.ptx = options.ptx;

  if (options.available) this.available = options.available;

  if (options.idMap) this.idMap = options.idMap;

  if (options.count) this.count = options.count;

  if (options.totalTX != null) this.totalTX = options.totalTX;

  this.sipKey = this.getKey();

  return this;
};

/**
 * Instantiate compact block from options.
 * @param {Object} options
 * @returns {CompactBlock}
 */

CompactBlock.fromOptions = function fromOptions(options) {
  return new CompactBlock().fromOptions(options);
};

/**
 * Verify the block.
 * @returns {Boolean}
 */

CompactBlock.prototype.verifyBody = function verifyBody() {
  return true;
};

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 */

CompactBlock.prototype.fromRaw = function fromRaw(data) {
  var br = new BufferReader(data);

  this.readHead(br);

  this.keyNonce = br.readBytes(8);
  this.sipKey = this.getKey();

  var idCount = br.readVarint();

  this.totalTX += idCount;

  for (var i = 0; i < idCount; i++) {
    var lo = br.readU32();
    var hi = br.readU16();
    this.ids.push(hi * 0x100000000 + lo);
  }

  var txCount = br.readVarint();

  this.totalTX += txCount;

  for (var _i = 0; _i < txCount; _i++) {
    var index = br.readVarint();

    assert(index <= 0xffff);
    assert(index < this.totalTX);

    var tx = TX.fromReader(br);

    this.ptx.push([index, tx]);
  }

  return this;
};

/**
 * Instantiate a block from serialized data.
 * @param {Buffer} data
 * @param {String?} enc
 * @returns {CompactBlock}
 */

CompactBlock.fromRaw = function fromRaw(data, enc) {
  if (typeof data === 'string') data = Buffer.from(data, enc);
  return new CompactBlock().fromRaw(data);
};

/**
 * Serialize compact block with witness data.
 * @returns {Buffer}
 */

CompactBlock.prototype.toRaw = function toRaw() {
  return this.frameRaw(true);
};

/**
 * Serialize compact block without witness data.
 * @returns {Buffer}
 */

CompactBlock.prototype.toNormal = function toNormal() {
  return this.frameRaw(false);
};

/**
 * Write serialized block to a buffer
 * writer (includes witness data).
 * @param {BufferWriter} bw
 */

CompactBlock.prototype.toWriter = function toWriter(bw) {
  return this.writeRaw(bw, true);
};

/**
 * Write serialized block to a buffer
 * writer (excludes witness data).
 * @param {BufferWriter} bw
 */

CompactBlock.prototype.toNormalWriter = function toNormalWriter(bw) {
  return this.writeRaw(bw, false);
};

/**
 * Serialize compact block.
 * @private
 * @param {Boolean} witness
 * @returns {Buffer}
 */

CompactBlock.prototype.frameRaw = function frameRaw(witness) {
  var size = this.getSize(witness);
  return this.writeRaw(new StaticWriter(size), witness).render();
};

/**
 * Calculate block serialization size.
 * @param {Boolean} witness
 * @returns {Number}
 */

CompactBlock.prototype.getSize = function getSize(witness) {
  var size = 0;

  size += 80;
  size += 8;
  size += encoding.sizeVarint(this.ids.length);
  size += this.ids.length * 6;
  size += encoding.sizeVarint(this.ptx.length);

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(this.ptx), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var _ref = _step.value;

      var _ref2 = (0, _slicedToArray3.default)(_ref, 2);

      var index = _ref2[0];
      var tx = _ref2[1];

      size += encoding.sizeVarint(index);

      if (witness) size += tx.getSize();else size += tx.getBaseSize();
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

  return size;
};

/**
 * Serialize block to buffer writer.
 * @private
 * @param {BufferWriter} bw
 * @param {Boolean} witness
 */

CompactBlock.prototype.writeRaw = function writeRaw(bw, witness) {
  this.writeHead(bw);

  bw.writeBytes(this.keyNonce);

  bw.writeVarint(this.ids.length);

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(this.ids), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var id = _step2.value;

      var lo = id % 0x100000000;
      var hi = (id - lo) / 0x100000000;
      assert(hi <= 0xffff);
      bw.writeU32(lo);
      bw.writeU16(hi);
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

  bw.writeVarint(this.ptx.length);

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(this.ptx), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var _ref3 = _step3.value;

      var _ref4 = (0, _slicedToArray3.default)(_ref3, 2);

      var index = _ref4[0];
      var tx = _ref4[1];

      bw.writeVarint(index);

      if (witness) tx.toWriter(bw);else tx.toNormalWriter(bw);
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

  return bw;
};

/**
 * Convert block to a TXRequest
 * containing missing indexes.
 * @returns {TXRequest}
 */

CompactBlock.prototype.toRequest = function toRequest() {
  return TXRequest.fromCompact(this);
};

/**
 * Attempt to fill missing transactions from mempool.
 * @param {Boolean} witness
 * @param {Mempool} mempool
 * @returns {Boolean}
 */

CompactBlock.prototype.fillMempool = function fillMempool(witness, mempool) {
  if (this.count === this.totalTX) return true;

  var set = new _set2.default();

  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(mempool.map.values()), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var _ref5 = _step4.value;
      var tx = _ref5.tx;

      var hash = tx.hash();

      if (witness) hash = tx.witnessHash();

      var id = this.sid(hash);
      var index = this.idMap.get(id);

      if (index == null) continue;

      if (set.has(index)) {
        // Siphash collision, just request it.
        this.available[index] = null;
        this.count--;
        continue;
      }

      this.available[index] = tx;
      set.add(index);
      this.count++;

      // We actually may have a siphash collision
      // here, but exit early anyway for perf.
      if (this.count === this.totalTX) return true;
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

  return false;
};

/**
 * Attempt to fill missing transactions from TXResponse.
 * @param {TXResponse} res
 * @returns {Boolean}
 */

CompactBlock.prototype.fillMissing = function fillMissing(res) {
  var offset = 0;

  for (var i = 0; i < this.available.length; i++) {
    if (this.available[i]) continue;

    if (offset >= res.txs.length) return false;

    this.available[i] = res.txs[offset++];
  }

  return offset === res.txs.length;
};

/**
 * Calculate a transaction short ID.
 * @param {Hash} hash
 * @returns {Number}
 */

CompactBlock.prototype.sid = function sid(hash) {
  if (typeof hash === 'string') hash = Buffer.from(hash, 'hex');

  var _siphash = siphash256(hash, this.sipKey),
      _siphash2 = (0, _slicedToArray3.default)(_siphash, 2),
      hi = _siphash2[0],
      lo = _siphash2[1];

  return (hi & 0xffff) * 0x100000000 + (lo >>> 0);
};

/**
 * Test whether an index is available.
 * @param {Number} index
 * @returns {Boolean}
 */

CompactBlock.prototype.hasIndex = function hasIndex(index) {
  return this.available[index] != null;
};

/**
 * Initialize the siphash key.
 * @private
 * @returns {Buffer}
 */

CompactBlock.prototype.getKey = function getKey() {
  var data = Buffer.concat([this.toHead(), this.keyNonce]);
  var hash = digest.sha256(data);
  return hash.slice(0, 16);
};

/**
 * Initialize compact block and short id map.
 * @private
 */

CompactBlock.prototype.init = function init() {
  if (this.totalTX === 0) throw new Error('Empty vectors.');

  if (this.totalTX > consensus.MAX_BLOCK_SIZE / 10) throw new Error('Compact block too big.');

  // Custom limit to avoid a hashdos.
  // Min valid tx size: (4 + 1 + 41 + 1 + 9 + 4) = 60
  // Min block header size: 81
  // Max number of transactions: (1000000 - 81) / 60 = 16665
  if (this.totalTX > (consensus.MAX_BLOCK_SIZE - 81) / 60) throw new Error('Compact block too big.');

  // No sparse arrays here, v8.
  for (var i = 0; i < this.totalTX; i++) {
    this.available.push(null);
  }var last = -1;
  var offset = 0;

  for (var _i2 = 0; _i2 < this.ptx.length; _i2++) {
    var _ptx$_i = (0, _slicedToArray3.default)(this.ptx[_i2], 2),
        index = _ptx$_i[0],
        tx = _ptx$_i[1];

    last += index + 1;
    assert(last <= 0xffff);
    assert(last <= this.ids.length + _i2);
    this.available[last] = tx;
    this.count++;
  }

  for (var _i3 = 0; _i3 < this.ids.length; _i3++) {
    var id = this.ids[_i3];

    while (this.available[_i3 + offset]) {
      offset++;
    } // Fails on siphash collision.
    if (this.idMap.has(id)) return false;

    this.idMap.set(id, _i3 + offset);
  }

  return true;
};

/**
 * Convert completely filled compact
 * block to a regular block.
 * @returns {Block}
 */

CompactBlock.prototype.toBlock = function toBlock() {
  var block = new Block();

  block.version = this.version;
  block.prevBlock = this.prevBlock;
  block.merkleRoot = this.merkleRoot;
  block.time = this.time;
  block.bits = this.bits;
  block.nonce = this.nonce;
  block._hash = this._hash;
  block._hhash = this._hhash;

  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = (0, _getIterator3.default)(this.available), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var tx = _step5.value;

      assert(tx, 'Compact block is not full.');
      block.txs.push(tx);
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

  return block;
};

/**
 * Inject properties from block.
 * @private
 * @param {Block} block
 * @param {Boolean} witness
 * @param {Buffer?} nonce
 * @returns {CompactBlock}
 */

CompactBlock.prototype.fromBlock = function fromBlock(block, witness, nonce) {
  this.version = block.version;
  this.prevBlock = block.prevBlock;
  this.merkleRoot = block.merkleRoot;
  this.time = block.time;
  this.bits = block.bits;
  this.nonce = block.nonce;
  this.totalTX = block.txs.length;
  this._hash = block._hash;
  this._hhash = block._hhash;

  if (!nonce) nonce = util.nonce();

  this.keyNonce = nonce;
  this.sipKey = this.getKey();

  for (var i = 1; i < block.txs.length; i++) {
    var tx = block.txs[i];
    var hash = tx.hash();

    if (witness) hash = tx.witnessHash();

    var id = this.sid(hash);

    this.ids.push(id);
  }

  this.ptx.push([0, block.txs[0]]);

  return this;
};

/**
 * Instantiate compact block from a block.
 * @param {Block} block
 * @param {Boolean} witness
 * @param {Buffer?} nonce
 * @returns {CompactBlock}
 */

CompactBlock.fromBlock = function fromBlock(block, witness, nonce) {
  return new CompactBlock().fromBlock(block, witness, nonce);
};

/**
 * Convert block to headers.
 * @returns {Headers}
 */

CompactBlock.prototype.toHeaders = function toHeaders() {
  return Headers.fromBlock(this);
};

/**
 * Represents a BlockTransactionsRequest (bip152): `getblocktxn` packet.
 * @see https://github.com/bitcoin/bips/blob/master/bip-0152.mediawiki
 * @constructor
 * @param {Object} options
 * @property {Hash} hash
 * @property {Number[]} indexes
 */

function TXRequest(options) {
  if (!(this instanceof TXRequest)) return new TXRequest(options);

  this.hash = encoding.NULL_HASH;
  this.indexes = [];

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from options.
 * @private
 * @param {Object} options
 * @returns {TXRequest}
 */

TXRequest.prototype.fromOptions = function fromOptions(options) {
  this.hash = options.hash;

  if (options.indexes) this.indexes = options.indexes;

  return this;
};

/**
 * Instantiate request from options.
 * @param {Object} options
 * @returns {TXRequest}
 */

TXRequest.fromOptions = function fromOptions(options) {
  return new TXRequest().fromOptions(options);
};

/**
 * Inject properties from compact block.
 * @private
 * @param {CompactBlock} block
 * @returns {TXRequest}
 */

TXRequest.prototype.fromCompact = function fromCompact(block) {
  this.hash = block.hash('hex');

  for (var i = 0; i < block.available.length; i++) {
    if (!block.available[i]) this.indexes.push(i);
  }

  return this;
};

/**
 * Instantiate request from compact block.
 * @param {CompactBlock} block
 * @returns {TXRequest}
 */

TXRequest.fromCompact = function fromCompact(block) {
  return new TXRequest().fromCompact(block);
};

/**
 * Inject properties from buffer reader.
 * @private
 * @param {BufferReader} br
 * @returns {TXRequest}
 */

TXRequest.prototype.fromReader = function fromReader(br) {
  this.hash = br.readHash('hex');

  var count = br.readVarint();

  for (var i = 0; i < count; i++) {
    var index = br.readVarint();
    assert(index <= 0xffff);
    this.indexes.push(index);
  }

  var offset = 0;

  for (var _i4 = 0; _i4 < count; _i4++) {
    var _index = this.indexes[_i4];
    _index += offset;
    assert(_index <= 0xffff);
    this.indexes[_i4] = _index;
    offset = _index + 1;
  }

  return this;
};

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 * @returns {TXRequest}
 */

TXRequest.prototype.fromRaw = function fromRaw(data) {
  return this.fromReader(new BufferReader(data));
};

/**
 * Instantiate request from buffer reader.
 * @param {BufferReader} br
 * @returns {TXRequest}
 */

TXRequest.fromReader = function fromReader(br) {
  return new TXRequest().fromReader(br);
};

/**
 * Instantiate request from serialized data.
 * @param {Buffer} data
 * @returns {TXRequest}
 */

TXRequest.fromRaw = function fromRaw(data) {
  return new TXRequest().fromRaw(data);
};

/**
 * Calculate request serialization size.
 * @returns {Number}
 */

TXRequest.prototype.getSize = function getSize() {
  var size = 0;

  size += 32;
  size += encoding.sizeVarint(this.indexes.length);

  for (var i = 0; i < this.indexes.length; i++) {
    var index = this.indexes[i];

    if (i > 0) index -= this.indexes[i - 1] + 1;

    size += encoding.sizeVarint(index);
  }

  return size;
};

/**
 * Write serialized request to buffer writer.
 * @param {BufferWriter} bw
 */

TXRequest.prototype.toWriter = function toWriter(bw) {
  bw.writeHash(this.hash);

  bw.writeVarint(this.indexes.length);

  for (var i = 0; i < this.indexes.length; i++) {
    var index = this.indexes[i];

    if (i > 0) index -= this.indexes[i - 1] + 1;

    bw.writeVarint(index);
  }

  return bw;
};

/**
 * Serialize request.
 * @returns {Buffer}
 */

TXRequest.prototype.toRaw = function toRaw() {
  var size = this.getSize();
  return this.toWriter(new StaticWriter(size)).render();
};

/**
 * Represents BlockTransactions (bip152): `blocktxn` packet.
 * @see https://github.com/bitcoin/bips/blob/master/bip-0152.mediawiki
 * @constructor
 * @param {Object} options
 * @property {Hash} hash
 * @property {TX[]} txs
 */

function TXResponse(options) {
  if (!(this instanceof TXResponse)) return new TXResponse(options);

  this.hash = encoding.NULL_HASH;
  this.txs = [];

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from options.
 * @private
 * @param {Object} options
 * @returns {TXResponse}
 */

TXResponse.prototype.fromOptions = function fromOptions(options) {
  this.hash = options.hash;

  if (options.txs) this.txs = options.txs;

  return this;
};

/**
 * Instantiate response from options.
 * @param {Object} options
 * @returns {TXResponse}
 */

TXResponse.fromOptions = function fromOptions(options) {
  return new TXResponse().fromOptions(options);
};

/**
 * Inject properties from buffer reader.
 * @private
 * @param {BufferReader} br
 * @returns {TXResponse}
 */

TXResponse.prototype.fromReader = function fromReader(br) {
  this.hash = br.readHash('hex');

  var count = br.readVarint();

  for (var i = 0; i < count; i++) {
    this.txs.push(TX.fromReader(br));
  }return this;
};

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 * @returns {TXResponse}
 */

TXResponse.prototype.fromRaw = function fromRaw(data) {
  return this.fromReader(new BufferReader(data));
};

/**
 * Instantiate response from buffer reader.
 * @param {BufferReader} br
 * @returns {TXResponse}
 */

TXResponse.fromReader = function fromReader(br) {
  return new TXResponse().fromReader(br);
};

/**
 * Instantiate response from serialized data.
 * @param {Buffer} data
 * @returns {TXResponse}
 */

TXResponse.fromRaw = function fromRaw(data) {
  return new TXResponse().fromRaw(data);
};

/**
 * Inject properties from block.
 * @private
 * @param {Block} block
 * @returns {TXResponse}
 */

TXResponse.prototype.fromBlock = function fromBlock(block, req) {
  this.hash = req.hash;

  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(req.indexes), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var index = _step6.value;

      if (index >= block.txs.length) break;

      this.txs.push(block.txs[index]);
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

  return this;
};

/**
 * Instantiate response from block.
 * @param {Block} block
 * @returns {TXResponse}
 */

TXResponse.fromBlock = function fromBlock(block, req) {
  return new TXResponse().fromBlock(block, req);
};

/**
 * Serialize response with witness data.
 * @returns {Buffer}
 */

TXResponse.prototype.toRaw = function toRaw() {
  return this.frameRaw(true);
};

/**
 * Serialize response without witness data.
 * @returns {Buffer}
 */

TXResponse.prototype.toNormal = function toNormal() {
  return this.frameRaw(false);
};

/**
 * Write serialized response to a buffer
 * writer (includes witness data).
 * @param {BufferWriter} bw
 */

TXResponse.prototype.toWriter = function toWriter(bw) {
  return this.writeRaw(bw, true);
};

/**
 * Write serialized response to a buffer
 * writer (excludes witness data).
 * @param {BufferWriter} bw
 */

TXResponse.prototype.toNormalWriter = function toNormalWriter(bw) {
  return this.writeRaw(bw, false);
};

/**
 * Calculate request serialization size.
 * @returns {Number}
 */

TXResponse.prototype.getSize = function getSize(witness) {
  var size = 0;

  size += 32;
  size += encoding.sizeVarint(this.txs.length);

  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = (0, _getIterator3.default)(this.txs), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var tx = _step7.value;

      if (witness) size += tx.getSize();else size += tx.getBaseSize();
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

  return size;
};

/**
 * Write serialized response to buffer writer.
 * @private
 * @param {BufferWriter} bw
 * @param {Boolean} witness
 */

TXResponse.prototype.writeRaw = function writeRaw(bw, witness) {
  bw.writeHash(this.hash);

  bw.writeVarint(this.txs.length);

  var _iteratorNormalCompletion8 = true;
  var _didIteratorError8 = false;
  var _iteratorError8 = undefined;

  try {
    for (var _iterator8 = (0, _getIterator3.default)(this.txs), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
      var tx = _step8.value;

      if (witness) tx.toWriter(bw);else tx.toNormalWriter(bw);
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

  return bw;
};

/**
 * Serialize response with witness data.
 * @private
 * @param {Boolean} witness
 * @returns {Buffer}
 */

TXResponse.prototype.frameRaw = function frameRaw(witness) {
  var size = this.getSize(witness);
  return this.writeRaw(new StaticWriter(size), witness).render();
};

/*
 * Expose
 */

exports.CompactBlock = CompactBlock;
exports.TXRequest = TXRequest;
exports.TXResponse = TXResponse;