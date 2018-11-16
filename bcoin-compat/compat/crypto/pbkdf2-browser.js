/*!
 * pbkdf2.js - pbkdf2 for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

/**
 * @module crypto.pbkdf2-browser
 * @ignore
 */

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var digest = require('./digest');
var crypto = global.crypto || global.msCrypto || {};
var subtle = crypto.subtle || {};

/**
 * Perform key derivation using PBKDF2.
 * @param {Buffer} key
 * @param {Buffer} salt
 * @param {Number} iter
 * @param {Number} len
 * @param {String} alg
 * @returns {Buffer}
 */

exports.derive = function derive(key, salt, iter, len, alg) {
  var size = digest.hash(alg, Buffer.alloc(0)).length;
  var blocks = Math.ceil(len / size);
  var out = Buffer.allocUnsafe(len);
  var buf = Buffer.allocUnsafe(salt.length + 4);
  var block = Buffer.allocUnsafe(size);
  var pos = 0;

  salt.copy(buf, 0);

  for (var i = 0; i < blocks; i++) {
    buf.writeUInt32BE(i + 1, salt.length, true);
    var mac = digest.hmac(alg, buf, key);
    mac.copy(block, 0);
    for (var j = 1; j < iter; j++) {
      mac = digest.hmac(alg, mac, key);
      for (var k = 0; k < size; k++) {
        block[k] ^= mac[k];
      }
    }
    block.copy(out, pos);
    pos += size;
  }

  return out;
};

/**
 * Execute pbkdf2 asynchronously.
 * @param {Buffer} key
 * @param {Buffer} salt
 * @param {Number} iter
 * @param {Number} len
 * @param {String} alg
 * @returns {Promise}
 */

exports.deriveAsync = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(key, salt, iter, len, alg) {
    var algo, use, options, imported, data;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            algo = { name: 'PBKDF2' };
            use = ['deriveBits'];

            if (!(!subtle.importKey || !subtle.deriveBits)) {
              _context.next = 4;
              break;
            }

            return _context.abrupt('return', exports.derive(key, salt, iter, len, alg));

          case 4:
            options = {
              name: 'PBKDF2',
              salt: salt,
              iterations: iter,
              hash: getHash(alg)
            };
            _context.next = 7;
            return subtle.importKey('raw', key, algo, false, use);

          case 7:
            imported = _context.sent;
            _context.next = 10;
            return subtle.deriveBits(options, imported, len * 8);

          case 10:
            data = _context.sent;
            return _context.abrupt('return', Buffer.from(data));

          case 12:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function deriveAsync(_x, _x2, _x3, _x4, _x5) {
    return _ref.apply(this, arguments);
  }

  return deriveAsync;
}();

/*
 * Helpers
 */

function getHash(name) {
  switch (name) {
    case 'sha1':
      return 'SHA-1';
    case 'sha256':
      return 'SHA-256';
    case 'sha384':
      return 'SHA-384';
    case 'sha512':
      return 'SHA-512';
    default:
      throw new Error('Algorithm not supported: ' + name + '.');
  }
}