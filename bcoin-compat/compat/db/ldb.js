/**
 * ldb.js - database backend for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var LowlevelUp = require('./lowlevelup');
var backends = require('./backends');

/**
 * Create a database.
 * @alias module:db.LDB
 * @param {Object} options
 * @returns {LowlevelUp}
 */

function LDB(options) {
  var result = LDB.getBackend(options);
  var backend = result.backend;
  var location = result.location;

  return new LowlevelUp(backend, location, options);
}

/**
 * Get database name and extension based on options.
 * @param {String} db
 * @returns {Object}
 */

LDB.getName = function getName(db) {
  var name = void 0,
      ext = void 0;

  if (!db) db = 'memory';

  switch (db) {
    case 'ldb':
    case 'leveldb':
    case 'leveldown':
      name = 'leveldown';
      ext = 'ldb';
      break;
    case 'rdb':
    case 'rocksdb':
    case 'rocksdown':
      name = 'rocksdown';
      ext = 'rdb';
      break;
    case 'mdb':
    case 'lmdb':
      name = 'lmdb';
      ext = 'mdb';
      break;
    case 'mem':
    case 'memory':
    case 'rbt':
      name = 'memory';
      ext = 'mem';
      break;
    default:
      name = db;
      ext = 'db';
      break;
  }

  return [name, ext];
};

/**
 * Get target backend and location.
 * @param {Object} options
 * @returns {Object}
 */

LDB.getBackend = function getBackend(options) {
  var _LDB$getName = LDB.getName(options.db),
      _LDB$getName2 = (0, _slicedToArray3.default)(_LDB$getName, 2),
      name = _LDB$getName2[0],
      ext = _LDB$getName2[1];

  var backend = backends.get(name);
  var location = options.location;

  if (typeof location !== 'string') {
    assert(name === 'memory', 'Location required.');
    location = 'memory';
  }

  return {
    backend: backend,
    location: location + '.' + ext
  };
};

/*
 * Expose
 */

module.exports = LDB;