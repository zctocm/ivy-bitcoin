/*!
 * paymentdetails.js - bip70 paymentdetails for bcoin
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var util = require('../utils/util');
var Output = require('../primitives/output');
var ProtoReader = require('../utils/protoreader');
var ProtoWriter = require('../utils/protowriter');

/**
 * Represents BIP70 payment details.
 * @alias module:bip70.PaymentDetails
 * @constructor
 * @param {Object?} options
 * @property {String|null} network
 * @property {Output[]} outputs
 * @property {Number} time
 * @property {Number} expires
 * @property {String|null} memo
 * @property {String|null} paymentUrl
 * @property {Buffer|null} merchantData
 */

function PaymentDetails(options) {
  if (!(this instanceof PaymentDetails)) return new PaymentDetails(options);

  this.network = null;
  this.outputs = [];
  this.time = util.now();
  this.expires = -1;
  this.memo = null;
  this.paymentUrl = null;
  this.merchantData = null;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from options.
 * @private
 * @param {Object} options
 * @returns {PaymentDetails}
 */

PaymentDetails.prototype.fromOptions = function fromOptions(options) {
  if (options.network != null) {
    assert(typeof options.network === 'string');
    this.network = options.network;
  }

  if (options.outputs) {
    assert(Array.isArray(options.outputs));
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = (0, _getIterator3.default)(options.outputs), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var item = _step.value;

        var output = new Output(item);
        this.outputs.push(output);
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

  if (options.time != null) {
    assert(util.isInt(options.time));
    this.time = options.time;
  }

  if (options.expires != null) {
    assert(util.isInt(options.expires));
    this.expires = options.expires;
  }

  if (options.memo != null) {
    assert(typeof options.memo === 'string');
    this.memo = options.memo;
  }

  if (options.paymentUrl != null) {
    assert(typeof options.paymentUrl === 'string');
    this.paymentUrl = options.paymentUrl;
  }

  if (options.merchantData) this.setData(options.merchantData);

  return this;
};

/**
 * Instantiate payment details from options.
 * @param {Object} options
 * @returns {PaymentDetails}
 */

PaymentDetails.fromOptions = function fromOptions(options) {
  return new PaymentDetails().fromOptions(options);
};

/**
 * Test whether the payment is expired.
 * @returns {Boolean}
 */

PaymentDetails.prototype.isExpired = function isExpired() {
  if (this.expires === -1) return false;
  return util.now() > this.expires;
};

/**
 * Set payment details.
 * @param {Object} data
 * @param {String?} enc
 */

PaymentDetails.prototype.setData = function setData(data, enc) {
  if (data == null || Buffer.isBuffer(data)) {
    this.merchantData = data;
    return;
  }

  if (typeof data !== 'string') {
    assert(!enc || enc === 'json');
    this.merchantData = Buffer.from((0, _stringify2.default)(data), 'utf8');
    return;
  }

  this.merchantData = Buffer.from(data, enc);
};

/**
 * Get payment details.
 * @param {String?} enc
 * @returns {String|Object|null}
 */

PaymentDetails.prototype.getData = function getData(enc) {
  var data = this.merchantData;

  if (!data) return null;

  if (!enc) return data;

  if (enc === 'json') {
    data = data.toString('utf8');
    try {
      data = JSON.parse(data);
    } catch (e) {
      return null;
    }
    return data;
  }

  return data.toString(enc);
};

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 * @returns {PaymentDetails}
 */

PaymentDetails.prototype.fromRaw = function fromRaw(data) {
  var br = new ProtoReader(data);

  this.network = br.readFieldString(1, true);

  while (br.nextTag() === 2) {
    var op = new ProtoReader(br.readFieldBytes(2));
    var output = new Output();
    output.value = op.readFieldU64(1, true);
    output.script.fromRaw(op.readFieldBytes(2, true));
    this.outputs.push(output);
  }

  this.time = br.readFieldU64(3);
  this.expires = br.readFieldU64(4, true);
  this.memo = br.readFieldString(5, true);
  this.paymentUrl = br.readFieldString(6, true);
  this.merchantData = br.readFieldBytes(7, true);

  return this;
};

/**
 * Instantiate payment details from serialized data.
 * @param {Buffer} data
 * @returns {PaymentDetails}
 */

PaymentDetails.fromRaw = function fromRaw(data, enc) {
  if (typeof data === 'string') data = Buffer.from(data, enc);
  return new PaymentDetails().fromRaw(data);
};

/**
 * Serialize the payment details (protobuf).
 * @returns {Buffer}
 */

PaymentDetails.prototype.toRaw = function toRaw() {
  var bw = new ProtoWriter();

  if (this.network != null) bw.writeFieldString(1, this.network);

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(this.outputs), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var output = _step2.value;

      var op = new ProtoWriter();
      op.writeFieldU64(1, output.value);
      op.writeFieldBytes(2, output.script.toRaw());
      bw.writeFieldBytes(2, op.render());
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

  bw.writeFieldU64(3, this.time);

  if (this.expires !== -1) bw.writeFieldU64(4, this.expires);

  if (this.memo != null) bw.writeFieldString(5, this.memo);

  if (this.paymentUrl != null) bw.writeFieldString(6, this.paymentUrl);

  if (this.merchantData) bw.writeFieldString(7, this.merchantData);

  return bw.render();
};

/*
 * Expose
 */

module.exports = PaymentDetails;