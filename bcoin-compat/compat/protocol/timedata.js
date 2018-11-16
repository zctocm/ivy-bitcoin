/*!
 * timedata.js - time management for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var EventEmitter = require('events');
var util = require('../utils/util');

/**
 * An object which handles "adjusted time". This may not
 * look it, but this is actually a semi-consensus-critical
 * piece of code. It handles version packets from peers
 * and calculates what to offset our system clock's time by.
 * @alias module:protocol.TimeData
 * @constructor
 * @param {Number} [limit=200]
 * @property {Array} samples
 * @property {Object} known
 * @property {Number} limit
 * @property {Number} offset
 */

function TimeData(limit) {
  if (!(this instanceof TimeData)) return new TimeData(limit);

  EventEmitter.call(this);

  if (limit == null) limit = 200;

  this.samples = [];
  this.known = new _map2.default();
  this.limit = limit;
  this.offset = 0;
  this.checked = false;
}

(0, _setPrototypeOf2.default)(TimeData.prototype, EventEmitter.prototype);

/**
 * Add time data.
 * @param {String} id
 * @param {Number} time
 */

TimeData.prototype.add = function add(id, time) {
  if (this.samples.length >= this.limit) return;

  if (this.known.has(id)) return;

  var sample = time - util.now();

  this.known.set(id, sample);

  util.binaryInsert(this.samples, sample, compare);

  this.emit('sample', sample, this.samples.length);

  if (this.samples.length >= 5 && this.samples.length % 2 === 1) {
    var median = this.samples[this.samples.length >>> 1];

    if (Math.abs(median) >= 70 * 60) {
      if (!this.checked) {
        var match = false;

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = (0, _getIterator3.default)(this.samples), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var offset = _step.value;

            if (offset !== 0 && Math.abs(offset) < 5 * 60) {
              match = true;
              break;
            }
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

        if (!match) {
          this.checked = true;
          this.emit('mismatch');
        }
      }

      median = 0;
    }

    this.offset = median;
    this.emit('offset', this.offset);
  }
};

/**
 * Get the current adjusted time.
 * @returns {Number} Adjusted Time.
 */

TimeData.prototype.now = function now() {
  return util.now() + this.offset;
};

/**
 * Adjust a timestamp.
 * @param {Number} time
 * @returns {Number} Adjusted Time.
 */

TimeData.prototype.adjust = function adjust(time) {
  return time + this.offset;
};

/**
 * Unadjust a timestamp.
 * @param {Number} time
 * @returns {Number} Local Time.
 */

TimeData.prototype.local = function local(time) {
  return time - this.offset;
};

/**
 * Get the current adjusted time in milliseconds.
 * @returns {Number} Adjusted Time.
 */

TimeData.prototype.ms = function ms() {
  return util.ms() + this.offset * 1000;
};

/*
 * Helpers
 */

function compare(a, b) {
  return a - b;
}

/*
 * Expose
 */

module.exports = TimeData;