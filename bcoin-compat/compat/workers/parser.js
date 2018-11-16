/*!
 * workers.js - worker processes for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var EventEmitter = require('events');
var packets = require('./packets');

/**
 * Parser
 * @alias module:workers.Parser
 * @constructor
 */

function Parser() {
  if (!(this instanceof Parser)) return new Parser();

  EventEmitter.call(this);

  this.waiting = 9;
  this.header = null;
  this.pending = [];
  this.total = 0;
}

(0, _setPrototypeOf2.default)(Parser.prototype, EventEmitter.prototype);

Parser.prototype.feed = function feed(data) {
  this.total += data.length;
  this.pending.push(data);

  while (this.total >= this.waiting) {
    var chunk = this.read(this.waiting);
    this.parse(chunk);
  }
};

Parser.prototype.read = function read(size) {
  assert(this.total >= size, 'Reading too much.');

  if (size === 0) return Buffer.alloc(0);

  var pending = this.pending[0];

  if (pending.length > size) {
    var _chunk = pending.slice(0, size);
    this.pending[0] = pending.slice(size);
    this.total -= _chunk.length;
    return _chunk;
  }

  if (pending.length === size) {
    var _chunk2 = this.pending.shift();
    this.total -= _chunk2.length;
    return _chunk2;
  }

  var chunk = Buffer.allocUnsafe(size);
  var off = 0;

  while (off < chunk.length) {
    var _pending = this.pending[0];
    var len = _pending.copy(chunk, off);
    if (len === _pending.length) this.pending.shift();else this.pending[0] = _pending.slice(len);
    off += len;
  }

  assert.strictEqual(off, chunk.length);

  this.total -= chunk.length;

  return chunk;
};

Parser.prototype.parse = function parse(data) {
  var header = this.header;

  if (!header) {
    try {
      header = this.parseHeader(data);
    } catch (e) {
      this.emit('error', e);
      return;
    }

    this.header = header;
    this.waiting = header.size + 1;

    return;
  }

  this.waiting = 9;
  this.header = null;

  var packet = void 0;
  try {
    packet = this.parsePacket(header, data);
  } catch (e) {
    this.emit('error', e);
    return;
  }

  if (data[data.length - 1] !== 0x0a) {
    this.emit('error', new Error('No trailing newline.'));
    return;
  }

  packet.id = header.id;

  this.emit('packet', packet);
};

Parser.prototype.parseHeader = function parseHeader(data) {
  var id = data.readUInt32LE(0, true);
  var cmd = data.readUInt8(4, true);
  var size = data.readUInt32LE(5, true);
  return new Header(id, cmd, size);
};

Parser.prototype.parsePacket = function parsePacket(header, data) {
  switch (header.cmd) {
    case packets.types.ENV:
      return packets.EnvPacket.fromRaw(data);
    case packets.types.EVENT:
      return packets.EventPacket.fromRaw(data);
    case packets.types.LOG:
      return packets.LogPacket.fromRaw(data);
    case packets.types.ERROR:
      return packets.ErrorPacket.fromRaw(data);
    case packets.types.ERRORRESULT:
      return packets.ErrorResultPacket.fromRaw(data);
    case packets.types.CHECK:
      return packets.CheckPacket.fromRaw(data);
    case packets.types.CHECKRESULT:
      return packets.CheckResultPacket.fromRaw(data);
    case packets.types.SIGN:
      return packets.SignPacket.fromRaw(data);
    case packets.types.SIGNRESULT:
      return packets.SignResultPacket.fromRaw(data);
    case packets.types.CHECKINPUT:
      return packets.CheckInputPacket.fromRaw(data);
    case packets.types.CHECKINPUTRESULT:
      return packets.CheckInputResultPacket.fromRaw(data);
    case packets.types.SIGNINPUT:
      return packets.SignInputPacket.fromRaw(data);
    case packets.types.SIGNINPUTRESULT:
      return packets.SignInputResultPacket.fromRaw(data);
    case packets.types.ECVERIFY:
      return packets.ECVerifyPacket.fromRaw(data);
    case packets.types.ECVERIFYRESULT:
      return packets.ECVerifyResultPacket.fromRaw(data);
    case packets.types.ECSIGN:
      return packets.ECSignPacket.fromRaw(data);
    case packets.types.ECSIGNRESULT:
      return packets.ECSignResultPacket.fromRaw(data);
    case packets.types.MINE:
      return packets.MinePacket.fromRaw(data);
    case packets.types.MINERESULT:
      return packets.MineResultPacket.fromRaw(data);
    case packets.types.SCRYPT:
      return packets.ScryptPacket.fromRaw(data);
    case packets.types.SCRYPTRESULT:
      return packets.ScryptResultPacket.fromRaw(data);
    default:
      throw new Error('Unknown packet.');
  }
};

/**
 * Header
 * @constructor
 * @ignore
 */

function Header(id, cmd, size) {
  this.id = id;
  this.cmd = cmd;
  this.size = size;
}

/*
 * Expose
 */

module.exports = Parser;