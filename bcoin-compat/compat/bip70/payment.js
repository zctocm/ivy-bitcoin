/*!
 * payment.js - bip70 payment for bcoin
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var Output = require('../primitives/output');
var TX = require('../primitives/tx');
var Script = require('../script/script');
var ProtoReader = require('../utils/protoreader');
var ProtoWriter = require('../utils/protowriter');
var PaymentDetails = require('./paymentdetails');

/**
 * Represents a BIP70 payment.
 * @alias module:bip70.Payment
 * @constructor
 * @param {Object?} options
 * @property {Buffer} merchantData
 * @property {TX[]} transactions
 * @property {Output[]} refundTo
 * @property {String|null} memo
 */

function Payment(options) {
  if (!(this instanceof Payment)) return new Payment(options);

  this.merchantData = null;
  this.transactions = [];
  this.refundTo = [];
  this.memo = null;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from options.
 * @private
 * @param {Object} options
 * @returns {Payment}
 */

Payment.prototype.fromOptions = function fromOptions(options) {
  if (options.merchantData) this.setData(options.merchantData);

  if (options.transactions) {
    assert(Array.isArray(options.transactions));
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = (0, _getIterator3.default)(options.transactions), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var item = _step.value;

        var tx = new TX(item);
        this.transactions.push(tx);
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

  if (options.refundTo) {
    assert(Array.isArray(options.refundTo));
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = (0, _getIterator3.default)(options.refundTo), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var _item = _step2.value;

        var output = new Output(_item);
        this.refundTo.push(output);
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
  }

  if (options.memo != null) {
    assert(typeof options.memo === 'string');
    this.memo = options.memo;
  }

  return this;
};

/**
 * Instantiate payment from options.
 * @param {Object} options
 * @returns {Payment}
 */

Payment.fromOptions = function fromOptions(options) {
  return new Payment().fromOptions(options);
};

/**
 * Set payment details.
 * @method
 * @alias Payment#setData
 * @param {Object} data
 * @param {String?} enc
 */

Payment.prototype.setData = PaymentDetails.prototype.setData;

/**
 * Get payment details.
 * @method
 * @alias Payment#getData
 * @param {String?} enc
 * @returns {String|Object|null}
 */

Payment.prototype.getData = PaymentDetails.prototype.getData;

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 * @returns {Payment}
 */

Payment.prototype.fromRaw = function fromRaw(data) {
  var br = new ProtoReader(data);

  this.merchantData = br.readFieldBytes(1, true);

  while (br.nextTag() === 2) {
    var tx = TX.fromRaw(br.readFieldBytes(2));
    this.transactions.push(tx);
  }

  while (br.nextTag() === 3) {
    var op = new ProtoReader(br.readFieldBytes(3));
    var output = new Output();
    output.value = op.readFieldU64(1, true);
    output.script = Script.fromRaw(op.readFieldBytes(2, true));
    this.refundTo.push(output);
  }

  this.memo = br.readFieldString(4, true);

  return this;
};

/**
 * Instantiate payment from serialized data.
 * @param {Buffer} data
 * @returns {Payment}
 */

Payment.fromRaw = function fromRaw(data, enc) {
  if (typeof data === 'string') data = Buffer.from(data, enc);
  return new Payment().fromRaw(data);
};

/**
 * Serialize the payment (protobuf).
 * @returns {Buffer}
 */

Payment.prototype.toRaw = function toRaw() {
  var bw = new ProtoWriter();

  if (this.merchantData) bw.writeFieldBytes(1, this.merchantData);

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(this.transactions), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var tx = _step3.value;

      bw.writeFieldBytes(2, tx.toRaw());
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

  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(this.refundTo), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var output = _step4.value;

      var op = new ProtoWriter();
      op.writeFieldU64(1, output.value);
      op.writeFieldBytes(2, output.script.toRaw());
      bw.writeFieldBytes(3, op.render());
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

  if (this.memo != null) bw.writeFieldString(4, this.memo);

  return bw.render();
};

/*
 * Expose
 */

module.exports = Payment;