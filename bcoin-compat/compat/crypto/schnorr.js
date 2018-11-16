/*!
 * schnorr.js - schnorr signatures for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var assert = require('assert');
var elliptic = require('elliptic');
var Signature = require('elliptic/lib/elliptic/ec/signature');
var BN = require('./bn');
var HmacDRBG = require('./hmac-drbg');
var sha256 = require('./digest').sha256;
var curve = elliptic.ec('secp256k1').curve;
var POOL64 = Buffer.allocUnsafe(64);

/**
 * @exports crypto/schnorr
 */

var schnorr = exports;

/**
 * Hash (r | M).
 * @param {Buffer} msg
 * @param {BN} r
 * @returns {Buffer}
 */

schnorr.hash = function hash(msg, r) {
  var R = r.toArrayLike(Buffer, 'be', 32);
  var B = POOL64;

  R.copy(B, 0);
  msg.copy(B, 32);

  return new BN(sha256(B));
};

/**
 * Sign message.
 * @private
 * @param {Buffer} msg
 * @param {BN} priv
 * @param {BN} k
 * @param {Buffer} pn
 * @returns {Signature|null}
 */

schnorr.trySign = function trySign(msg, prv, k, pn) {
  if (prv.isZero()) throw new Error('Bad private key.');

  if (prv.gte(curve.n)) throw new Error('Bad private key.');

  if (k.isZero()) return null;

  if (k.gte(curve.n)) return null;

  var r = curve.g.mul(k);

  if (pn) r = r.add(pn);

  if (r.y.isOdd()) {
    k = k.umod(curve.n);
    k = curve.n.sub(k);
  }

  var h = schnorr.hash(msg, r.getX());

  if (h.isZero()) return null;

  if (h.gte(curve.n)) return null;

  var s = h.imul(prv);
  s = k.isub(s);
  s = s.umod(curve.n);

  if (s.isZero()) return null;

  return new Signature({ r: r.getX(), s: s });
};

/**
 * Sign message.
 * @param {Buffer} msg
 * @param {Buffer} key
 * @param {Buffer} pubNonce
 * @returns {Signature}
 */

schnorr.sign = function sign(msg, key, pubNonce) {
  var prv = new BN(key);
  var drbg = schnorr.drbg(msg, key, pubNonce);
  var len = curve.n.byteLength();

  var pn = void 0;
  if (pubNonce) pn = curve.decodePoint(pubNonce);

  var sig = void 0;
  while (!sig) {
    var k = new BN(drbg.generate(len));
    sig = schnorr.trySign(msg, prv, k, pn);
  }

  return sig;
};

/**
 * Verify signature.
 * @param {Buffer} msg
 * @param {Buffer} signature
 * @param {Buffer} key
 * @returns {Buffer}
 */

schnorr.verify = function verify(msg, signature, key) {
  var sig = new Signature(signature);
  var h = schnorr.hash(msg, sig.r);

  if (h.gte(curve.n)) throw new Error('Invalid hash.');

  if (h.isZero()) throw new Error('Invalid hash.');

  if (sig.s.gte(curve.n)) throw new Error('Invalid S value.');

  if (sig.r.gt(curve.p)) throw new Error('Invalid R value.');

  var k = curve.decodePoint(key);
  var l = k.mul(h);
  var r = curve.g.mul(sig.s);
  var rl = l.add(r);

  if (rl.y.isOdd()) throw new Error('Odd R value.');

  return rl.getX().eq(sig.r);
};

/**
 * Recover public key.
 * @param {Buffer} msg
 * @param {Buffer} signature
 * @returns {Buffer}
 */

schnorr.recover = function recover(signature, msg) {
  var sig = new Signature(signature);
  var h = schnorr.hash(msg, sig.r);

  if (h.gte(curve.n)) throw new Error('Invalid hash.');

  if (h.isZero()) throw new Error('Invalid hash.');

  if (sig.s.gte(curve.n)) throw new Error('Invalid S value.');

  if (sig.r.gt(curve.p)) throw new Error('Invalid R value.');

  var hinv = h.invm(curve.n);
  hinv = hinv.umod(curve.n);

  var s = sig.s;
  s = curve.n.sub(s);
  s = s.umod(curve.n);

  s = s.imul(hinv);
  s = s.umod(curve.n);

  var R = curve.pointFromX(sig.r, false);
  var l = R.mul(hinv);
  var r = curve.g.mul(s);
  var k = l.add(r);

  l = k.mul(h);
  r = curve.g.mul(sig.s);

  var rl = l.add(r);

  if (rl.y.isOdd()) throw new Error('Odd R value.');

  if (!rl.getX().eq(sig.r)) throw new Error('Could not recover pubkey.');

  return Buffer.from(k.encode('array', true));
};

/**
 * Combine signatures.
 * @param {Buffer[]} sigs
 * @returns {Signature}
 */

schnorr.combineSigs = function combineSigs(sigs) {
  var s = new BN(0);
  var r = void 0,
      last = void 0;

  for (var i = 0; i < sigs.length; i++) {
    var sig = new Signature(sigs[i]);

    if (sig.s.isZero()) throw new Error('Bad S value.');

    if (sig.s.gte(curve.n)) throw new Error('Bad S value.');

    if (!r) r = sig.r;

    if (last && !last.r.eq(sig.r)) throw new Error('Bad signature combination.');

    s = s.iadd(sig.s);
    s = s.umod(curve.n);

    last = sig;
  }

  if (s.isZero()) throw new Error('Bad combined signature.');

  return new Signature({ r: r, s: s });
};

/**
 * Combine public keys.
 * @param {Buffer[]} keys
 * @returns {Buffer}
 */

schnorr.combineKeys = function combineKeys(keys) {
  if (keys.length === 0) throw new Error();

  if (keys.length === 1) return keys[0];

  var point = curve.decodePoint(keys[0]);

  for (var i = 1; i < keys.length; i++) {
    var key = curve.decodePoint(keys[i]);
    point = point.add(key);
  }

  return Buffer.from(point.encode('array', true));
};

/**
 * Partially sign.
 * @param {Buffer} msg
 * @param {Buffer} priv
 * @param {Buffer} privNonce
 * @param {Buffer} pubNonce
 * @returns {Buffer}
 */

schnorr.partialSign = function partialSign(msg, priv, privNonce, pubNonce) {
  var prv = new BN(priv);
  var k = new BN(privNonce);
  var pn = curve.decodePoint(pubNonce);
  var sig = schnorr.trySign(msg, prv, k, pn);

  if (!sig) throw new Error('Bad K value.');

  return sig;
};

/**
 * Schnorr personalization string.
 * @const {Buffer}
 */

schnorr.alg = Buffer.from('Schnorr+SHA256  ', 'ascii');

/**
 * Instantiate an HMAC-DRBG.
 * @param {Buffer} msg
 * @param {Buffer} priv
 * @param {Buffer} data
 * @returns {HmacDRBG}
 */

schnorr.drbg = function drbg(msg, priv, data) {
  var pers = Buffer.allocUnsafe(48);

  pers.fill(0);

  if (data) {
    assert(data.length === 32);
    data.copy(pers, 0);
  }

  schnorr.alg.copy(pers, 32);

  return new HmacDRBG(priv, msg, pers);
};

/**
 * Generate pub+priv nonce pair.
 * @param {Buffer} msg
 * @param {Buffer} priv
 * @param {Buffer} data
 * @returns {Buffer}
 */

schnorr.generateNoncePair = function generateNoncePair(msg, priv, data) {
  var drbg = schnorr.drbg(msg, priv, data);
  var len = curve.n.byteLength();

  var k = void 0;
  for (;;) {
    k = new BN(drbg.generate(len));

    if (k.isZero()) continue;

    if (k.gte(curve.n)) continue;

    break;
  }

  return Buffer.from(curve.g.mul(k).encode('array', true));
};