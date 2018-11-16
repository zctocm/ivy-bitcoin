/*!
 * rsa-browser.js - rsa for bcoin
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var assert = require('assert');
var BN = require('./bn');
var ASN1 = require('../utils/asn1');
var digest = require('./digest');
var ccmp = require('./ccmp');

/**
 * @exports crypto/rsa
 * @ignore
 */

var rsa = exports;

/**
 * PKCS signature prefixes.
 * @type {Object}
 */

rsa.prefixes = {
  md5: Buffer.from('3020300c06082a864886f70d020505000410', 'hex'),
  sha1: Buffer.from('3021300906052b0e03021a05000414', 'hex'),
  sha224: Buffer.from('302d300d06096086480165030402040500041c', 'hex'),
  sha256: Buffer.from('3031300d060960864801650304020105000420', 'hex'),
  sha384: Buffer.from('3041300d060960864801650304020205000430', 'hex'),
  sha512: Buffer.from('3051300d060960864801650304020305000440', 'hex'),
  ripemd160: Buffer.from('30203008060628cf060300310414', 'hex')
};

/**
 * Verify RSA signature.
 * @param {String} alg - Hash algorithm.
 * @param {Buffer} msg - Signed message.
 * @param {Buffer} sig - Signature.
 * @param {Buffer} key - ASN1 serialized RSA key.
 * @returns {Boolean}
 */

rsa.verify = function verify(alg, msg, sig, key) {
  assert(typeof alg === 'string', 'No algorithm selected.');
  assert(Buffer.isBuffer(msg));
  assert(Buffer.isBuffer(sig));
  assert(Buffer.isBuffer(key));

  var prefix = rsa.prefixes[alg];

  if (!prefix) throw new Error('Unknown PKCS prefix.');

  var hash = digest.hash(alg, msg);
  var len = prefix.length + hash.length;
  var pub = ASN1.parseRSAPublic(key);

  var N = new BN(pub.modulus);
  var e = new BN(pub.publicExponent);
  var k = Math.ceil(N.bitLength() / 8);

  if (k < len + 11) throw new Error('Message too long.');

  var m = rsa.encrypt(N, e, sig);
  var em = leftpad(m, k);

  var ok = ceq(em[0], 0x00);
  ok &= ceq(em[1], 0x01);
  ok &= ccmp(em.slice(k - hash.length, k), hash);
  ok &= ccmp(em.slice(k - len, k - hash.length), prefix);
  ok &= ceq(em[k - len - 1], 0x00);

  for (var i = 2; i < k - len - 1; i++) {
    ok &= ceq(em[i], 0xff);
  }return ok === 1;
};

/**
 * Sign message with RSA key.
 * @param {String} alg - Hash algorithm.
 * @param {Buffer} msg - Signed message.
 * @param {Buffer} key - ASN1 serialized RSA key.
 * @returns {Buffer} Signature (DER)
 */

rsa.sign = function sign(alg, msg, key) {
  assert(typeof alg === 'string', 'No algorithm selected.');
  assert(Buffer.isBuffer(msg));
  assert(Buffer.isBuffer(key));

  var prefix = rsa.prefixes[alg];

  if (!prefix) throw new Error('Unknown PKCS prefix.');

  var hash = digest.hash(alg, msg);
  var len = prefix.length + hash.length;
  var priv = ASN1.parseRSAPrivate(key);

  var N = new BN(priv.modulus);
  var D = new BN(priv.privateExponent);
  var k = Math.ceil(N.bitLength() / 8);

  if (k < len + 11) throw new Error('Message too long.');

  var em = Buffer.allocUnsafe(k);
  em.fill(0);

  em[1] = 0x01;
  for (var i = 2; i < k - len - 1; i++) {
    em[i] = 0xff;
  }prefix.copy(em, k - len);
  hash.copy(em, k - hash.length);

  return rsa.decrypt(N, D, em);
};

/**
 * Decrypt with modulus and exponent.
 * @param {BN} N
 * @param {BN} D
 * @param {Buffer} m
 * @returns {Buffer}
 */

rsa.decrypt = function decrypt(N, D, m) {
  var c = new BN(m);

  if (c.cmp(N) > 0) throw new Error('Cannot decrypt.');

  return c.toRed(BN.red(N)).redPow(D).fromRed().toArrayLike(Buffer, 'be');
};

/**
 * Encrypt with modulus and exponent.
 * @param {BN} N
 * @param {BN} e
 * @param {Buffer} m
 * @returns {Buffer}
 */

rsa.encrypt = function encrypt(N, e, m) {
  return new BN(m).toRed(BN.red(N)).redPow(e).fromRed().toArrayLike(Buffer, 'be');
};

/*
 * Helpers
 */

function leftpad(input, size) {
  var n = input.length;

  if (n > size) n = size;

  var out = Buffer.allocUnsafe(size);
  out.fill(0);

  input.copy(out, out.length - n);

  return out;
}

function ceq(a, b) {
  var r = ~(a ^ b) & 0xff;
  r &= r >>> 4;
  r &= r >>> 2;
  r &= r >>> 1;
  return r === 1;
}