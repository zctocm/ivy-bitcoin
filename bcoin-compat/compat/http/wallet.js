/*!
 * wallet.js - http wallet for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var EventEmitter = require('events');
var Network = require('../protocol/network');
var Client = require('./client');

/**
 * HTTPWallet
 * @alias module:http.Wallet
 * @constructor
 * @param {String} uri
 */

function HTTPWallet(options) {
  if (!(this instanceof HTTPWallet)) return new HTTPWallet(options);

  EventEmitter.call(this);

  if (!options) options = {};

  if (typeof options === 'string') options = { uri: options };

  this.options = options;
  this.network = Network.get(options.network);

  this.client = new Client(options);
  this.uri = options.uri;
  this.id = null;
  this.token = null;

  if (options.id) this.id = options.id;

  if (options.token) {
    this.token = options.token;
    if (Buffer.isBuffer(this.token)) this.token = this.token.toString('hex');
    this.client.token = this.token;
  }

  this._init();
}

(0, _setPrototypeOf2.default)(HTTPWallet.prototype, EventEmitter.prototype);

/**
 * Initialize the wallet.
 * @private
 */

HTTPWallet.prototype._init = function _init() {
  var _this = this;

  this.client.on('tx', function (details) {
    _this.emit('tx', details);
  });

  this.client.on('confirmed', function (details) {
    _this.emit('confirmed', details);
  });

  this.client.on('unconfirmed', function (tx, details) {
    _this.emit('unconfirmed', details);
  });

  this.client.on('conflict', function (tx, details) {
    _this.emit('conflict', details);
  });

  this.client.on('balance', function (balance) {
    _this.emit('balance', balance);
  });

  this.client.on('address', function (receive) {
    _this.emit('address', receive);
  });

  this.client.on('error', function (err) {
    _this.emit('error', err);
  });
};

/**
 * Open the client and get a wallet.
 * @alias HTTPWallet#open
 * @returns {Promise}
 */

HTTPWallet.prototype.open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(options) {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (options) {
              if (options.id) this.id = options.id;

              if (options.token) {
                this.token = options.token;
                if (Buffer.isBuffer(this.token)) this.token = this.token.toString('hex');
                this.client.token = this.token;
              }
            }

            assert(this.id, 'No ID provided.');

            _context.next = 4;
            return this.client.open();

          case 4:
            _context.next = 6;
            return this.client.sendWalletAuth();

          case 6:
            _context.next = 8;
            return this.client.join(this.id, this.token);

          case 8:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function open(_x) {
    return _ref.apply(this, arguments);
  }

  return open;
}();

/**
 * Open the client and create a wallet.
 * @alias HTTPWallet#open
 * @returns {Promise}
 */

HTTPWallet.prototype.create = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(options) {
    var wallet;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return this.client.open();

          case 2:
            _context2.next = 4;
            return this.client.sendWalletAuth();

          case 4:
            _context2.next = 6;
            return this.client.createWallet(options);

          case 6:
            wallet = _context2.sent;


            this.id = wallet.id;
            this.token = wallet.token;
            this.client.token = this.token;

            _context2.next = 12;
            return this.client.join(this.id, this.token);

          case 12:
            return _context2.abrupt('return', wallet);

          case 13:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function create(_x2) {
    return _ref2.apply(this, arguments);
  }

  return create;
}();

/**
 * Close the client, wait for the socket to close.
 * @alias HTTPWallet#close
 * @returns {Promise}
 */

HTTPWallet.prototype.close = function close() {
  return this.client.close();
};

/**
 * Wait for websocket disconnection.
 * @private
 * @returns {Promise}
 */

HTTPWallet.prototype.onDisconnect = function onDisconnect() {
  return this.client.onDisconnect();
};

/**
 * @see Wallet#getHistory
 */

HTTPWallet.prototype.getHistory = function getHistory(account) {
  return this.client.getHistory(this.id, account);
};

/**
 * @see Wallet#getCoins
 */

HTTPWallet.prototype.getCoins = function getCoins(account) {
  return this.client.getCoins(this.id, account);
};

/**
 * @see Wallet#getPending
 */

HTTPWallet.prototype.getPending = function getPending(account) {
  return this.client.getPending(this.id, account);
};

/**
 * @see Wallet#getBalance
 */

HTTPWallet.prototype.getBalance = function getBalance(account) {
  return this.client.getBalance(this.id, account);
};

/**
 * @see Wallet#getLast
 */

HTTPWallet.prototype.getLast = function getLast(account, limit) {
  return this.client.getLast(this.id, account, limit);
};

/**
 * @see Wallet#getRange
 */

HTTPWallet.prototype.getRange = function getRange(account, options) {
  return this.client.getRange(this.id, account, options);
};

/**
 * @see Wallet#getTX
 */

HTTPWallet.prototype.getTX = function getTX(hash) {
  return this.client.getWalletTX(this.id, hash);
};

/**
 * @see Wallet#getBlocks
 */

HTTPWallet.prototype.getBlocks = function getBlocks() {
  return this.client.getWalletBlocks(this.id);
};

/**
 * @see Wallet#getBlock
 */

HTTPWallet.prototype.getBlock = function getBlock(height) {
  return this.client.getWalletBlock(this.id, height);
};

/**
 * @see Wallet#getCoin
 */

HTTPWallet.prototype.getCoin = function getCoin(hash, index) {
  return this.client.getWalletCoin(this.id, hash, index);
};

/**
 * @see Wallet#zap
 */

HTTPWallet.prototype.zap = function zap(account, age) {
  return this.client.zapWallet(this.id, account, age);
};

/**
 * @see Wallet#createTX
 */

HTTPWallet.prototype.createTX = function createTX(options) {
  return this.client.createTX(this.id, options);
};

/**
 * @see HTTPClient#walletSend
 */

HTTPWallet.prototype.send = function send(options) {
  return this.client.send(this.id, options);
};

/**
 * @see Wallet#sign
 */

HTTPWallet.prototype.sign = function sign(tx, options) {
  return this.client.sign(this.id, tx, options);
};

/**
 * @see HTTPClient#getWallet
 */

HTTPWallet.prototype.getInfo = function getInfo() {
  return this.client.getWallet(this.id);
};

/**
 * @see Wallet#getAccounts
 */

HTTPWallet.prototype.getAccounts = function getAccounts() {
  return this.client.getAccounts(this.id);
};

/**
 * @see Wallet#master
 */

HTTPWallet.prototype.getMaster = function getMaster() {
  return this.client.getMaster(this.id);
};

/**
 * @see Wallet#getAccount
 */

HTTPWallet.prototype.getAccount = function getAccount(account) {
  return this.client.getAccount(this.id, account);
};

/**
 * @see Wallet#createAccount
 */

HTTPWallet.prototype.createAccount = function createAccount(name, options) {
  return this.client.createAccount(this.id, name, options);
};

/**
 * @see Wallet#createAddress
 */

HTTPWallet.prototype.createAddress = function createAddress(account) {
  return this.client.createAddress(this.id, account);
};

/**
 * @see Wallet#createAddress
 */

HTTPWallet.prototype.createChange = function createChange(account) {
  return this.client.createChange(this.id, account);
};

/**
 * @see Wallet#createAddress
 */

HTTPWallet.prototype.createNested = function createNested(account) {
  return this.client.createNested(this.id, account);
};

/**
 * @see Wallet#setPassphrase
 */

HTTPWallet.prototype.setPassphrase = function setPassphrase(old, new_) {
  return this.client.setPassphrase(this.id, old, new_);
};

/**
 * @see Wallet#retoken
 */

HTTPWallet.prototype.retoken = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(passphrase) {
    var token;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return this.client.retoken(this.id, passphrase);

          case 2:
            token = _context3.sent;


            this.token = token;
            this.client.token = token;

            return _context3.abrupt('return', token);

          case 6:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function retoken(_x3) {
    return _ref3.apply(this, arguments);
  }

  return retoken;
}();

/**
 * Import private key.
 * @param {Number|String} account
 * @param {String} key
 * @returns {Promise}
 */

HTTPWallet.prototype.importPrivate = function importPrivate(account, key, passphrase) {
  return this.client.importPrivate(this.id, account, key, passphrase);
};

/**
 * Import public key.
 * @param {Number|String} account
 * @param {String} key
 * @returns {Promise}
 */

HTTPWallet.prototype.importPublic = function importPublic(account, key) {
  return this.client.importPublic(this.id, account, key);
};

/**
 * Import address.
 * @param {Number|String} account
 * @param {String} address
 * @returns {Promise}
 */

HTTPWallet.prototype.importAddress = function importAddress(account, address) {
  return this.client.importAddress(this.id, account, address);
};

/**
 * Lock a coin.
 * @param {String} hash
 * @param {Number} index
 * @returns {Promise}
 */

HTTPWallet.prototype.lockCoin = function lockCoin(hash, index) {
  return this.client.lockCoin(this.id, hash, index);
};

/**
 * Unlock a coin.
 * @param {String} hash
 * @param {Number} index
 * @returns {Promise}
 */

HTTPWallet.prototype.unlockCoin = function unlockCoin(hash, index) {
  return this.client.unlockCoin(this.id, hash, index);
};

/**
 * Get locked coins.
 * @returns {Promise}
 */

HTTPWallet.prototype.getLocked = function getLocked() {
  return this.client.getLocked(this.id);
};

/**
 * Lock wallet.
 * @returns {Promise}
 */

HTTPWallet.prototype.lock = function lock() {
  return this.client.lock(this.id);
};

/**
 * Unlock wallet.
 * @param {String} passphrase
 * @param {Number} timeout
 * @returns {Promise}
 */

HTTPWallet.prototype.unlock = function unlock(passphrase, timeout) {
  return this.client.unlock(this.id, passphrase, timeout);
};

/**
 * Get wallet key.
 * @param {String} address
 * @returns {Promise}
 */

HTTPWallet.prototype.getKey = function getKey(address) {
  return this.client.getKey(this.id, address);
};

/**
 * Get wallet key WIF dump.
 * @param {String} address
 * @param {String?} passphrase
 * @returns {Promise}
 */

HTTPWallet.prototype.getWIF = function getWIF(address, passphrase) {
  return this.client.getWIF(this.id, address, passphrase);
};

/**
 * Add a public account/purpose key to the wallet for multisig.
 * @param {(String|Number)?} account
 * @param {Base58String} key - Account (bip44) or
 * Purpose (bip45) key (can be in base58 form).
 * @returns {Promise}
 */

HTTPWallet.prototype.addSharedKey = function addSharedKey(account, key) {
  return this.client.addSharedKey(this.id, account, key);
};

/**
 * Remove a public account/purpose key to the wallet for multisig.
 * @param {(String|Number)?} account
 * @param {Base58String} key - Account (bip44) or Purpose
 * (bip45) key (can be in base58 form).
 * @returns {Promise}
 */

HTTPWallet.prototype.removeSharedKey = function removeSharedKey(account, key) {
  return this.client.removeSharedKey(this.id, account, key);
};

/**
 * Resend wallet transactions.
 * @returns {Promise}
 */

HTTPWallet.prototype.resend = function resend() {
  return this.client.resendWallet(this.id);
};

/*
 * Expose
 */

module.exports = HTTPWallet;