/*!
 * client.js - http client for wallets
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var IOClient = require('socket.io-client');
var Network = require('../protocol/network');
var AsyncObject = require('../utils/asyncobject');
var TX = require('../primitives/tx');

var _require = require('./records'),
    BlockMeta = _require.BlockMeta;

var Headers = require('../primitives/headers');
var util = require('../utils/util');
var BufferReader = require('../utils/reader');

/**
 * Bcoin HTTP client.
 * @alias module:wallet.WalletClient
 * @constructor
 * @param {Object|String} options
 */

function WalletClient(options) {
  if (!(this instanceof WalletClient)) return new WalletClient(options);

  if (!options) options = {};

  if (typeof options === 'string') options = { uri: options };

  AsyncObject.call(this);

  this.options = options;
  this.network = Network.get(options.network);

  this.uri = options.uri || 'http://localhost:' + this.network.rpcPort;
  this.apiKey = options.apiKey;

  this.socket = null;
}

(0, _setPrototypeOf2.default)(WalletClient.prototype, AsyncObject.prototype);

/**
 * Open the client, wait for socket to connect.
 * @alias WalletClient#open
 * @returns {Promise}
 */

WalletClient.prototype._open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var _this = this;

    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            this.socket = new IOClient(this.uri, {
              transports: ['websocket'],
              forceNew: true
            });

            this.socket.on('error', function (err) {
              _this.emit('error', err);
            });

            this.socket.on('version', function (info) {
              if (info.network !== _this.network.type) _this.emit('error', new Error('Wrong network.'));
            });

            this.socket.on('block connect', function (entry, txs) {
              var block = void 0;

              try {
                block = parseBlock(entry, txs);
              } catch (e) {
                _this.emit('error', e);
                return;
              }

              _this.emit('block connect', block.entry, block.txs);
            });

            this.socket.on('block disconnect', function (entry) {
              var block = void 0;

              try {
                block = parseEntry(entry);
              } catch (e) {
                _this.emit('error', e);
                return;
              }

              _this.emit('block disconnect', block);
            });

            this.socket.on('block rescan', function (entry, txs, cb) {
              var block = void 0;

              try {
                block = parseBlock(entry, txs);
              } catch (e) {
                _this.emit('error', e);
                cb();
                return;
              }

              _this.fire('block rescan', block.entry, block.txs).then(cb, cb);
            });

            this.socket.on('chain reset', function (tip) {
              var block = void 0;

              try {
                block = parseEntry(tip);
              } catch (e) {
                _this.emit('error', e);
                return;
              }

              _this.emit('chain reset', block);
            });

            this.socket.on('tx', function (tx) {
              try {
                tx = parseTX(tx);
              } catch (e) {
                _this.emit('error', e);
                return;
              }
              _this.emit('tx', tx);
            });

            _context.next = 10;
            return this.onConnect();

          case 10:
            _context.next = 12;
            return this.sendAuth();

          case 12:
            _context.next = 14;
            return this.watchChain();

          case 14:
            _context.next = 16;
            return this.watchMempool();

          case 16:
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
 * Close the client, wait for the socket to close.
 * @alias WalletClient#close
 * @returns {Promise}
 */

WalletClient.prototype._close = function _close() {
  if (!this.socket) return _promise2.default.resolve();

  this.socket.disconnect();
  this.socket = null;

  return _promise2.default.resolve();
};

/**
 * Wait for websocket connection.
 * @private
 * @returns {Promise}
 */

WalletClient.prototype.onConnect = function onConnect() {
  var _this2 = this;

  return new _promise2.default(function (resolve, reject) {
    _this2.socket.once('connect', resolve);
  });
};

/**
 * Wait for websocket auth.
 * @private
 * @returns {Promise}
 */

WalletClient.prototype.sendAuth = function sendAuth() {
  var _this3 = this;

  return new _promise2.default(function (resolve, reject) {
    _this3.socket.emit('auth', _this3.apiKey, wrap(resolve, reject));
  });
};

/**
 * Watch the blockchain.
 * @private
 * @returns {Promise}
 */

WalletClient.prototype.watchChain = function watchChain() {
  var _this4 = this;

  return new _promise2.default(function (resolve, reject) {
    _this4.socket.emit('watch chain', wrap(resolve, reject));
  });
};

/**
 * Watch the blockchain.
 * @private
 * @returns {Promise}
 */

WalletClient.prototype.watchMempool = function watchMempool() {
  var _this5 = this;

  return new _promise2.default(function (resolve, reject) {
    _this5.socket.emit('watch mempool', wrap(resolve, reject));
  });
};

/**
 * Get chain tip.
 * @returns {Promise}
 */

WalletClient.prototype.getTip = function getTip() {
  var _this6 = this;

  return new _promise2.default(function (resolve, reject) {
    _this6.socket.emit('get tip', wrap(resolve, reject, parseEntry));
  });
};

/**
 * Get chain entry.
 * @param {Hash} hash
 * @returns {Promise}
 */

WalletClient.prototype.getEntry = function getEntry(block) {
  var _this7 = this;

  return new _promise2.default(function (resolve, reject) {
    if (typeof block === 'string') block = util.revHex(block);

    _this7.socket.emit('get entry', block, wrap(resolve, reject, parseEntry));
  });
};

/**
 * Send a transaction. Do not wait for promise.
 * @param {TX} tx
 * @returns {Promise}
 */

WalletClient.prototype.send = function send(tx) {
  var _this8 = this;

  return new _promise2.default(function (resolve, reject) {
    _this8.socket.emit('send', tx.toRaw(), wrap(resolve, reject));
  });
};

/**
 * Set bloom filter.
 * @param {Bloom} filter
 * @returns {Promise}
 */

WalletClient.prototype.setFilter = function setFilter(filter) {
  var _this9 = this;

  return new _promise2.default(function (resolve, reject) {
    _this9.socket.emit('set filter', filter.toRaw(), wrap(resolve, reject));
  });
};

/**
 * Add data to filter.
 * @param {Buffer} data
 * @returns {Promise}
 */

WalletClient.prototype.addFilter = function addFilter(chunks) {
  var _this10 = this;

  if (!Array.isArray(chunks)) chunks = [chunks];

  return new _promise2.default(function (resolve, reject) {
    _this10.socket.emit('add filter', chunks, wrap(resolve, reject));
  });
};

/**
 * Reset filter.
 * @returns {Promise}
 */

WalletClient.prototype.resetFilter = function resetFilter() {
  var _this11 = this;

  return new _promise2.default(function (resolve, reject) {
    _this11.socket.emit('reset filter', wrap(resolve, reject));
  });
};

/**
 * Esimate smart fee.
 * @param {Number?} blocks
 * @returns {Promise}
 */

WalletClient.prototype.estimateFee = function estimateFee(blocks) {
  var _this12 = this;

  return new _promise2.default(function (resolve, reject) {
    _this12.socket.emit('estimate fee', blocks, wrap(resolve, reject));
  });
};

/**
 * Rescan for any missed transactions.
 * @param {Number|Hash} start - Start block.
 * @param {Bloom} filter
 * @param {Function} iter - Iterator.
 * @returns {Promise}
 */

WalletClient.prototype.rescan = function rescan(start) {
  var _this13 = this;

  return new _promise2.default(function (resolve, reject) {
    if (typeof start === 'string') start = util.revHex(start);

    _this13.socket.emit('rescan', start, wrap(resolve, reject));
  });
};

/*
 * Helpers
 */

function parseEntry(data, enc) {
  if (typeof data === 'string') data = Buffer.from(data, 'hex');

  var block = Headers.fromHead(data);

  var br = new BufferReader(data);
  br.seek(80);

  var height = br.readU32();
  var hash = block.hash('hex');

  return new BlockMeta(hash, height, block.time);
}

function parseBlock(entry, txs) {
  var block = parseEntry(entry);
  var out = [];

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(txs), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var raw = _step.value;

      var tx = parseTX(raw);
      out.push(tx);
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

  return new BlockResult(block, out);
}

function parseTX(data) {
  return TX.fromRaw(data, 'hex');
}

function BlockResult(entry, txs) {
  this.entry = entry;
  this.txs = txs;
}

function wrap(resolve, reject, parse) {
  return function (err, result) {
    if (err) {
      reject(new Error(err.message));
      return;
    }

    if (!result) {
      resolve(null);
      return;
    }

    if (!parse) {
      resolve(result);
      return;
    }

    try {
      result = parse(result);
    } catch (e) {
      reject(e);
      return;
    }

    resolve(result);
  };
}

/*
 * Expose
 */

module.exports = WalletClient;