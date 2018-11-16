/*!
 * protowriter.js - protobufs for bcoin
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

/**
 * @module utils/protobuf
 */

var _isSafeInteger = require('babel-runtime/core-js/number/is-safe-integer');

var _isSafeInteger2 = _interopRequireDefault(_isSafeInteger);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var BufferWriter = require('../utils/writer');

/*
 * Constants
 */

var wireType = {
  VARINT: 0,
  FIXED64: 1,
  DELIMITED: 2,
  START_GROUP: 3,
  END_GROUP: 4,
  FIXED32: 5
};

/**
 * ProtoBuf Writer
 * @alias module:utils.ProtoWriter
 * @constructor
 */

function ProtoWriter() {
  if (!(this instanceof ProtoWriter)) return new ProtoWriter();

  BufferWriter.call(this);
}

(0, _setPrototypeOf2.default)(ProtoWriter.prototype, BufferWriter.prototype);

ProtoWriter.prototype.writeVarint = function writeVarint(num) {
  var size = sizeVarint(num);

  // Avoid an extra allocation until
  // we make bufferwriter more hackable.
  // More insanity here...
  switch (size) {
    case 6:
      {
        var value = slipVarint(num);
        this.writeU32BE(value / 0x10000 | 0);
        this.writeU16BE(value & 0xffff);
        break;
      }
    case 5:
      {
        var _value = slipVarint(num);
        this.writeU32BE(_value / 0x100 | 0);
        this.writeU8(_value & 0xff);
        break;
      }
    case 4:
      {
        var _value2 = slipVarint(num);
        this.writeU32BE(_value2);
        break;
      }
    case 3:
      {
        var _value3 = slipVarint(num);
        this.writeU16BE(_value3 >> 8);
        this.writeU8(_value3 & 0xff);
        break;
      }
    case 2:
      {
        var _value4 = slipVarint(num);
        this.writeU16BE(_value4);
        break;
      }
    case 1:
      {
        var _value5 = slipVarint(num);
        this.writeU8(_value5);
        break;
      }
    default:
      {
        var _value6 = Buffer.allocUnsafe(size);
        _writeVarint(_value6, num, 0);
        this.writeBytes(_value6);
        break;
      }
  }
};

ProtoWriter.prototype.writeFieldVarint = function writeFieldVarint(tag, value) {
  var header = tag << 3 | wireType.VARINT;
  this.writeVarint(header);
  this.writeVarint(value);
};

ProtoWriter.prototype.writeFieldU64 = function writeFieldU64(tag, value) {
  assert((0, _isSafeInteger2.default)(value));
  this.writeFieldVarint(tag, value);
};

ProtoWriter.prototype.writeFieldU32 = function writeFieldU32(tag, value) {
  assert(value <= 0xffffffff);
  this.writeFieldVarint(tag, value);
};

ProtoWriter.prototype.writeFieldBytes = function writeFieldBytes(tag, data) {
  var header = tag << 3 | wireType.DELIMITED;
  this.writeVarint(header);
  this.writeVarint(data.length);
  this.writeBytes(data);
};

ProtoWriter.prototype.writeFieldString = function writeFieldString(tag, data, enc) {
  if (typeof data === 'string') data = Buffer.from(data, enc || 'utf8');
  this.writeFieldBytes(tag, data);
};

/*
 * Encoding
 */

function _writeVarint(data, num, off) {
  assert((0, _isSafeInteger2.default)(num), 'Number exceeds 2^53-1.');

  do {
    assert(off < data.length);
    var ch = num & 0x7f;
    num -= num % 0x80;
    num /= 0x80;
    if (num !== 0) ch |= 0x80;
    data[off] = ch;
    off++;
  } while (num > 0);

  return off;
};

function slipVarint(num) {
  assert((0, _isSafeInteger2.default)(num), 'Number exceeds 2^53-1.');

  var data = 0;
  var size = 0;

  do {
    assert(size < 7);
    var ch = num & 0x7f;
    num -= num % 0x80;
    num /= 0x80;
    if (num !== 0) ch |= 0x80;
    data *= 256;
    data += ch;
    size++;
  } while (num > 0);

  return data;
}

function sizeVarint(num) {
  assert((0, _isSafeInteger2.default)(num), 'Number exceeds 2^53-1.');

  var size = 0;

  do {
    num -= num % 0x80;
    num /= 0x80;
    size++;
  } while (num > 0);

  return size;
};

/*
 * Expose
 */

module.exports = ProtoWriter;