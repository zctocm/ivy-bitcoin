/*!
 * coinview.js - coin viewpoint object for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Coins = require('./coins');
var UndoCoins = require('./undocoins');
var CoinEntry = require('./coinentry');

/**
 * Represents a coin viewpoint:
 * a snapshot of {@link Coins} objects.
 * @alias module:coins.CoinView
 * @constructor
 * @property {Object} map
 * @property {UndoCoins} undo
 */

function CoinView() {
  if (!(this instanceof CoinView)) return new CoinView();

  this.map = new _map2.default();
  this.undo = new UndoCoins();
}

/**
 * Get coins.
 * @param {Hash} hash
 * @returns {Coins} coins
 */

CoinView.prototype.get = function get(hash) {
  return this.map.get(hash);
};

/**
 * Test whether the view has an entry.
 * @param {Hash} hash
 * @returns {Boolean}
 */

CoinView.prototype.has = function has(hash) {
  return this.map.has(hash);
};

/**
 * Add coins to the collection.
 * @param {Hash} hash
 * @param {Coins} coins
 * @returns {Coins}
 */

CoinView.prototype.add = function add(hash, coins) {
  this.map.set(hash, coins);
  return coins;
};

/**
 * Ensure existence of coins object in the collection.
 * @param {Hash} hash
 * @returns {Coins}
 */

CoinView.prototype.ensure = function ensure(hash) {
  var coins = this.map.get(hash);

  if (coins) return coins;

  return this.add(hash, new Coins());
};

/**
 * Remove coins from the collection.
 * @param {Coins} coins
 * @returns {Coins|null}
 */

CoinView.prototype.remove = function remove(hash) {
  var coins = this.map.get(hash);

  if (!coins) return null;

  this.map.delete(hash);

  return coins;
};

/**
 * Add a tx to the collection.
 * @param {TX} tx
 * @param {Number} height
 * @returns {Coins}
 */

CoinView.prototype.addTX = function addTX(tx, height) {
  var hash = tx.hash('hex');
  var coins = Coins.fromTX(tx, height);
  return this.add(hash, coins);
};

/**
 * Remove a tx from the collection.
 * @param {TX} tx
 * @param {Number} height
 * @returns {Coins}
 */

CoinView.prototype.removeTX = function removeTX(tx, height) {
  var hash = tx.hash('hex');
  var coins = Coins.fromTX(tx, height);

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(coins.outputs.values()), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var coin = _step.value;

      coin.spent = true;
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

  return this.add(hash, coins);
};

/**
 * Add an entry to the collection.
 * @param {Outpoint} prevout
 * @param {CoinEntry} coin
 * @returns {CoinEntry|null}
 */

CoinView.prototype.addEntry = function addEntry(prevout, coin) {
  var hash = prevout.hash,
      index = prevout.index;

  var coins = this.ensure(hash);
  return coins.add(index, coin);
};

/**
 * Add a coin to the collection.
 * @param {Coin} coin
 * @returns {CoinEntry|null}
 */

CoinView.prototype.addCoin = function addCoin(coin) {
  var coins = this.ensure(coin.hash);
  return coins.addCoin(coin);
};

/**
 * Add an output to the collection.
 * @param {Outpoint} prevout
 * @param {Output} output
 * @returns {CoinEntry|null}
 */

CoinView.prototype.addOutput = function addOutput(prevout, output) {
  var hash = prevout.hash,
      index = prevout.index;

  var coins = this.ensure(hash);
  return coins.addOutput(index, output);
};

/**
 * Add an output to the collection by output index.
 * @param {TX} tx
 * @param {Number} index
 * @param {Number} height
 * @returns {CoinEntry|null}
 */

CoinView.prototype.addIndex = function addIndex(tx, index, height) {
  var hash = tx.hash('hex');
  var coins = this.ensure(hash);
  return coins.addIndex(tx, index, height);
};

/**
 * Spend an output.
 * @param {Outpoint} prevout
 * @returns {CoinEntry|null}
 */

CoinView.prototype.spendEntry = function spendEntry(prevout) {
  var hash = prevout.hash,
      index = prevout.index;

  var coins = this.get(hash);

  if (!coins) return null;

  var coin = coins.spend(index);

  if (!coin) return null;

  this.undo.push(coin);

  return coin;
};

/**
 * Remove an output.
 * @param {Outpoint} prevout
 * @returns {CoinEntry|null}
 */

CoinView.prototype.removeEntry = function removeEntry(prevout) {
  var hash = prevout.hash,
      index = prevout.index;

  var coins = this.get(hash);

  if (!coins) return null;

  return coins.remove(index);
};

/**
 * Test whether the view has an entry by prevout.
 * @param {Outpoint} prevout
 * @returns {Boolean}
 */

CoinView.prototype.hasEntry = function hasEntry(prevout) {
  var hash = prevout.hash,
      index = prevout.index;

  var coins = this.get(hash);

  if (!coins) return false;

  return coins.has(index);
};

/**
 * Get a single entry by prevout.
 * @param {Outpoint} prevout
 * @returns {CoinEntry|null}
 */

CoinView.prototype.getEntry = function getEntry(prevout) {
  var hash = prevout.hash,
      index = prevout.index;

  var coins = this.get(hash);

  if (!coins) return null;

  return coins.get(index);
};

/**
 * Test whether an entry has been spent by prevout.
 * @param {Outpoint} prevout
 * @returns {Boolean}
 */

CoinView.prototype.isUnspent = function isUnspent(prevout) {
  var hash = prevout.hash,
      index = prevout.index;

  var coins = this.get(hash);

  if (!coins) return false;

  return coins.isUnspent(index);
};

/**
 * Get a single coin by prevout.
 * @param {Outpoint} prevout
 * @returns {Coin|null}
 */

CoinView.prototype.getCoin = function getCoin(prevout) {
  var coins = this.get(prevout.hash);

  if (!coins) return null;

  return coins.getCoin(prevout);
};

/**
 * Get a single output by prevout.
 * @param {Outpoint} prevout
 * @returns {Output|null}
 */

CoinView.prototype.getOutput = function getOutput(prevout) {
  var hash = prevout.hash,
      index = prevout.index;

  var coins = this.get(hash);

  if (!coins) return null;

  return coins.getOutput(index);
};

/**
 * Get coins height by prevout.
 * @param {Outpoint} prevout
 * @returns {Number}
 */

CoinView.prototype.getHeight = function getHeight(prevout) {
  var coin = this.getEntry(prevout);

  if (!coin) return -1;

  return coin.height;
};

/**
 * Get coins coinbase flag by prevout.
 * @param {Outpoint} prevout
 * @returns {Boolean}
 */

CoinView.prototype.isCoinbase = function isCoinbase(prevout) {
  var coin = this.getEntry(prevout);

  if (!coin) return false;

  return coin.coinbase;
};

/**
 * Test whether the view has an entry by input.
 * @param {Input} input
 * @returns {Boolean}
 */

CoinView.prototype.hasEntryFor = function hasEntryFor(input) {
  return this.hasEntry(input.prevout);
};

/**
 * Get a single entry by input.
 * @param {Input} input
 * @returns {CoinEntry|null}
 */

CoinView.prototype.getEntryFor = function getEntryFor(input) {
  return this.getEntry(input.prevout);
};

/**
 * Test whether an entry has been spent by input.
 * @param {Input} input
 * @returns {Boolean}
 */

CoinView.prototype.isUnspentFor = function isUnspentFor(input) {
  return this.isUnspent(input.prevout);
};

/**
 * Get a single coin by input.
 * @param {Input} input
 * @returns {Coin|null}
 */

CoinView.prototype.getCoinFor = function getCoinFor(input) {
  return this.getCoin(input.prevout);
};

/**
 * Get a single output by input.
 * @param {Input} input
 * @returns {Output|null}
 */

CoinView.prototype.getOutputFor = function getOutputFor(input) {
  return this.getOutput(input.prevout);
};

/**
 * Get coins height by input.
 * @param {Input} input
 * @returns {Number}
 */

CoinView.prototype.getHeightFor = function getHeightFor(input) {
  return this.getHeight(input.prevout);
};

/**
 * Get coins coinbase flag by input.
 * @param {Input} input
 * @returns {Boolean}
 */

CoinView.prototype.isCoinbaseFor = function isCoinbaseFor(input) {
  return this.isCoinbase(input.prevout);
};

/**
 * Retrieve coins from database.
 * @method
 * @param {ChainDB} db
 * @param {Outpoint} prevout
 * @returns {Promise} - Returns {@link CoinEntry}.
 */

CoinView.prototype.readCoin = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(db, prevout) {
    var cache, coin;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            cache = this.getEntry(prevout);

            if (!cache) {
              _context.next = 3;
              break;
            }

            return _context.abrupt('return', cache);

          case 3:
            _context.next = 5;
            return db.readCoin(prevout);

          case 5:
            coin = _context.sent;

            if (coin) {
              _context.next = 8;
              break;
            }

            return _context.abrupt('return', null);

          case 8:
            return _context.abrupt('return', this.addEntry(prevout, coin));

          case 9:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function readCoin(_x, _x2) {
    return _ref.apply(this, arguments);
  }

  return readCoin;
}();

/**
 * Read all input coins into unspent map.
 * @method
 * @param {ChainDB} db
 * @param {TX} tx
 * @returns {Promise} - Returns {Boolean}.
 */

CoinView.prototype.readInputs = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(db, tx) {
    var found, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, _ref3, prevout;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            found = true;
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context2.prev = 4;
            _iterator2 = (0, _getIterator3.default)(tx.inputs);

          case 6:
            if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
              _context2.next = 16;
              break;
            }

            _ref3 = _step2.value;
            prevout = _ref3.prevout;
            _context2.next = 11;
            return this.readCoin(db, prevout);

          case 11:
            if (_context2.sent) {
              _context2.next = 13;
              break;
            }

            found = false;

          case 13:
            _iteratorNormalCompletion2 = true;
            _context2.next = 6;
            break;

          case 16:
            _context2.next = 22;
            break;

          case 18:
            _context2.prev = 18;
            _context2.t0 = _context2['catch'](4);
            _didIteratorError2 = true;
            _iteratorError2 = _context2.t0;

          case 22:
            _context2.prev = 22;
            _context2.prev = 23;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 25:
            _context2.prev = 25;

            if (!_didIteratorError2) {
              _context2.next = 28;
              break;
            }

            throw _iteratorError2;

          case 28:
            return _context2.finish(25);

          case 29:
            return _context2.finish(22);

          case 30:
            return _context2.abrupt('return', found);

          case 31:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[4, 18, 22, 30], [23,, 25, 29]]);
  }));

  function readInputs(_x3, _x4) {
    return _ref2.apply(this, arguments);
  }

  return readInputs;
}();

/**
 * Spend coins for transaction.
 * @method
 * @param {ChainDB} db
 * @param {TX} tx
 * @returns {Promise} - Returns {Boolean}.
 */

CoinView.prototype.spendInputs = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(db, tx) {
    var i, len, jobs, prevout, coins, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, coin;

    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            i = 0;

          case 1:
            if (!(i < tx.inputs.length)) {
              _context3.next = 38;
              break;
            }

            len = Math.min(i + 4, tx.inputs.length);
            jobs = [];


            for (; i < len; i++) {
              prevout = tx.inputs[i].prevout;

              jobs.push(this.readCoin(db, prevout));
            }

            _context3.next = 7;
            return _promise2.default.all(jobs);

          case 7:
            coins = _context3.sent;
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context3.prev = 11;
            _iterator3 = (0, _getIterator3.default)(coins);

          case 13:
            if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
              _context3.next = 22;
              break;
            }

            coin = _step3.value;

            if (!(!coin || coin.spent)) {
              _context3.next = 17;
              break;
            }

            return _context3.abrupt('return', false);

          case 17:

            coin.spent = true;
            this.undo.push(coin);

          case 19:
            _iteratorNormalCompletion3 = true;
            _context3.next = 13;
            break;

          case 22:
            _context3.next = 28;
            break;

          case 24:
            _context3.prev = 24;
            _context3.t0 = _context3['catch'](11);
            _didIteratorError3 = true;
            _iteratorError3 = _context3.t0;

          case 28:
            _context3.prev = 28;
            _context3.prev = 29;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 31:
            _context3.prev = 31;

            if (!_didIteratorError3) {
              _context3.next = 34;
              break;
            }

            throw _iteratorError3;

          case 34:
            return _context3.finish(31);

          case 35:
            return _context3.finish(28);

          case 36:
            _context3.next = 1;
            break;

          case 38:
            return _context3.abrupt('return', true);

          case 39:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this, [[11, 24, 28, 36], [29,, 31, 35]]);
  }));

  function spendInputs(_x5, _x6) {
    return _ref4.apply(this, arguments);
  }

  return spendInputs;
}();

/**
 * Calculate serialization size.
 * @returns {Number}
 */

CoinView.prototype.getSize = function getSize(tx) {
  var size = 0;

  size += tx.inputs.length;

  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(tx.inputs), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var _ref5 = _step4.value;
      var prevout = _ref5.prevout;

      var coin = this.getEntry(prevout);

      if (!coin) continue;

      size += coin.getSize();
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

  return size;
};

/**
 * Write coin data to buffer writer
 * as it pertains to a transaction.
 * @param {BufferWriter} bw
 * @param {TX} tx
 */

CoinView.prototype.toWriter = function toWriter(bw, tx) {
  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = (0, _getIterator3.default)(tx.inputs), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var _ref6 = _step5.value;
      var prevout = _ref6.prevout;

      var coin = this.getEntry(prevout);

      if (!coin) {
        bw.writeU8(0);
        continue;
      }

      bw.writeU8(1);
      coin.toWriter(bw);
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

  return bw;
};

/**
 * Read serialized view data from a buffer
 * reader as it pertains to a transaction.
 * @private
 * @param {BufferReader} br
 * @param {TX} tx
 */

CoinView.prototype.fromReader = function fromReader(br, tx) {
  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(tx.inputs), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var _ref7 = _step6.value;
      var prevout = _ref7.prevout;

      if (br.readU8() === 0) continue;

      var coin = CoinEntry.fromReader(br);

      this.addEntry(prevout, coin);
    }
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

  return this;
};

/**
 * Read serialized view data from a buffer
 * reader as it pertains to a transaction.
 * @param {BufferReader} br
 * @param {TX} tx
 * @returns {CoinView}
 */

CoinView.fromReader = function fromReader(br, tx) {
  return new CoinView().fromReader(br, tx);
};

/*
 * Expose
 */

module.exports = CoinView;