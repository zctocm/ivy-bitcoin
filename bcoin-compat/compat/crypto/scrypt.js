/*!
 * scrypt.js - scrypt for bcoin
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 *
 * Ported from:
 * https://github.com/Tarsnap/scrypt/blob/master/lib/crypto/crypto_scrypt-ref.c
 *
 * Copyright 2009 Colin Percival
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 */

/* eslint camelcase: "off" */

'use strict';

/**
 * @module crypto/scrypt
 */

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

/**
 * Asynchronous scrypt implementation.
 * @alias module:crypto/scrypt.deriveAsync
 * @function
 * @param {Buffer} passwd
 * @param {Buffer} salt
 * @param {Number} N
 * @param {Number} r
 * @param {Number} p
 * @param {Number} len
 * @returns {Promise}
 */

var deriveAsync = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(passwd, salt, N, r, p, len) {
    var XY, V, B, i;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!(r * p >= 1 << 30)) {
              _context.next = 2;
              break;
            }

            throw new Error('EFBIG');

          case 2:
            if (!((N & N - 1) !== 0 || N === 0)) {
              _context.next = 4;
              break;
            }

            throw new Error('EINVAL');

          case 4:
            if (!(N > 0xffffffff)) {
              _context.next = 6;
              break;
            }

            throw new Error('EINVAL');

          case 6:
            XY = Buffer.allocUnsafe(256 * r);
            V = Buffer.allocUnsafe(128 * r * N);
            _context.next = 10;
            return pbkdf2.deriveAsync(passwd, salt, 1, p * 128 * r, 'sha256');

          case 10:
            B = _context.sent;
            i = 0;

          case 12:
            if (!(i < p)) {
              _context.next = 18;
              break;
            }

            _context.next = 15;
            return smixAsync(B, i * 128 * r, r, N, V, XY);

          case 15:
            i++;
            _context.next = 12;
            break;

          case 18:
            _context.next = 20;
            return pbkdf2.deriveAsync(passwd, B, 1, len, 'sha256');

          case 20:
            return _context.abrupt('return', _context.sent);

          case 21:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function deriveAsync(_x, _x2, _x3, _x4, _x5, _x6) {
    return _ref.apply(this, arguments);
  };
}();

var smixAsync = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(B, Bo, r, N, V, XY) {
    var X, Y, i, _i8, j;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            X = XY;
            Y = XY;


            blkcpy(X, B, 0, Bo, 128 * r);

            i = 0;

          case 4:
            if (!(i < N)) {
              _context2.next = 12;
              break;
            }

            blkcpy(V, X, i * (128 * r), 0, 128 * r);
            blockmix_salsa8(X, Y, 128 * r, r);
            _context2.next = 9;
            return co.wait();

          case 9:
            i++;
            _context2.next = 4;
            break;

          case 12:
            _i8 = 0;

          case 13:
            if (!(_i8 < N)) {
              _context2.next = 22;
              break;
            }

            j = integerify(X, r) & N - 1;

            blkxor(X, V, 0, j * (128 * r), 128 * r);
            blockmix_salsa8(X, Y, 128 * r, r);
            _context2.next = 19;
            return co.wait();

          case 19:
            _i8++;
            _context2.next = 13;
            break;

          case 22:

            blkcpy(B, X, Bo, 0, 128 * r);

          case 23:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  return function smixAsync(_x7, _x8, _x9, _x10, _x11, _x12) {
    return _ref2.apply(this, arguments);
  };
}();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var co = require('../utils/co');
var pbkdf2 = require('./pbkdf2');
var native = require('../native').binding;

/**
 * Javascript scrypt implementation. Scrypt is
 * used in bip38. Bcoin doesn't support bip38
 * yet, but here it is, just in case.
 * @alias module:crypto/scrypt.derive
 * @param {Buffer} passwd
 * @param {Buffer} salt
 * @param {Number} N
 * @param {Number} r
 * @param {Number} p
 * @param {Number} len
 * @returns {Buffer}
 */

function derive(passwd, salt, N, r, p, len) {
  if (r * p >= 1 << 30) throw new Error('EFBIG');

  if ((N & N - 1) !== 0 || N === 0) throw new Error('EINVAL');

  if (N > 0xffffffff) throw new Error('EINVAL');

  var XY = Buffer.allocUnsafe(256 * r);
  var V = Buffer.allocUnsafe(128 * r * N);

  var B = pbkdf2.derive(passwd, salt, 1, p * 128 * r, 'sha256');

  for (var i = 0; i < p; i++) {
    smix(B, i * 128 * r, r, N, V, XY);
  }return pbkdf2.derive(passwd, B, 1, len, 'sha256');
}

if (native) derive = native.scrypt;

if (native) deriveAsync = native.scryptAsync;

/*
 * Helpers
 */

function salsa20_8(B) {
  var B32 = new Uint32Array(16);
  var x = new Uint32Array(16);

  for (var i = 0; i < 16; i++) {
    B32[i] = B.readUInt32LE(i * 4, true);
  }for (var _i = 0; _i < 16; _i++) {
    x[_i] = B32[_i];
  }for (var _i2 = 0; _i2 < 8; _i2 += 2) {
    x[4] ^= R(x[0] + x[12], 7);
    x[8] ^= R(x[4] + x[0], 9);
    x[12] ^= R(x[8] + x[4], 13);
    x[0] ^= R(x[12] + x[8], 18);

    x[9] ^= R(x[5] + x[1], 7);
    x[13] ^= R(x[9] + x[5], 9);
    x[1] ^= R(x[13] + x[9], 13);
    x[5] ^= R(x[1] + x[13], 18);

    x[14] ^= R(x[10] + x[6], 7);
    x[2] ^= R(x[14] + x[10], 9);
    x[6] ^= R(x[2] + x[14], 13);
    x[10] ^= R(x[6] + x[2], 18);

    x[3] ^= R(x[15] + x[11], 7);
    x[7] ^= R(x[3] + x[15], 9);
    x[11] ^= R(x[7] + x[3], 13);
    x[15] ^= R(x[11] + x[7], 18);

    x[1] ^= R(x[0] + x[3], 7);
    x[2] ^= R(x[1] + x[0], 9);
    x[3] ^= R(x[2] + x[1], 13);
    x[0] ^= R(x[3] + x[2], 18);

    x[6] ^= R(x[5] + x[4], 7);
    x[7] ^= R(x[6] + x[5], 9);
    x[4] ^= R(x[7] + x[6], 13);
    x[5] ^= R(x[4] + x[7], 18);

    x[11] ^= R(x[10] + x[9], 7);
    x[8] ^= R(x[11] + x[10], 9);
    x[9] ^= R(x[8] + x[11], 13);
    x[10] ^= R(x[9] + x[8], 18);

    x[12] ^= R(x[15] + x[14], 7);
    x[13] ^= R(x[12] + x[15], 9);
    x[14] ^= R(x[13] + x[12], 13);
    x[15] ^= R(x[14] + x[13], 18);
  }

  for (var _i3 = 0; _i3 < 16; _i3++) {
    B32[_i3] += x[_i3];
  }for (var _i4 = 0; _i4 < 16; _i4++) {
    B.writeUInt32LE(B32[_i4], 4 * _i4, true);
  }
}

function R(a, b) {
  return a << b | a >>> 32 - b;
}

function blockmix_salsa8(B, Y, Yo, r) {
  var X = Buffer.allocUnsafe(64);

  blkcpy(X, B, 0, (2 * r - 1) * 64, 64);

  for (var i = 0; i < 2 * r; i++) {
    blkxor(X, B, 0, i * 64, 64);
    salsa20_8(X);
    blkcpy(Y, X, Yo + i * 64, 0, 64);
  }

  for (var _i5 = 0; _i5 < r; _i5++) {
    blkcpy(B, Y, _i5 * 64, Yo + _i5 * 2 * 64, 64);
  }for (var _i6 = 0; _i6 < r; _i6++) {
    blkcpy(B, Y, (_i6 + r) * 64, Yo + (_i6 * 2 + 1) * 64, 64);
  }
}

function integerify(B, r) {
  return B.readUInt32LE((2 * r - 1) * 64, true);
}

function smix(B, Bo, r, N, V, XY) {
  var X = XY;
  var Y = XY;

  blkcpy(X, B, 0, Bo, 128 * r);

  for (var i = 0; i < N; i++) {
    blkcpy(V, X, i * (128 * r), 0, 128 * r);
    blockmix_salsa8(X, Y, 128 * r, r);
  }

  for (var _i7 = 0; _i7 < N; _i7++) {
    var j = integerify(X, r) & N - 1;
    blkxor(X, V, 0, j * (128 * r), 128 * r);
    blockmix_salsa8(X, Y, 128 * r, r);
  }

  blkcpy(B, X, Bo, 0, 128 * r);
}

function blkcpy(dest, src, s1, s2, len) {
  src.copy(dest, s1, s2, s2 + len);
}

function blkxor(dest, src, s1, s2, len) {
  for (var i = 0; i < len; i++) {
    dest[s1 + i] ^= src[s2 + i];
  }
}

/*
 * Expose
 */

exports.derive = derive;
exports.deriveAsync = deriveAsync;