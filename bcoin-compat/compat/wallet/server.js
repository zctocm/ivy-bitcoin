/*!
 * server.js - wallet server for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var WalletDB = require('./walletdb');
var WorkerPool = require('../workers/workerpool');
var Config = require('../node/config');
var Logger = require('../node/logger');
var Client = require('./client');

/**
 * @exports wallet/server
 */

var server = exports;

/**
 * Create a wallet server.
 * @param {Object} options
 * @returns {WalletDB}
 */

server.create = function create(options) {
  var config = new Config('bcoin');
  var logger = new Logger('debug');

  config.inject(options);
  config.load(options);

  if (options.config) config.open('wallet.conf');

  if (config.has('logger')) logger = config.obj('logger');

  var client = new Client({
    network: config.network,
    uri: config.str('node-uri'),
    apiKey: config.str('node-api-key')
  });

  logger.set({
    filename: config.bool('log-file') ? config.location('wallet.log') : null,
    level: config.str('log-level'),
    console: config.bool('log-console'),
    shrink: config.bool('log-shrink')
  });

  var workers = new WorkerPool({
    enabled: config.str('workers-enabled'),
    size: config.uint('workers-size'),
    timeout: config.uint('workers-timeout')
  });

  var wdb = new WalletDB({
    network: config.network,
    logger: logger,
    workers: workers,
    client: client,
    prefix: config.prefix,
    db: config.str('db'),
    maxFiles: config.uint('max-files'),
    cacheSize: config.mb('cache-size'),
    witness: config.bool('witness'),
    checkpoints: config.bool('checkpoints'),
    startHeight: config.uint('start-height'),
    wipeNoReally: config.bool('wipe-no-really'),
    apiKey: config.str('api-key'),
    walletAuth: config.bool('auth'),
    noAuth: config.bool('no-auth'),
    ssl: config.str('ssl'),
    host: config.str('host'),
    port: config.uint('port'),
    spv: config.bool('spv'),
    verify: config.bool('spv'),
    listen: true
  });

  wdb.on('error', function () {});

  workers.on('spawn', function (child) {
    logger.info('Spawning worker process: %d.', child.id);
  });

  workers.on('exit', function (code, child) {
    logger.warning('Worker %d exited: %s.', child.id, code);
  });

  workers.on('log', function (text, child) {
    logger.debug('Worker %d says:', child.id);
    logger.debug(text);
  });

  workers.on('error', function (err, child) {
    if (child) {
      logger.error('Worker %d error: %s', child.id, err.message);
      return;
    }
    wdb.emit('error', err);
  });

  return wdb;
};