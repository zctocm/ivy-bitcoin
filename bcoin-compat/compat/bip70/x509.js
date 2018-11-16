/*!
 * x509.js - x509 handling for bcoin
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var ASN1 = require('../utils/asn1');
var PEM = require('../utils/pem');
var util = require('../utils/util');
var digest = require('../crypto/digest');
var pk = require('./pk');
var certs = require('./certs');

/**
 * @exports bip70/x509
 */

var x509 = exports;

/**
 * Map of trusted root certs.
 * @type {Set}
 */

x509.trusted = new _set2.default();

/**
 * Whether to allow untrusted root
 * certs during verification.
 * @type {Boolean}
 */

x509.allowUntrusted = false;

/**
 * OID to algorithm map for PKI.
 * @const {Object}
 * @see https://www.ietf.org/rfc/rfc2459.txt
 * @see https://tools.ietf.org/html/rfc3279
 * @see http://oid-info.com/get/1.2.840.10040.4
 * @see http://oid-info.com/get/1.2.840.113549.1.1
 * @see http://oid-info.com/get/1.2.840.10045.4.3
 */

x509.oid = {
  '1.2.840.10040.4.1': { key: 'dsa', hash: null },
  '1.2.840.10040.4.2': { key: 'dsa', hash: null },
  '1.2.840.10040.4.3': { key: 'dsa', hash: 'sha1' },
  '1.2.840.113549.1.1.1': { key: 'rsa', hash: null },
  '1.2.840.113549.1.1.2': { key: 'rsa', hash: 'md2' },
  '1.2.840.113549.1.1.3': { key: 'rsa', hash: 'md4' },
  '1.2.840.113549.1.1.4': { key: 'rsa', hash: 'md5' },
  '1.2.840.113549.1.1.5': { key: 'rsa', hash: 'sha1' },
  '1.2.840.113549.1.1.11': { key: 'rsa', hash: 'sha256' },
  '1.2.840.113549.1.1.12': { key: 'rsa', hash: 'sha384' },
  '1.2.840.113549.1.1.13': { key: 'rsa', hash: 'sha512' },
  '1.2.840.113549.1.1.14': { key: 'rsa', hash: 'sha224' },
  '1.2.840.10045.2.1': { key: 'ecdsa', hash: null },
  '1.2.840.10045.4.1': { key: 'ecdsa', hash: 'sha1' },
  '1.2.840.10045.4.3.1': { key: 'ecdsa', hash: 'sha224' },
  '1.2.840.10045.4.3.2': { key: 'ecdsa', hash: 'sha256' },
  '1.2.840.10045.4.3.3': { key: 'ecdsa', hash: 'sha384' },
  '1.2.840.10045.4.3.4': { key: 'ecdsa', hash: 'sha512' }
};

/**
 * OID to curve name map for ECDSA.
 * @type {Object}
 */

x509.curves = {
  '1.3.132.0.33': 'p224',
  '1.2.840.10045.3.1.7': 'p256',
  '1.3.132.0.34': 'p384',
  '1.3.132.0.35': 'p521'
};

/**
 * Retrieve cert value by OID.
 * @param {Object} cert
 * @param {String} oid
 * @returns {String}
 */

x509.getSubjectOID = function getSubjectOID(cert, oid) {
  var subject = cert.tbs.subject;

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(subject), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var entry = _step.value;

      if (entry.type === oid) return entry.value;
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

  return null;
};

/**
 * Try to retrieve CA name by checking
 * for a few different OIDs.
 * @param {Object} cert
 * @returns {String}
 */

x509.getCAName = function getCAName(cert) {
  // This seems to work the best in practice
  // for getting a human-readable and
  // descriptive name for the CA.
  // See:
  //   http://oid-info.com/get/2.5.4
  // Precedence:
  //   (3) commonName
  //   (11) organizationUnitName
  //   (10) organizationName
  return x509.getSubjectOID(cert, '2.5.4.3') || x509.getSubjectOID(cert, '2.5.4.11') || x509.getSubjectOID(cert, '2.5.4.10') || 'Unknown';
};

/**
 * Test whether a cert is trusted by hashing
 * and looking it up in the trusted map.
 * @param {Object} cert
 * @returns {Buffer}
 */

x509.isTrusted = function isTrusted(cert) {
  var fingerprint = digest.sha256(cert.raw);
  var hash = fingerprint.toString('hex');
  return x509.trusted.has(hash);
};

/**
 * Add root certificates to the trusted map.
 * @param {Buffer[]} certs
 */

x509.setTrust = function setTrust(certs) {
  assert(Array.isArray(certs), 'Certs must be an array.');

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(certs), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var cert = _step2.value;

      if (typeof cert === 'string') {
        var pem = PEM.decode(cert);
        assert(pem.type === 'certificate', 'Must add certificates to trust.');
        cert = pem.data;
      }

      assert(Buffer.isBuffer(cert), 'Certificates must be PEM or DER.');

      cert = x509.parse(cert);

      var hash = digest.sha256(cert.raw);
      var fingerprint = hash.toString('hex');

      x509.trusted.add(fingerprint);
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
 * Add root certificate fingerprints to the trusted map.
 * @param {Hash[]} hashes
 */

x509.setFingerprints = function setFingerprints(hashes) {
  assert(Array.isArray(hashes), 'Certs must be an array.');

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(hashes), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var hash = _step3.value;

      if (typeof hash === 'string') hash = Buffer.from(hash, 'hex');

      assert(Buffer.isBuffer(hash), 'Fingerprint must be a buffer.');
      assert(hash.length === 32, 'Fingerprint must be a sha256 hash.');

      hash = hash.toString('hex');
      x509.trusted.add(hash);
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
};

/**
 * Retrieve key algorithm from cert.
 * @param {Object} cert
 * @returns {Object}
 */

x509.getKeyAlgorithm = function getKeyAlgorithm(cert) {
  var oid = cert.tbs.pubkey.alg.alg;
  var alg = x509.oid[oid];

  if (!alg) throw new Error('Unknown key algorithm: ' + oid + '.');

  return alg;
};

/**
 * Retrieve signature algorithm from cert.
 * @param {Object} cert
 * @returns {Object}
 */

x509.getSigAlgorithm = function getSigAlgorithm(cert) {
  var oid = cert.sigAlg.alg;
  var alg = x509.oid[oid];

  if (!alg || !alg.hash) throw new Error('Unknown signature algorithm: ' + oid + '.');

  return alg;
};

/**
 * Lookup curve based on key parameters.
 * @param {Buffer} params
 * @returns {Object}
 */

x509.getCurve = function getCurve(params) {
  var oid = void 0;

  try {
    oid = ASN1.parseOID(params);
  } catch (e) {
    throw new Error('Could not parse curve OID.');
  }

  var curve = x509.curves[oid];

  if (!curve) throw new Error('Unknown ECDSA curve: ' + oid + '.');

  return curve;
};

/**
 * Parse a DER formatted cert.
 * @param {Buffer} der
 * @returns {Object|null}
 */

x509.parse = function parse(der) {
  try {
    return ASN1.parseCert(der);
  } catch (e) {
    throw new Error('Could not parse DER certificate.');
  }
};

/**
 * Get cert public key.
 * @param {Object} cert
 * @returns {Object|null}
 */

x509.getPublicKey = function getPublicKey(cert) {
  var alg = x509.getKeyAlgorithm(cert);
  var key = cert.tbs.pubkey.pubkey;
  var params = cert.tbs.pubkey.alg.params;
  var curve = null;

  if (alg.key === 'ecdsa') {
    if (!params) throw new Error('No curve selected for ECDSA (cert).');

    curve = x509.getCurve(params);
  }

  return {
    alg: alg.key,
    data: key,
    params: params,
    curve: curve
  };
};

/**
 * Verify cert expiration time.
 * @param {Object} cert
 * @returns {Boolean}
 */

x509.verifyTime = function verifyTime(cert) {
  var time = cert.tbs.validity;
  var now = util.now();
  return now > time.notBefore && now < time.notAfter;
};

/**
 * Get signature key info from cert chain.
 * @param {Buffer} key
 * @param {Buffer[]} chain
 * @returns {Object}
 */

x509.getSigningKey = function getSigningKey(key, chain) {
  assert(chain.length !== 0, 'No chain available.');

  if (typeof key === 'string') {
    var curve = null;

    key = PEM.decode(key);

    if (key.alg === 'ecdsa') {
      if (!key.params) throw new Error('No curve selected for ECDSA (key).');

      curve = x509.getCurve(key.params);
    }

    key = {
      alg: key.alg,
      data: key.data,
      params: key.params,
      curve: curve
    };
  } else {
    var cert = x509.parse(chain[0]);
    var pub = x509.getPublicKey(cert);

    key = {
      alg: pub.alg,
      data: key,
      params: pub.params,
      curve: pub.curve
    };
  }

  return key;
};

/**
 * Sign a hash with the chain signing key.
 * @param {String} hash
 * @param {Buffer} msg
 * @param {Buffer} key
 * @param {Buffer[]} chain
 * @returns {Buffer}
 */

x509.signSubject = function signSubject(hash, msg, key, chain) {
  var priv = x509.getSigningKey(key, chain);
  return pk.sign(hash, msg, priv);
};

/**
 * Get chain verification key.
 * @param {Buffer[]} chain
 * @returns {Object|null}
 */

x509.getVerifyKey = function getVerifyKey(chain) {
  if (chain.length === 0) throw new Error('No verify key available (cert chain).');

  var cert = x509.parse(chain[0]);

  return x509.getPublicKey(cert);
};

/**
 * Verify a sighash against chain verification key.
 * @param {String} hash
 * @param {Buffer} msg
 * @param {Buffer} sig
 * @param {Buffer[]} chain
 * @returns {Boolean}
 */

x509.verifySubject = function verifySubject(hash, msg, sig, chain) {
  var key = x509.getVerifyKey(chain);
  return pk.verify(hash, msg, sig, key);
};

/**
 * Parse certificate chain.
 * @param {Buffer[]} chain
 * @returns {Object[]}
 */

x509.parseChain = function parseChain(chain) {
  var certs = [];

  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(chain), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var item = _step4.value;

      var cert = x509.parse(item);
      certs.push(cert);
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

  return certs;
};

/**
 * Verify all expiration times in a certificate chain.
 * @param {Object[]} chain
 * @returns {Boolean}
 */

x509.verifyTimes = function verifyTimes(chain) {
  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = (0, _getIterator3.default)(chain), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var cert = _step5.value;

      if (!x509.verifyTime(cert)) return false;
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

  return true;
};

/**
 * Verify that at least one parent
 * cert in the chain is trusted.
 * @param {Object[]} chain
 * @returns {Boolean}
 */

x509.verifyTrust = function verifyTrust(chain) {
  // If trust hasn't been
  // setup, just return.
  if (x509.allowUntrusted) return true;

  // Make sure we trust one
  // of the certs in the chain.
  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(chain), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var cert = _step6.value;

      // If any certificate in the chain
      // is trusted, assume we also trust
      // the parent.
      if (x509.isTrusted(cert)) return true;
    }

    // No trusted certs present.
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

  return false;
};

/**
 * Verify certificate chain.
 * @param {Object[]} certs
 */

x509.verifyChain = function verifyChain(certs) {
  var chain = x509.parseChain(certs);

  // Parse certificates and
  // check validity time.
  if (!x509.verifyTimes(chain)) throw new Error('Invalid certificate times.');

  // Verify signatures.
  for (var i = 1; i < chain.length; i++) {
    var child = chain[i - 1];
    var parent = chain[i];
    var alg = x509.getSigAlgorithm(child);
    var key = x509.getPublicKey(parent);
    var msg = child.tbs.raw;
    var sig = child.sig;

    if (!pk.verify(alg.hash, msg, sig, key)) throw new Error(alg.key + ' verification failed for chain.');
  }

  // Make sure we trust one
  // of the certs in the chain.
  if (!x509.verifyTrust(chain)) throw new Error('Certificate chain is untrusted.');

  return true;
};

/*
 * Load trusted certs.
 */

x509.setFingerprints(certs);