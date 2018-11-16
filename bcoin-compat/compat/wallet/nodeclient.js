/*!
 * nodeclient.js - node client for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var AsyncObject = require('../utils/asyncobject');

/**
 * NodeClient
 * Sort of a fake local client for separation of concerns.
 * @alias module:node.NodeClient
 * @constructor
 */

function NodeClient(node) {
  if (!(this instanceof NodeClient)) return new NodeClient(node);

  AsyncObject.call(this);

  this.node = node;
  this.network = node.network;
  this.filter = null;
  this.listen = false;

  this._init();
}

(0, _setPrototypeOf2.default)(NodeClient.prototype, AsyncObject.prototype);

/**
 * Initialize the client.
 * @returns {Promise}
 */

NodeClient.prototype._init = function _init() {
  var _this = this;

  this.node.on('connect', function (entry, block) {
    if (!_this.listen) return;

    _this.emit('block connect', entry, block.txs);
  });

  this.node.on('disconnect', function (entry, block) {
    if (!_this.listen) return;

    _this.emit('block disconnect', entry);
  });

  this.node.on('tx', function (tx) {
    if (!_this.listen) return;

    _this.emit('tx', tx);
  });

  this.node.on('reset', function (tip) {
    if (!_this.listen) return;

    _this.emit('chain reset', tip);
  });
};

/**
 * Open the client.
 * @returns {Promise}
 */

NodeClient.prototype._open = function _open(options) {
  this.listen = true;
  return _promise2.default.resolve();
};

/**
 * Close the client.
 * @returns {Promise}
 */

NodeClient.prototype._close = function _close() {
  this.listen = false;
  return _promise2.default.resolve();
};

/**
 * Get chain tip.
 * @returns {Promise}
 */

NodeClient.prototype.getTip = function getTip() {
  return _promise2.default.resolve(this.node.chain.tip);
};

/**
 * Get chain entry.
 * @param {Hash} hash
 * @returns {Promise}
 */

NodeClient.prototype.getEntry = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(hash) {
    var entry;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return this.node.chain.getEntry(hash);

          case 2:
            entry = _context.sent;

            if (entry) {
              _context.next = 5;
              break;
            }

            return _context.abrupt('return', null);

          case 5:
            _context.next = 7;
            return this.node.chain.isMainChain(entry);

          case 7:
            if (_context.sent) {
              _context.next = 9;
              break;
            }

            return _context.abrupt('return', null);

          case 9:
            return _context.abrupt('return', entry);

          case 10:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function getEntry(_x) {
    return _ref.apply(this, arguments);
  }

  return getEntry;
}();

/**
 * Send a transaction. Do not wait for promise.
 * @param {TX} tx
 * @returns {Promise}
 */

NodeClient.prototype.send = function send(tx) {
  this.node.relay(tx);
  return _promise2.default.resolve();
};

/**
 * Set bloom filter.
 * @param {Bloom} filter
 * @returns {Promise}
 */

NodeClient.prototype.setFilter = function setFilter(filter) {
  this.filter = filter;
  this.node.pool.setFilter(filter);
  return _promise2.default.resolve();
};

/**
 * Add data to filter.
 * @param {Buffer} data
 * @returns {Promise}
 */

NodeClient.prototype.addFilter = function addFilter(data) {
  this.node.pool.queueFilterLoad();
  return _promise2.default.resolve();
};

/**
 * Reset filter.
 * @returns {Promise}
 */

NodeClient.prototype.resetFilter = function resetFilter() {
  this.node.pool.queueFilterLoad();
  return _promise2.default.resolve();
};

/**
 * Esimate smart fee.
 * @param {Number?} blocks
 * @returns {Promise}
 */

NodeClient.prototype.estimateFee = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(blocks) {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (this.node.fees) {
              _context2.next = 2;
              break;
            }

            return _context2.abrupt('return', this.network.feeRate);

          case 2:
            return _context2.abrupt('return', this.node.fees.estimateFee(blocks));

          case 3:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function estimateFee(_x2) {
    return _ref2.apply(this, arguments);
  }

  return estimateFee;
}();

/**
 * Rescan for any missed transactions.
 * @param {Number|Hash} start - Start block.
 * @param {Bloom} filter
 * @param {Function} iter - Iterator.
 * @returns {Promise}
 */

NodeClient.prototype.rescan = function rescan(start) {
  var _this2 = this;

  return this.node.chain.scan(start, this.filter, function (entry, txs) {
    return _this2.fire('block rescan', entry, txs);
  });
};

/*
 * Expose
 */

module.exports = NodeClient;