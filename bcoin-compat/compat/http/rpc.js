/*!
 * rpc.js - bitcoind-compatible json rpc for bcoin.
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _setImmediate2 = require('babel-runtime/core-js/set-immediate');

var _setImmediate3 = _interopRequireDefault(_setImmediate2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var util = require('../utils/util');
var co = require('../utils/co');
var digest = require('../crypto/digest');
var ccmp = require('../crypto/ccmp');
var common = require('../blockchain/common');
var secp256k1 = require('../crypto/secp256k1');
var Amount = require('../btc/amount');
var NetAddress = require('../primitives/netaddress');
var Script = require('../script/script');
var Address = require('../primitives/address');
var Block = require('../primitives/block');
var Headers = require('../primitives/headers');
var Input = require('../primitives/input');
var KeyRing = require('../primitives/keyring');
var MerkleBlock = require('../primitives/merkleblock');
var MTX = require('../primitives/mtx');
var Network = require('../protocol/network');
var Outpoint = require('../primitives/outpoint');
var Output = require('../primitives/output');
var TX = require('../primitives/tx');
var IP = require('../utils/ip');
var encoding = require('../utils/encoding');
var consensus = require('../protocol/consensus');
var Validator = require('../utils/validator');
var RPCBase = require('./rpcbase');
var pkg = require('../pkg');
var RPCError = RPCBase.RPCError;
var errs = RPCBase.errors;
var MAGIC_STRING = RPCBase.MAGIC_STRING;

/**
 * Bitcoin Core RPC
 * @alias module:http.RPC
 * @constructor
 * @param {Node} node
 */

function RPC(node) {
  if (!(this instanceof RPC)) return new RPC(node);

  RPCBase.call(this);

  assert(node, 'RPC requires a Node.');

  this.node = node;
  this.network = node.network;
  this.workers = node.workers;
  this.chain = node.chain;
  this.mempool = node.mempool;
  this.pool = node.pool;
  this.fees = node.fees;
  this.miner = node.miner;
  this.logger = node.logger.context('rpc');

  this.mining = false;
  this.procLimit = 0;
  this.attempt = null;
  this.lastActivity = 0;
  this.boundChain = false;
  this.nonce1 = 0;
  this.nonce2 = 0;
  this.merkleMap = new _map2.default();
  this.pollers = [];

  this.init();
}

(0, _setPrototypeOf2.default)(RPC.prototype, RPCBase.prototype);

RPC.prototype.init = function init() {
  this.add('stop', this.stop);
  this.add('help', this.help);

  this.add('getblockchaininfo', this.getBlockchainInfo);
  this.add('getbestblockhash', this.getBestBlockHash);
  this.add('getblockcount', this.getBlockCount);
  this.add('getblock', this.getBlock);
  this.add('getblockbyheight', this.getBlockByHeight);
  this.add('getblockhash', this.getBlockHash);
  this.add('getblockheader', this.getBlockHeader);
  this.add('getchaintips', this.getChainTips);
  this.add('getdifficulty', this.getDifficulty);
  this.add('getmempoolancestors', this.getMempoolAncestors);
  this.add('getmempooldescendants', this.getMempoolDescendants);
  this.add('getmempoolentry', this.getMempoolEntry);
  this.add('getmempoolinfo', this.getMempoolInfo);
  this.add('getrawmempool', this.getRawMempool);
  this.add('gettxout', this.getTXOut);
  this.add('gettxoutsetinfo', this.getTXOutSetInfo);
  this.add('pruneblockchain', this.pruneBlockchain);
  this.add('verifychain', this.verifyChain);

  this.add('invalidateblock', this.invalidateBlock);
  this.add('reconsiderblock', this.reconsiderBlock);

  this.add('getnetworkhashps', this.getNetworkHashPS);
  this.add('getmininginfo', this.getMiningInfo);
  this.add('prioritisetransaction', this.prioritiseTransaction);
  this.add('getwork', this.getWork);
  this.add('getworklp', this.getWorkLongpoll);
  this.add('getblocktemplate', this.getBlockTemplate);
  this.add('submitblock', this.submitBlock);
  this.add('verifyblock', this.verifyBlock);

  this.add('setgenerate', this.setGenerate);
  this.add('getgenerate', this.getGenerate);
  this.add('generate', this.generate);
  this.add('generatetoaddress', this.generateToAddress);

  this.add('estimatefee', this.estimateFee);
  this.add('estimatepriority', this.estimatePriority);
  this.add('estimatesmartfee', this.estimateSmartFee);
  this.add('estimatesmartpriority', this.estimateSmartPriority);

  this.add('getinfo', this.getInfo);
  this.add('validateaddress', this.validateAddress);
  this.add('createmultisig', this.createMultisig);
  this.add('createwitnessaddress', this.createWitnessAddress);
  this.add('verifymessage', this.verifyMessage);
  this.add('signmessagewithprivkey', this.signMessageWithPrivkey);

  this.add('setmocktime', this.setMockTime);

  this.add('getconnectioncount', this.getConnectionCount);
  this.add('ping', this.ping);
  this.add('getpeerinfo', this.getPeerInfo);
  this.add('addnode', this.addNode);
  this.add('disconnectnode', this.disconnectNode);
  this.add('getaddednodeinfo', this.getAddedNodeInfo);
  this.add('getnettotals', this.getNetTotals);
  this.add('getnetworkinfo', this.getNetworkInfo);
  this.add('setban', this.setBan);
  this.add('listbanned', this.listBanned);
  this.add('clearbanned', this.clearBanned);

  this.add('getrawtransaction', this.getRawTransaction);
  this.add('createrawtransaction', this.createRawTransaction);
  this.add('decoderawtransaction', this.decodeRawTransaction);
  this.add('decodescript', this.decodeScript);
  this.add('sendrawtransaction', this.sendRawTransaction);
  this.add('signrawtransaction', this.signRawTransaction);

  this.add('gettxoutproof', this.getTXOutProof);
  this.add('verifytxoutproof', this.verifyTXOutProof);

  this.add('getmemoryinfo', this.getMemoryInfo);
  this.add('setloglevel', this.setLogLevel);
};

/*
 * Overall control/query calls
 */

RPC.prototype.getInfo = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(args, help) {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getinfo');

          case 2:
            return _context.abrupt('return', {
              version: pkg.version,
              protocolversion: this.pool.options.version,
              walletversion: 0,
              balance: 0,
              blocks: this.chain.height,
              timeoffset: this.network.time.offset,
              connections: this.pool.peers.size(),
              proxy: '',
              difficulty: toDifficulty(this.chain.tip.bits),
              testnet: this.network !== Network.main,
              keypoololdest: 0,
              keypoolsize: 0,
              unlocked_until: 0,
              paytxfee: Amount.btc(this.network.feeRate, true),
              relayfee: Amount.btc(this.network.minRelay, true),
              errors: ''
            });

          case 3:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function getInfo(_x, _x2) {
    return _ref.apply(this, arguments);
  }

  return getInfo;
}();

RPC.prototype.help = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(args, _help) {
    var json;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (!(args.length === 0)) {
              _context2.next = 2;
              break;
            }

            return _context2.abrupt('return', 'Select a command.');

          case 2:
            json = {
              method: args[0],
              params: []
            };
            _context2.next = 5;
            return this.execute(json, true);

          case 5:
            return _context2.abrupt('return', _context2.sent);

          case 6:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function help(_x3, _x4) {
    return _ref2.apply(this, arguments);
  }

  return help;
}();

RPC.prototype.stop = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(args, help) {
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context3.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'stop');

          case 2:

            this.node.close().catch(function (err) {
              (0, _setImmediate3.default)(function () {
                throw err;
              });
            });

            return _context3.abrupt('return', 'Stopping.');

          case 4:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function stop(_x5, _x6) {
    return _ref3.apply(this, arguments);
  }

  return stop;
}();

/*
 * P2P networking
 */

RPC.prototype.getNetworkInfo = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(args, help) {
    var hosts, locals, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, local;

    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context4.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getnetworkinfo');

          case 2:
            hosts = this.pool.hosts;
            locals = [];
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context4.prev = 7;


            for (_iterator = (0, _getIterator3.default)(hosts.local.values()); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              local = _step.value;

              locals.push({
                address: local.addr.host,
                port: local.addr.port,
                score: local.score
              });
            }

            _context4.next = 15;
            break;

          case 11:
            _context4.prev = 11;
            _context4.t0 = _context4['catch'](7);
            _didIteratorError = true;
            _iteratorError = _context4.t0;

          case 15:
            _context4.prev = 15;
            _context4.prev = 16;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 18:
            _context4.prev = 18;

            if (!_didIteratorError) {
              _context4.next = 21;
              break;
            }

            throw _iteratorError;

          case 21:
            return _context4.finish(18);

          case 22:
            return _context4.finish(15);

          case 23:
            return _context4.abrupt('return', {
              version: pkg.version,
              subversion: this.pool.options.agent,
              protocolversion: this.pool.options.version,
              localservices: util.hex32(this.pool.options.services),
              localrelay: !this.pool.options.noRelay,
              timeoffset: this.network.time.offset,
              networkactive: this.pool.connected,
              connections: this.pool.peers.size(),
              networks: [],
              relayfee: Amount.btc(this.network.minRelay, true),
              incrementalfee: 0,
              localaddresses: locals,
              warnings: ''
            });

          case 24:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[7, 11, 15, 23], [16,, 18, 22]]);
  }));

  function getNetworkInfo(_x7, _x8) {
    return _ref4.apply(this, arguments);
  }

  return getNetworkInfo;
}();

RPC.prototype.addNode = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(args, help) {
    var valid, node, cmd, addr, peer;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            if (!(help || args.length !== 2)) {
              _context5.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'addnode "node" "add|remove|onetry"');

          case 2:
            valid = new Validator([args]);
            node = valid.str(0, '');
            cmd = valid.str(1, '');
            _context5.t0 = cmd;
            _context5.next = _context5.t0 === 'add' ? 8 : _context5.t0 === 'onetry' ? 10 : _context5.t0 === 'remove' ? 13 : 15;
            break;

          case 8:
            this.pool.hosts.addNode(node);
            ; // fall through

          case 10:
            addr = parseNetAddress(node, this.network);


            if (!this.pool.peers.get(addr.hostname)) {
              peer = this.pool.createOutbound(addr);

              this.pool.peers.add(peer);
            }

            return _context5.abrupt('break', 15);

          case 13:
            this.pool.hosts.removeNode(node);
            return _context5.abrupt('break', 15);

          case 15:
            return _context5.abrupt('return', null);

          case 16:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function addNode(_x9, _x10) {
    return _ref5.apply(this, arguments);
  }

  return addNode;
}();

RPC.prototype.disconnectNode = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(args, help) {
    var valid, str, addr, peer;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context6.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'disconnectnode "node"');

          case 2:
            valid = new Validator([args]);
            str = valid.str(0, '');
            addr = parseIP(str, this.network);
            peer = this.pool.peers.get(addr.hostname);


            if (peer) peer.destroy();

            return _context6.abrupt('return', null);

          case 8:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function disconnectNode(_x11, _x12) {
    return _ref6.apply(this, arguments);
  }

  return disconnectNode;
}();

RPC.prototype.getAddedNodeInfo = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(args, help) {
    var hosts, valid, addr, target, result, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, node, peer;

    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            if (!(help || args.length > 1)) {
              _context7.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getaddednodeinfo ( "node" )');

          case 2:
            hosts = this.pool.hosts;
            valid = new Validator([args]);
            addr = valid.str(0, '');
            target = void 0;

            if (args.length === 1) target = parseIP(addr, this.network);

            result = [];
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context7.prev = 11;
            _iterator2 = (0, _getIterator3.default)(hosts.nodes);

          case 13:
            if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
              _context7.next = 28;
              break;
            }

            node = _step2.value;

            if (!target) {
              _context7.next = 20;
              break;
            }

            if (!(node.host !== target.host)) {
              _context7.next = 18;
              break;
            }

            return _context7.abrupt('continue', 25);

          case 18:
            if (!(node.port !== target.port)) {
              _context7.next = 20;
              break;
            }

            return _context7.abrupt('continue', 25);

          case 20:
            peer = this.pool.peers.get(node.hostname);

            if (!(!peer || !peer.connected)) {
              _context7.next = 24;
              break;
            }

            result.push({
              addednode: node.hostname,
              connected: false,
              addresses: []
            });
            return _context7.abrupt('continue', 25);

          case 24:

            result.push({
              addednode: node.hostname,
              connected: peer.connected,
              addresses: [{
                address: peer.hostname(),
                connected: peer.outbound ? 'outbound' : 'inbound'
              }]
            });

          case 25:
            _iteratorNormalCompletion2 = true;
            _context7.next = 13;
            break;

          case 28:
            _context7.next = 34;
            break;

          case 30:
            _context7.prev = 30;
            _context7.t0 = _context7['catch'](11);
            _didIteratorError2 = true;
            _iteratorError2 = _context7.t0;

          case 34:
            _context7.prev = 34;
            _context7.prev = 35;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 37:
            _context7.prev = 37;

            if (!_didIteratorError2) {
              _context7.next = 40;
              break;
            }

            throw _iteratorError2;

          case 40:
            return _context7.finish(37);

          case 41:
            return _context7.finish(34);

          case 42:
            if (!(target && result.length === 0)) {
              _context7.next = 44;
              break;
            }

            throw new RPCError(errs.CLIENT_NODE_NOT_ADDED, 'Node has not been added.');

          case 44:
            return _context7.abrupt('return', result);

          case 45:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this, [[11, 30, 34, 42], [35,, 37, 41]]);
  }));

  function getAddedNodeInfo(_x13, _x14) {
    return _ref7.apply(this, arguments);
  }

  return getAddedNodeInfo;
}();

RPC.prototype.getConnectionCount = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(args, help) {
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context8.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getconnectioncount');

          case 2:
            return _context8.abrupt('return', this.pool.peers.size());

          case 3:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  function getConnectionCount(_x15, _x16) {
    return _ref8.apply(this, arguments);
  }

  return getConnectionCount;
}();

RPC.prototype.getNetTotals = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(args, help) {
    var sent, recv, peer;
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            sent = 0;
            recv = 0;

            if (!(help || args.length > 0)) {
              _context9.next = 4;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getnettotals');

          case 4:

            for (peer = this.pool.peers.head(); peer; peer = peer.next) {
              sent += peer.socket.bytesWritten;
              recv += peer.socket.bytesRead;
            }

            return _context9.abrupt('return', {
              totalbytesrecv: recv,
              totalbytessent: sent,
              timemillis: util.ms()
            });

          case 6:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this);
  }));

  function getNetTotals(_x17, _x18) {
    return _ref9.apply(this, arguments);
  }

  return getNetTotals;
}();

RPC.prototype.getPeerInfo = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(args, help) {
    var peers, peer, offset, hashes, hash, str;
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context10.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getpeerinfo');

          case 2:
            peers = [];


            for (peer = this.pool.peers.head(); peer; peer = peer.next) {
              offset = this.network.time.known.get(peer.hostname());
              hashes = [];


              if (offset == null) offset = 0;

              for (hash in peer.blockMap.keys()) {
                str = util.revHex(hash);

                hashes.push(str);
              }

              peers.push({
                id: peer.id,
                addr: peer.hostname(),
                addrlocal: !peer.local.isNull() ? peer.local.hostname : undefined,
                services: util.hex32(peer.services),
                relaytxes: !peer.noRelay,
                lastsend: peer.lastSend / 1000 | 0,
                lastrecv: peer.lastRecv / 1000 | 0,
                bytessent: peer.socket.bytesWritten,
                bytesrecv: peer.socket.bytesRead,
                conntime: peer.time !== 0 ? (util.ms() - peer.time) / 1000 | 0 : 0,
                timeoffset: offset,
                pingtime: peer.lastPong !== -1 ? (peer.lastPong - peer.lastPing) / 1000 : -1,
                minping: peer.minPing !== -1 ? peer.minPing / 1000 : -1,
                version: peer.version,
                subver: peer.agent,
                inbound: !peer.outbound,
                startingheight: peer.height,
                besthash: peer.bestHash ? util.revHex(peer.bestHash) : null,
                bestheight: peer.bestHeight,
                banscore: peer.banScore,
                inflight: hashes,
                whitelisted: false
              });
            }

            return _context10.abrupt('return', peers);

          case 5:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this);
  }));

  function getPeerInfo(_x19, _x20) {
    return _ref10.apply(this, arguments);
  }

  return getPeerInfo;
}();

RPC.prototype.ping = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(args, help) {
    var peer;
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context11.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'ping');

          case 2:

            for (peer = this.pool.peers.head(); peer; peer = peer.next) {
              peer.sendPing();
            }return _context11.abrupt('return', null);

          case 4:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  function ping(_x21, _x22) {
    return _ref11.apply(this, arguments);
  }

  return ping;
}();

RPC.prototype.setBan = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(args, help) {
    var valid, str, action, addr;
    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            valid = new Validator([args]);
            str = valid.str(0, '');
            action = valid.str(1, '');

            if (!(help || args.length < 2 || action !== 'add' && action !== 'remove')) {
              _context12.next = 5;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'setban "ip(/netmask)" "add|remove" (bantime) (absolute)');

          case 5:
            addr = parseNetAddress(str, this.network);
            _context12.t0 = action;
            _context12.next = _context12.t0 === 'add' ? 9 : _context12.t0 === 'remove' ? 11 : 13;
            break;

          case 9:
            this.pool.ban(addr);
            return _context12.abrupt('break', 13);

          case 11:
            this.pool.unban(addr);
            return _context12.abrupt('break', 13);

          case 13:
            return _context12.abrupt('return', null);

          case 14:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this);
  }));

  function setBan(_x23, _x24) {
    return _ref12.apply(this, arguments);
  }

  return setBan;
}();

RPC.prototype.listBanned = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(args, help) {
    var banned, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, _ref14, _ref15, host, time;

    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context13.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'listbanned');

          case 2:
            banned = [];
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context13.prev = 6;


            for (_iterator3 = (0, _getIterator3.default)(this.pool.hosts.banned); !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
              _ref14 = _step3.value;
              _ref15 = (0, _slicedToArray3.default)(_ref14, 2);
              host = _ref15[0];
              time = _ref15[1];

              banned.push({
                address: host,
                banned_until: time + this.pool.options.banTime,
                ban_created: time,
                ban_reason: ''
              });
            }

            _context13.next = 14;
            break;

          case 10:
            _context13.prev = 10;
            _context13.t0 = _context13['catch'](6);
            _didIteratorError3 = true;
            _iteratorError3 = _context13.t0;

          case 14:
            _context13.prev = 14;
            _context13.prev = 15;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 17:
            _context13.prev = 17;

            if (!_didIteratorError3) {
              _context13.next = 20;
              break;
            }

            throw _iteratorError3;

          case 20:
            return _context13.finish(17);

          case 21:
            return _context13.finish(14);

          case 22:
            return _context13.abrupt('return', banned);

          case 23:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this, [[6, 10, 14, 22], [15,, 17, 21]]);
  }));

  function listBanned(_x25, _x26) {
    return _ref13.apply(this, arguments);
  }

  return listBanned;
}();

RPC.prototype.clearBanned = function () {
  var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(args, help) {
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context14.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'clearbanned');

          case 2:

            this.pool.hosts.clearBanned();

            return _context14.abrupt('return', null);

          case 4:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this);
  }));

  function clearBanned(_x27, _x28) {
    return _ref16.apply(this, arguments);
  }

  return clearBanned;
}();

/* Block chain and UTXO */
RPC.prototype.getBlockchainInfo = function () {
  var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(args, help) {
    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context15.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getblockchaininfo');

          case 2:
            _context15.t0 = this.network.type !== 'testnet' ? this.network.type : 'test';
            _context15.t1 = this.chain.height;
            _context15.t2 = this.chain.height;
            _context15.t3 = this.chain.tip.rhash();
            _context15.t4 = toDifficulty(this.chain.tip.bits);
            _context15.next = 9;
            return this.chain.getMedianTime(this.chain.tip);

          case 9:
            _context15.t5 = _context15.sent;
            _context15.t6 = this.chain.getProgress();
            _context15.t7 = this.chain.tip.chainwork.toString('hex', 64);
            _context15.t8 = this.chain.options.prune;
            _context15.t9 = this.getSoftforks();
            _context15.next = 16;
            return this.getBIP9Softforks();

          case 16:
            _context15.t10 = _context15.sent;
            _context15.t11 = this.chain.options.prune ? Math.max(0, this.chain.height - this.network.block.keepBlocks) : null;
            return _context15.abrupt('return', {
              chain: _context15.t0,
              blocks: _context15.t1,
              headers: _context15.t2,
              bestblockhash: _context15.t3,
              difficulty: _context15.t4,
              mediantime: _context15.t5,
              verificationprogress: _context15.t6,
              chainwork: _context15.t7,
              pruned: _context15.t8,
              softforks: _context15.t9,
              bip9_softforks: _context15.t10,
              pruneheight: _context15.t11
            });

          case 19:
          case 'end':
            return _context15.stop();
        }
      }
    }, _callee15, this);
  }));

  function getBlockchainInfo(_x29, _x30) {
    return _ref17.apply(this, arguments);
  }

  return getBlockchainInfo;
}();

RPC.prototype.getBestBlockHash = function () {
  var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(args, help) {
    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context16.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getbestblockhash');

          case 2:
            return _context16.abrupt('return', this.chain.tip.rhash());

          case 3:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this);
  }));

  function getBestBlockHash(_x31, _x32) {
    return _ref18.apply(this, arguments);
  }

  return getBestBlockHash;
}();

RPC.prototype.getBlockCount = function () {
  var _ref19 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(args, help) {
    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context17.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getblockcount');

          case 2:
            return _context17.abrupt('return', this.chain.tip.height);

          case 3:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this);
  }));

  function getBlockCount(_x33, _x34) {
    return _ref19.apply(this, arguments);
  }

  return getBlockCount;
}();

RPC.prototype.getBlock = function () {
  var _ref20 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18(args, help) {
    var valid, hash, verbose, details, entry, block;
    return _regenerator2.default.wrap(function _callee18$(_context18) {
      while (1) {
        switch (_context18.prev = _context18.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 3)) {
              _context18.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getblock "hash" ( verbose )');

          case 2:
            valid = new Validator([args]);
            hash = valid.hash(0);
            verbose = valid.bool(1, true);
            details = valid.bool(2, false);

            if (hash) {
              _context18.next = 8;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid block hash.');

          case 8:
            _context18.next = 10;
            return this.chain.getEntry(hash);

          case 10:
            entry = _context18.sent;

            if (entry) {
              _context18.next = 13;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Block not found');

          case 13:
            _context18.next = 15;
            return this.chain.getBlock(entry.hash);

          case 15:
            block = _context18.sent;

            if (block) {
              _context18.next = 22;
              break;
            }

            if (!this.chain.options.spv) {
              _context18.next = 19;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Block not available (spv mode)');

          case 19:
            if (!this.chain.options.prune) {
              _context18.next = 21;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Block not available (pruned data)');

          case 21:
            throw new RPCError(errs.MISC_ERROR, 'Can\'t read block from disk');

          case 22:
            if (verbose) {
              _context18.next = 24;
              break;
            }

            return _context18.abrupt('return', block.toRaw().toString('hex'));

          case 24:
            _context18.next = 26;
            return this.blockToJSON(entry, block, details);

          case 26:
            return _context18.abrupt('return', _context18.sent);

          case 27:
          case 'end':
            return _context18.stop();
        }
      }
    }, _callee18, this);
  }));

  function getBlock(_x35, _x36) {
    return _ref20.apply(this, arguments);
  }

  return getBlock;
}();

RPC.prototype.getBlockByHeight = function () {
  var _ref21 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19(args, help) {
    var valid, height, verbose, details, entry, block;
    return _regenerator2.default.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 3)) {
              _context19.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getblockbyheight "height" ( verbose )');

          case 2:
            valid = new Validator([args]);
            height = valid.u32(0, -1);
            verbose = valid.bool(1, true);
            details = valid.bool(2, false);

            if (!(height === -1)) {
              _context19.next = 8;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid block height.');

          case 8:
            _context19.next = 10;
            return this.chain.getEntry(height);

          case 10:
            entry = _context19.sent;

            if (entry) {
              _context19.next = 13;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Block not found');

          case 13:
            _context19.next = 15;
            return this.chain.getBlock(entry.hash);

          case 15:
            block = _context19.sent;

            if (block) {
              _context19.next = 22;
              break;
            }

            if (!this.chain.options.spv) {
              _context19.next = 19;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Block not available (spv mode)');

          case 19:
            if (!this.chain.options.prune) {
              _context19.next = 21;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Block not available (pruned data)');

          case 21:
            throw new RPCError(errs.DATABASE_ERROR, 'Can\'t read block from disk');

          case 22:
            if (verbose) {
              _context19.next = 24;
              break;
            }

            return _context19.abrupt('return', block.toRaw().toString('hex'));

          case 24:
            _context19.next = 26;
            return this.blockToJSON(entry, block, details);

          case 26:
            return _context19.abrupt('return', _context19.sent);

          case 27:
          case 'end':
            return _context19.stop();
        }
      }
    }, _callee19, this);
  }));

  function getBlockByHeight(_x37, _x38) {
    return _ref21.apply(this, arguments);
  }

  return getBlockByHeight;
}();

RPC.prototype.getBlockHash = function () {
  var _ref22 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20(args, help) {
    var valid, height, hash;
    return _regenerator2.default.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context20.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getblockhash index');

          case 2:
            valid = new Validator([args]);
            height = valid.u32(0);

            if (!(height == null || height > this.chain.height)) {
              _context20.next = 6;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Block height out of range.');

          case 6:
            _context20.next = 8;
            return this.chain.getHash(height);

          case 8:
            hash = _context20.sent;

            if (hash) {
              _context20.next = 11;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Not found.');

          case 11:
            return _context20.abrupt('return', util.revHex(hash));

          case 12:
          case 'end':
            return _context20.stop();
        }
      }
    }, _callee20, this);
  }));

  function getBlockHash(_x39, _x40) {
    return _ref22.apply(this, arguments);
  }

  return getBlockHash;
}();

RPC.prototype.getBlockHeader = function () {
  var _ref23 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21(args, help) {
    var valid, hash, verbose, entry;
    return _regenerator2.default.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context21.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getblockheader "hash" ( verbose )');

          case 2:
            valid = new Validator([args]);
            hash = valid.hash(0);
            verbose = valid.bool(1, true);

            if (hash) {
              _context21.next = 7;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Invalid block hash.');

          case 7:
            _context21.next = 9;
            return this.chain.getEntry(hash);

          case 9:
            entry = _context21.sent;

            if (entry) {
              _context21.next = 12;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Block not found');

          case 12:
            if (verbose) {
              _context21.next = 14;
              break;
            }

            return _context21.abrupt('return', entry.toRaw().toString('hex', 0, 80));

          case 14:
            _context21.next = 16;
            return this.headerToJSON(entry);

          case 16:
            return _context21.abrupt('return', _context21.sent);

          case 17:
          case 'end':
            return _context21.stop();
        }
      }
    }, _callee21, this);
  }));

  function getBlockHeader(_x41, _x42) {
    return _ref23.apply(this, arguments);
  }

  return getBlockHeader;
}();

RPC.prototype.getChainTips = function () {
  var _ref24 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22(args, help) {
    var tips, result, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, hash, entry, fork, main;

    return _regenerator2.default.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context22.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getchaintips');

          case 2:
            _context22.next = 4;
            return this.chain.getTips();

          case 4:
            tips = _context22.sent;
            result = [];
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context22.prev = 9;
            _iterator4 = (0, _getIterator3.default)(tips);

          case 11:
            if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
              _context22.next = 27;
              break;
            }

            hash = _step4.value;
            _context22.next = 15;
            return this.chain.getEntry(hash);

          case 15:
            entry = _context22.sent;


            assert(entry);

            _context22.next = 19;
            return this.findFork(entry);

          case 19:
            fork = _context22.sent;
            _context22.next = 22;
            return this.chain.isMainChain(entry);

          case 22:
            main = _context22.sent;


            result.push({
              height: entry.height,
              hash: entry.rhash(),
              branchlen: entry.height - fork.height,
              status: main ? 'active' : 'valid-headers'
            });

          case 24:
            _iteratorNormalCompletion4 = true;
            _context22.next = 11;
            break;

          case 27:
            _context22.next = 33;
            break;

          case 29:
            _context22.prev = 29;
            _context22.t0 = _context22['catch'](9);
            _didIteratorError4 = true;
            _iteratorError4 = _context22.t0;

          case 33:
            _context22.prev = 33;
            _context22.prev = 34;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 36:
            _context22.prev = 36;

            if (!_didIteratorError4) {
              _context22.next = 39;
              break;
            }

            throw _iteratorError4;

          case 39:
            return _context22.finish(36);

          case 40:
            return _context22.finish(33);

          case 41:
            return _context22.abrupt('return', result);

          case 42:
          case 'end':
            return _context22.stop();
        }
      }
    }, _callee22, this, [[9, 29, 33, 41], [34,, 36, 40]]);
  }));

  function getChainTips(_x43, _x44) {
    return _ref24.apply(this, arguments);
  }

  return getChainTips;
}();

RPC.prototype.getDifficulty = function () {
  var _ref25 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23(args, help) {
    return _regenerator2.default.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context23.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getdifficulty');

          case 2:
            return _context23.abrupt('return', toDifficulty(this.chain.tip.bits));

          case 3:
          case 'end':
            return _context23.stop();
        }
      }
    }, _callee23, this);
  }));

  function getDifficulty(_x45, _x46) {
    return _ref25.apply(this, arguments);
  }

  return getDifficulty;
}();

RPC.prototype.getMempoolInfo = function () {
  var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24(args, help) {
    return _regenerator2.default.wrap(function _callee24$(_context24) {
      while (1) {
        switch (_context24.prev = _context24.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context24.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getmempoolinfo');

          case 2:
            if (this.mempool) {
              _context24.next = 4;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No mempool available.');

          case 4:
            return _context24.abrupt('return', {
              size: this.mempool.map.size,
              bytes: this.mempool.getSize(),
              usage: this.mempool.getSize(),
              maxmempool: this.mempool.options.maxSize,
              mempoolminfee: Amount.btc(this.mempool.options.minRelay, true)
            });

          case 5:
          case 'end':
            return _context24.stop();
        }
      }
    }, _callee24, this);
  }));

  function getMempoolInfo(_x47, _x48) {
    return _ref26.apply(this, arguments);
  }

  return getMempoolInfo;
}();

RPC.prototype.getMempoolAncestors = function () {
  var _ref27 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25(args, help) {
    var valid, hash, verbose, entry, entries, out, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, _entry, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, _entry2;

    return _regenerator2.default.wrap(function _callee25$(_context25) {
      while (1) {
        switch (_context25.prev = _context25.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context25.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getmempoolancestors txid (verbose)');

          case 2:
            valid = new Validator([args]);
            hash = valid.hash(0);
            verbose = valid.bool(1, false);

            if (this.mempool) {
              _context25.next = 7;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No mempool available.');

          case 7:
            if (hash) {
              _context25.next = 9;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid TXID.');

          case 9:
            entry = this.mempool.getEntry(hash);

            if (entry) {
              _context25.next = 12;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Transaction not in mempool.');

          case 12:
            entries = this.mempool.getAncestors(entry);
            out = [];

            if (!verbose) {
              _context25.next = 36;
              break;
            }

            _iteratorNormalCompletion5 = true;
            _didIteratorError5 = false;
            _iteratorError5 = undefined;
            _context25.prev = 18;

            for (_iterator5 = (0, _getIterator3.default)(entries); !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
              _entry = _step5.value;

              out.push(this.entryToJSON(_entry));
            }_context25.next = 26;
            break;

          case 22:
            _context25.prev = 22;
            _context25.t0 = _context25['catch'](18);
            _didIteratorError5 = true;
            _iteratorError5 = _context25.t0;

          case 26:
            _context25.prev = 26;
            _context25.prev = 27;

            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }

          case 29:
            _context25.prev = 29;

            if (!_didIteratorError5) {
              _context25.next = 32;
              break;
            }

            throw _iteratorError5;

          case 32:
            return _context25.finish(29);

          case 33:
            return _context25.finish(26);

          case 34:
            _context25.next = 55;
            break;

          case 36:
            _iteratorNormalCompletion6 = true;
            _didIteratorError6 = false;
            _iteratorError6 = undefined;
            _context25.prev = 39;

            for (_iterator6 = (0, _getIterator3.default)(entries); !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
              _entry2 = _step6.value;

              out.push(_entry2.txid());
            }_context25.next = 47;
            break;

          case 43:
            _context25.prev = 43;
            _context25.t1 = _context25['catch'](39);
            _didIteratorError6 = true;
            _iteratorError6 = _context25.t1;

          case 47:
            _context25.prev = 47;
            _context25.prev = 48;

            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }

          case 50:
            _context25.prev = 50;

            if (!_didIteratorError6) {
              _context25.next = 53;
              break;
            }

            throw _iteratorError6;

          case 53:
            return _context25.finish(50);

          case 54:
            return _context25.finish(47);

          case 55:
            return _context25.abrupt('return', out);

          case 56:
          case 'end':
            return _context25.stop();
        }
      }
    }, _callee25, this, [[18, 22, 26, 34], [27,, 29, 33], [39, 43, 47, 55], [48,, 50, 54]]);
  }));

  function getMempoolAncestors(_x49, _x50) {
    return _ref27.apply(this, arguments);
  }

  return getMempoolAncestors;
}();

RPC.prototype.getMempoolDescendants = function () {
  var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee26(args, help) {
    var valid, hash, verbose, entry, entries, out, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, _entry3, _iteratorNormalCompletion8, _didIteratorError8, _iteratorError8, _iterator8, _step8, _entry4;

    return _regenerator2.default.wrap(function _callee26$(_context26) {
      while (1) {
        switch (_context26.prev = _context26.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context26.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getmempooldescendants txid (verbose)');

          case 2:
            valid = new Validator([args]);
            hash = valid.hash(0);
            verbose = valid.bool(1, false);

            if (this.mempool) {
              _context26.next = 7;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No mempool available.');

          case 7:
            if (hash) {
              _context26.next = 9;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid TXID.');

          case 9:
            entry = this.mempool.getEntry(hash);

            if (entry) {
              _context26.next = 12;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Transaction not in mempool.');

          case 12:
            entries = this.mempool.getDescendants(entry);
            out = [];

            if (!verbose) {
              _context26.next = 36;
              break;
            }

            _iteratorNormalCompletion7 = true;
            _didIteratorError7 = false;
            _iteratorError7 = undefined;
            _context26.prev = 18;

            for (_iterator7 = (0, _getIterator3.default)(entries); !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
              _entry3 = _step7.value;

              out.push(this.entryToJSON(_entry3));
            }_context26.next = 26;
            break;

          case 22:
            _context26.prev = 22;
            _context26.t0 = _context26['catch'](18);
            _didIteratorError7 = true;
            _iteratorError7 = _context26.t0;

          case 26:
            _context26.prev = 26;
            _context26.prev = 27;

            if (!_iteratorNormalCompletion7 && _iterator7.return) {
              _iterator7.return();
            }

          case 29:
            _context26.prev = 29;

            if (!_didIteratorError7) {
              _context26.next = 32;
              break;
            }

            throw _iteratorError7;

          case 32:
            return _context26.finish(29);

          case 33:
            return _context26.finish(26);

          case 34:
            _context26.next = 55;
            break;

          case 36:
            _iteratorNormalCompletion8 = true;
            _didIteratorError8 = false;
            _iteratorError8 = undefined;
            _context26.prev = 39;

            for (_iterator8 = (0, _getIterator3.default)(entries); !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
              _entry4 = _step8.value;

              out.push(_entry4.txid());
            }_context26.next = 47;
            break;

          case 43:
            _context26.prev = 43;
            _context26.t1 = _context26['catch'](39);
            _didIteratorError8 = true;
            _iteratorError8 = _context26.t1;

          case 47:
            _context26.prev = 47;
            _context26.prev = 48;

            if (!_iteratorNormalCompletion8 && _iterator8.return) {
              _iterator8.return();
            }

          case 50:
            _context26.prev = 50;

            if (!_didIteratorError8) {
              _context26.next = 53;
              break;
            }

            throw _iteratorError8;

          case 53:
            return _context26.finish(50);

          case 54:
            return _context26.finish(47);

          case 55:
            return _context26.abrupt('return', out);

          case 56:
          case 'end':
            return _context26.stop();
        }
      }
    }, _callee26, this, [[18, 22, 26, 34], [27,, 29, 33], [39, 43, 47, 55], [48,, 50, 54]]);
  }));

  function getMempoolDescendants(_x51, _x52) {
    return _ref28.apply(this, arguments);
  }

  return getMempoolDescendants;
}();

RPC.prototype.getMempoolEntry = function () {
  var _ref29 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee27(args, help) {
    var valid, hash, entry;
    return _regenerator2.default.wrap(function _callee27$(_context27) {
      while (1) {
        switch (_context27.prev = _context27.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context27.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getmempoolentry txid');

          case 2:
            valid = new Validator([args]);
            hash = valid.hash(0);

            if (this.mempool) {
              _context27.next = 6;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No mempool available.');

          case 6:
            if (hash) {
              _context27.next = 8;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid TXID.');

          case 8:
            entry = this.mempool.getEntry(hash);

            if (entry) {
              _context27.next = 11;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Transaction not in mempool.');

          case 11:
            return _context27.abrupt('return', this.entryToJSON(entry));

          case 12:
          case 'end':
            return _context27.stop();
        }
      }
    }, _callee27, this);
  }));

  function getMempoolEntry(_x53, _x54) {
    return _ref29.apply(this, arguments);
  }

  return getMempoolEntry;
}();

RPC.prototype.getRawMempool = function () {
  var _ref30 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee28(args, help) {
    var valid, verbose, out, _iteratorNormalCompletion9, _didIteratorError9, _iteratorError9, _iterator9, _step9, entry, hashes;

    return _regenerator2.default.wrap(function _callee28$(_context28) {
      while (1) {
        switch (_context28.prev = _context28.next) {
          case 0:
            if (!(help || args.length > 1)) {
              _context28.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getrawmempool ( verbose )');

          case 2:
            valid = new Validator([args]);
            verbose = valid.bool(0, false);

            if (this.mempool) {
              _context28.next = 6;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No mempool available.');

          case 6:
            if (!verbose) {
              _context28.next = 28;
              break;
            }

            out = {};
            _iteratorNormalCompletion9 = true;
            _didIteratorError9 = false;
            _iteratorError9 = undefined;
            _context28.prev = 11;


            for (_iterator9 = (0, _getIterator3.default)(this.mempool.map.values()); !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
              entry = _step9.value;

              out[entry.txid()] = this.entryToJSON(entry);
            }_context28.next = 19;
            break;

          case 15:
            _context28.prev = 15;
            _context28.t0 = _context28['catch'](11);
            _didIteratorError9 = true;
            _iteratorError9 = _context28.t0;

          case 19:
            _context28.prev = 19;
            _context28.prev = 20;

            if (!_iteratorNormalCompletion9 && _iterator9.return) {
              _iterator9.return();
            }

          case 22:
            _context28.prev = 22;

            if (!_didIteratorError9) {
              _context28.next = 25;
              break;
            }

            throw _iteratorError9;

          case 25:
            return _context28.finish(22);

          case 26:
            return _context28.finish(19);

          case 27:
            return _context28.abrupt('return', out);

          case 28:
            hashes = this.mempool.getSnapshot();
            return _context28.abrupt('return', hashes.map(util.revHex));

          case 30:
          case 'end':
            return _context28.stop();
        }
      }
    }, _callee28, this, [[11, 15, 19, 27], [20,, 22, 26]]);
  }));

  function getRawMempool(_x55, _x56) {
    return _ref30.apply(this, arguments);
  }

  return getRawMempool;
}();

RPC.prototype.getTXOut = function () {
  var _ref31 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee29(args, help) {
    var valid, hash, index, mempool, coin;
    return _regenerator2.default.wrap(function _callee29$(_context29) {
      while (1) {
        switch (_context29.prev = _context29.next) {
          case 0:
            if (!(help || args.length < 2 || args.length > 3)) {
              _context29.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'gettxout "txid" n ( includemempool )');

          case 2:
            valid = new Validator([args]);
            hash = valid.hash(0);
            index = valid.u32(1);
            mempool = valid.bool(2, true);

            if (!this.chain.options.spv) {
              _context29.next = 8;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Cannot get coins in SPV mode.');

          case 8:
            if (!this.chain.options.prune) {
              _context29.next = 10;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Cannot get coins when pruned.');

          case 10:
            if (!(!hash || index == null)) {
              _context29.next = 12;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid outpoint.');

          case 12:
            coin = void 0;

            if (!mempool) {
              _context29.next = 17;
              break;
            }

            if (this.mempool) {
              _context29.next = 16;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No mempool available.');

          case 16:
            coin = this.mempool.getCoin(hash, index);

          case 17:
            if (coin) {
              _context29.next = 21;
              break;
            }

            _context29.next = 20;
            return this.chain.getCoin(hash, index);

          case 20:
            coin = _context29.sent;

          case 21:
            if (coin) {
              _context29.next = 23;
              break;
            }

            return _context29.abrupt('return', null);

          case 23:
            return _context29.abrupt('return', {
              bestblock: this.chain.tip.rhash(),
              confirmations: coin.getDepth(this.chain.height),
              value: Amount.btc(coin.value, true),
              scriptPubKey: this.scriptToJSON(coin.script, true),
              version: coin.version,
              coinbase: coin.coinbase
            });

          case 24:
          case 'end':
            return _context29.stop();
        }
      }
    }, _callee29, this);
  }));

  function getTXOut(_x57, _x58) {
    return _ref31.apply(this, arguments);
  }

  return getTXOut;
}();

RPC.prototype.getTXOutProof = function () {
  var _ref32 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee30(args, help) {
    var valid, txids, hash, items, set, hashes, last, i, _hash, block, tx, coin, _iteratorNormalCompletion10, _didIteratorError10, _iteratorError10, _iterator10, _step10, _hash2;

    return _regenerator2.default.wrap(function _callee30$(_context30) {
      while (1) {
        switch (_context30.prev = _context30.next) {
          case 0:
            if (!(help || args.length !== 1 && args.length !== 2)) {
              _context30.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'gettxoutproof ["txid",...] ( blockhash )');

          case 2:
            valid = new Validator([args]);
            txids = valid.array(0);
            hash = valid.hash(1);

            if (!this.chain.options.spv) {
              _context30.next = 7;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Cannot get coins in SPV mode.');

          case 7:
            if (!this.chain.options.prune) {
              _context30.next = 9;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Cannot get coins when pruned.');

          case 9:
            if (!(!txids || txids.length === 0)) {
              _context30.next = 11;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid TXIDs.');

          case 11:
            items = new Validator([txids]);
            set = new _set2.default();
            hashes = [];
            last = null;
            i = 0;

          case 16:
            if (!(i < txids.length)) {
              _context30.next = 28;
              break;
            }

            _hash = items.hash(i);

            if (_hash) {
              _context30.next = 20;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid TXID.');

          case 20:
            if (!set.has(_hash)) {
              _context30.next = 22;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Duplicate txid.');

          case 22:

            set.add(_hash);
            hashes.push(_hash);

            last = _hash;

          case 25:
            i++;
            _context30.next = 16;
            break;

          case 28:
            block = null;

            if (!hash) {
              _context30.next = 35;
              break;
            }

            _context30.next = 32;
            return this.chain.getBlock(hash);

          case 32:
            block = _context30.sent;
            _context30.next = 52;
            break;

          case 35:
            if (!this.chain.options.indexTX) {
              _context30.next = 45;
              break;
            }

            _context30.next = 38;
            return this.chain.getMeta(last);

          case 38:
            tx = _context30.sent;

            if (!tx) {
              _context30.next = 43;
              break;
            }

            _context30.next = 42;
            return this.chain.getBlock(tx.block);

          case 42:
            block = _context30.sent;

          case 43:
            _context30.next = 52;
            break;

          case 45:
            _context30.next = 47;
            return this.chain.getCoin(last, 0);

          case 47:
            coin = _context30.sent;

            if (!coin) {
              _context30.next = 52;
              break;
            }

            _context30.next = 51;
            return this.chain.getBlock(coin.height);

          case 51:
            block = _context30.sent;

          case 52:
            if (block) {
              _context30.next = 54;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Block not found.');

          case 54:
            _iteratorNormalCompletion10 = true;
            _didIteratorError10 = false;
            _iteratorError10 = undefined;
            _context30.prev = 57;
            _iterator10 = (0, _getIterator3.default)(hashes);

          case 59:
            if (_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done) {
              _context30.next = 66;
              break;
            }

            _hash2 = _step10.value;

            if (block.hasTX(_hash2)) {
              _context30.next = 63;
              break;
            }

            throw new RPCError(errs.VERIFY_ERROR, 'Block does not contain all txids.');

          case 63:
            _iteratorNormalCompletion10 = true;
            _context30.next = 59;
            break;

          case 66:
            _context30.next = 72;
            break;

          case 68:
            _context30.prev = 68;
            _context30.t0 = _context30['catch'](57);
            _didIteratorError10 = true;
            _iteratorError10 = _context30.t0;

          case 72:
            _context30.prev = 72;
            _context30.prev = 73;

            if (!_iteratorNormalCompletion10 && _iterator10.return) {
              _iterator10.return();
            }

          case 75:
            _context30.prev = 75;

            if (!_didIteratorError10) {
              _context30.next = 78;
              break;
            }

            throw _iteratorError10;

          case 78:
            return _context30.finish(75);

          case 79:
            return _context30.finish(72);

          case 80:

            block = MerkleBlock.fromHashes(block, hashes);

            return _context30.abrupt('return', block.toRaw().toString('hex'));

          case 82:
          case 'end':
            return _context30.stop();
        }
      }
    }, _callee30, this, [[57, 68, 72, 80], [73,, 75, 79]]);
  }));

  function getTXOutProof(_x59, _x60) {
    return _ref32.apply(this, arguments);
  }

  return getTXOutProof;
}();

RPC.prototype.verifyTXOutProof = function () {
  var _ref33 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee31(args, help) {
    var valid, data, block, entry, tree, out, _iteratorNormalCompletion11, _didIteratorError11, _iteratorError11, _iterator11, _step11, hash;

    return _regenerator2.default.wrap(function _callee31$(_context31) {
      while (1) {
        switch (_context31.prev = _context31.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context31.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'verifytxoutproof "proof"');

          case 2:
            valid = new Validator([args]);
            data = valid.buf(0);

            if (data) {
              _context31.next = 6;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid hex string.');

          case 6:
            block = MerkleBlock.fromRaw(data);

            if (block.verify()) {
              _context31.next = 9;
              break;
            }

            return _context31.abrupt('return', []);

          case 9:
            _context31.next = 11;
            return this.chain.getEntry(block.hash('hex'));

          case 11:
            entry = _context31.sent;

            if (entry) {
              _context31.next = 14;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Block not found in chain.');

          case 14:
            tree = block.getTree();
            out = [];
            _iteratorNormalCompletion11 = true;
            _didIteratorError11 = false;
            _iteratorError11 = undefined;
            _context31.prev = 19;


            for (_iterator11 = (0, _getIterator3.default)(tree.matches); !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
              hash = _step11.value;

              out.push(util.revHex(hash.toString('hex')));
            }_context31.next = 27;
            break;

          case 23:
            _context31.prev = 23;
            _context31.t0 = _context31['catch'](19);
            _didIteratorError11 = true;
            _iteratorError11 = _context31.t0;

          case 27:
            _context31.prev = 27;
            _context31.prev = 28;

            if (!_iteratorNormalCompletion11 && _iterator11.return) {
              _iterator11.return();
            }

          case 30:
            _context31.prev = 30;

            if (!_didIteratorError11) {
              _context31.next = 33;
              break;
            }

            throw _iteratorError11;

          case 33:
            return _context31.finish(30);

          case 34:
            return _context31.finish(27);

          case 35:
            return _context31.abrupt('return', out);

          case 36:
          case 'end':
            return _context31.stop();
        }
      }
    }, _callee31, this, [[19, 23, 27, 35], [28,, 30, 34]]);
  }));

  function verifyTXOutProof(_x61, _x62) {
    return _ref33.apply(this, arguments);
  }

  return verifyTXOutProof;
}();

RPC.prototype.getTXOutSetInfo = function () {
  var _ref34 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee32(args, help) {
    return _regenerator2.default.wrap(function _callee32$(_context32) {
      while (1) {
        switch (_context32.prev = _context32.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context32.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'gettxoutsetinfo');

          case 2:
            if (!this.chain.options.spv) {
              _context32.next = 4;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Chainstate not available (SPV mode).');

          case 4:
            return _context32.abrupt('return', {
              height: this.chain.height,
              bestblock: this.chain.tip.rhash(),
              transactions: this.chain.db.state.tx,
              txouts: this.chain.db.state.coin,
              bytes_serialized: 0,
              hash_serialized: 0,
              total_amount: Amount.btc(this.chain.db.state.value, true)
            });

          case 5:
          case 'end':
            return _context32.stop();
        }
      }
    }, _callee32, this);
  }));

  function getTXOutSetInfo(_x63, _x64) {
    return _ref34.apply(this, arguments);
  }

  return getTXOutSetInfo;
}();

RPC.prototype.pruneBlockchain = function () {
  var _ref35 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee33(args, help) {
    return _regenerator2.default.wrap(function _callee33$(_context33) {
      while (1) {
        switch (_context33.prev = _context33.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context33.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'pruneblockchain');

          case 2:
            if (!this.chain.options.spv) {
              _context33.next = 4;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Cannot prune chain in SPV mode.');

          case 4:
            if (!this.chain.options.prune) {
              _context33.next = 6;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Chain is already pruned.');

          case 6:
            if (!(this.chain.height < this.network.block.pruneAfterHeight)) {
              _context33.next = 8;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Chain is too short for pruning.');

          case 8:
            _context33.prev = 8;
            _context33.next = 11;
            return this.chain.prune();

          case 11:
            _context33.next = 16;
            break;

          case 13:
            _context33.prev = 13;
            _context33.t0 = _context33['catch'](8);
            throw new RPCError(errs.DATABASE_ERROR, _context33.t0.message);

          case 16:
          case 'end':
            return _context33.stop();
        }
      }
    }, _callee33, this, [[8, 13]]);
  }));

  function pruneBlockchain(_x65, _x66) {
    return _ref35.apply(this, arguments);
  }

  return pruneBlockchain;
}();

RPC.prototype.verifyChain = function () {
  var _ref36 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee34(args, help) {
    var valid, level, blocks;
    return _regenerator2.default.wrap(function _callee34$(_context34) {
      while (1) {
        switch (_context34.prev = _context34.next) {
          case 0:
            if (!(help || args.length > 2)) {
              _context34.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'verifychain ( checklevel numblocks )');

          case 2:
            valid = new Validator([args]);
            level = valid.u32(0);
            blocks = valid.u32(1);

            if (!(level == null || blocks == null)) {
              _context34.next = 7;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Missing parameters.');

          case 7:
            if (!this.chain.options.spv) {
              _context34.next = 9;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Cannot verify chain in SPV mode.');

          case 9:
            if (!this.chain.options.prune) {
              _context34.next = 11;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Cannot verify chain when pruned.');

          case 11:
            return _context34.abrupt('return', null);

          case 12:
          case 'end':
            return _context34.stop();
        }
      }
    }, _callee34, this);
  }));

  function verifyChain(_x67, _x68) {
    return _ref36.apply(this, arguments);
  }

  return verifyChain;
}();

/*
 * Mining
 */

RPC.prototype.submitWork = function () {
  var _ref37 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee35(data) {
    var unlock;
    return _regenerator2.default.wrap(function _callee35$(_context35) {
      while (1) {
        switch (_context35.prev = _context35.next) {
          case 0:
            _context35.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context35.sent;
            _context35.prev = 3;
            _context35.next = 6;
            return this._submitWork(data);

          case 6:
            return _context35.abrupt('return', _context35.sent);

          case 7:
            _context35.prev = 7;

            unlock();
            return _context35.finish(7);

          case 10:
          case 'end':
            return _context35.stop();
        }
      }
    }, _callee35, this, [[3,, 7, 10]]);
  }));

  function submitWork(_x69) {
    return _ref37.apply(this, arguments);
  }

  return submitWork;
}();

RPC.prototype._submitWork = function () {
  var _ref38 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee36(data) {
    var attempt, raw, header, nonces, _nonces, n1, n2, nonce, time, proof, block, entry;

    return _regenerator2.default.wrap(function _callee36$(_context36) {
      while (1) {
        switch (_context36.prev = _context36.next) {
          case 0:
            attempt = this.attempt;

            if (attempt) {
              _context36.next = 3;
              break;
            }

            return _context36.abrupt('return', false);

          case 3:
            if (!(data.length !== 128)) {
              _context36.next = 5;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid work size.');

          case 5:
            raw = data.slice(0, 80);

            swap32(raw);

            header = Headers.fromHead(raw);

            if (!(header.prevBlock !== attempt.prevBlock || header.bits !== attempt.bits)) {
              _context36.next = 10;
              break;
            }

            return _context36.abrupt('return', false);

          case 10:
            if (header.verify()) {
              _context36.next = 12;
              break;
            }

            return _context36.abrupt('return', false);

          case 12:
            nonces = this.merkleMap.get(header.merkleRoot);

            if (nonces) {
              _context36.next = 15;
              break;
            }

            return _context36.abrupt('return', false);

          case 15:
            _nonces = (0, _slicedToArray3.default)(nonces, 2), n1 = _nonces[0], n2 = _nonces[1];
            nonce = header.nonce;
            time = header.time;
            proof = attempt.getProof(n1, n2, time, nonce);

            if (proof.verify(attempt.target)) {
              _context36.next = 21;
              break;
            }

            return _context36.abrupt('return', false);

          case 21:
            block = attempt.commit(proof);
            entry = void 0;
            _context36.prev = 23;
            _context36.next = 26;
            return this.chain.add(block);

          case 26:
            entry = _context36.sent;
            _context36.next = 35;
            break;

          case 29:
            _context36.prev = 29;
            _context36.t0 = _context36['catch'](23);

            if (!(_context36.t0.type === 'VerifyError')) {
              _context36.next = 34;
              break;
            }

            this.logger.warning('RPC block rejected: %s (%s).', block.rhash(), _context36.t0.reason);
            return _context36.abrupt('return', false);

          case 34:
            throw _context36.t0;

          case 35:
            if (entry) {
              _context36.next = 38;
              break;
            }

            this.logger.warning('RPC block rejected: %s (bad-prevblk).', block.rhash());
            return _context36.abrupt('return', false);

          case 38:
            return _context36.abrupt('return', true);

          case 39:
          case 'end':
            return _context36.stop();
        }
      }
    }, _callee36, this, [[23, 29]]);
  }));

  function _submitWork(_x70) {
    return _ref38.apply(this, arguments);
  }

  return _submitWork;
}();

RPC.prototype.createWork = function () {
  var _ref39 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee37(data) {
    var unlock;
    return _regenerator2.default.wrap(function _callee37$(_context37) {
      while (1) {
        switch (_context37.prev = _context37.next) {
          case 0:
            _context37.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context37.sent;
            _context37.prev = 3;
            _context37.next = 6;
            return this._createWork(data);

          case 6:
            return _context37.abrupt('return', _context37.sent);

          case 7:
            _context37.prev = 7;

            unlock();
            return _context37.finish(7);

          case 10:
          case 'end':
            return _context37.stop();
        }
      }
    }, _callee37, this, [[3,, 7, 10]]);
  }));

  function createWork(_x71) {
    return _ref39.apply(this, arguments);
  }

  return createWork;
}();

RPC.prototype._createWork = function () {
  var _ref40 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee38() {
    var attempt, n1, n2, time, data, root, head;
    return _regenerator2.default.wrap(function _callee38$(_context38) {
      while (1) {
        switch (_context38.prev = _context38.next) {
          case 0:
            _context38.next = 2;
            return this.updateWork();

          case 2:
            attempt = _context38.sent;
            n1 = this.nonce1;
            n2 = this.nonce2;
            time = attempt.time;
            data = Buffer.allocUnsafe(128);

            data.fill(0);

            root = attempt.getRoot(n1, n2);
            head = attempt.getHeader(root, time, 0);


            head.copy(data, 0);

            data[80] = 0x80;
            data.writeUInt32BE(80 * 8, data.length - 4, true);

            swap32(data);

            return _context38.abrupt('return', {
              data: data.toString('hex'),
              target: attempt.target.toString('hex'),
              height: attempt.height
            });

          case 15:
          case 'end':
            return _context38.stop();
        }
      }
    }, _callee38, this);
  }));

  function _createWork() {
    return _ref40.apply(this, arguments);
  }

  return _createWork;
}();

RPC.prototype.getWorkLongpoll = function () {
  var _ref41 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee39(args, help) {
    return _regenerator2.default.wrap(function _callee39$(_context39) {
      while (1) {
        switch (_context39.prev = _context39.next) {
          case 0:
            _context39.next = 2;
            return this.longpoll();

          case 2:
            _context39.next = 4;
            return this.createWork();

          case 4:
            return _context39.abrupt('return', _context39.sent);

          case 5:
          case 'end':
            return _context39.stop();
        }
      }
    }, _callee39, this);
  }));

  function getWorkLongpoll(_x72, _x73) {
    return _ref41.apply(this, arguments);
  }

  return getWorkLongpoll;
}();

RPC.prototype.getWork = function () {
  var _ref42 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee40(args, help) {
    var valid, data;
    return _regenerator2.default.wrap(function _callee40$(_context40) {
      while (1) {
        switch (_context40.prev = _context40.next) {
          case 0:
            if (!(args.length > 1)) {
              _context40.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getwork ( "data" )');

          case 2:
            if (!(args.length === 1)) {
              _context40.next = 10;
              break;
            }

            valid = new Validator([args]);
            data = valid.buf(0);

            if (data) {
              _context40.next = 7;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid work data.');

          case 7:
            _context40.next = 9;
            return this.submitWork(data);

          case 9:
            return _context40.abrupt('return', _context40.sent);

          case 10:
            _context40.next = 12;
            return this.createWork();

          case 12:
            return _context40.abrupt('return', _context40.sent);

          case 13:
          case 'end':
            return _context40.stop();
        }
      }
    }, _callee40, this);
  }));

  function getWork(_x74, _x75) {
    return _ref42.apply(this, arguments);
  }

  return getWork;
}();

RPC.prototype.submitBlock = function () {
  var _ref43 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee41(args, help) {
    var valid, data, block;
    return _regenerator2.default.wrap(function _callee41$(_context41) {
      while (1) {
        switch (_context41.prev = _context41.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context41.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'submitblock "hexdata" ( "jsonparametersobject" )');

          case 2:
            valid = new Validator([args]);
            data = valid.buf(0);
            block = Block.fromRaw(data);
            _context41.next = 7;
            return this.addBlock(block);

          case 7:
            return _context41.abrupt('return', _context41.sent);

          case 8:
          case 'end':
            return _context41.stop();
        }
      }
    }, _callee41, this);
  }));

  function submitBlock(_x76, _x77) {
    return _ref43.apply(this, arguments);
  }

  return submitBlock;
}();

RPC.prototype.getBlockTemplate = function () {
  var _ref44 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee42(args, help) {
    var validator, options, valid, mode, data, block, maxVersion, rules, capabilities, coinbase, txnCap, valueCap, _iteratorNormalCompletion12, _didIteratorError12, _iteratorError12, _iterator12, _step12, capability, lpid;

    return _regenerator2.default.wrap(function _callee42$(_context42) {
      while (1) {
        switch (_context42.prev = _context42.next) {
          case 0:
            if (!(help || args.length > 1)) {
              _context42.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getblocktemplate ( "jsonrequestobject" )');

          case 2:
            validator = new Validator([args]);
            options = validator.obj(0, {});
            valid = new Validator([options]);
            mode = valid.str('mode', 'template');

            if (!(mode !== 'template' && mode !== 'proposal')) {
              _context42.next = 8;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid mode.');

          case 8:
            if (!(mode === 'proposal')) {
              _context42.next = 26;
              break;
            }

            data = valid.buf('data');

            if (data) {
              _context42.next = 12;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Missing data parameter.');

          case 12:
            block = Block.fromRaw(data);

            if (!(block.prevBlock !== this.chain.tip.hash)) {
              _context42.next = 15;
              break;
            }

            return _context42.abrupt('return', 'inconclusive-not-best-prevblk');

          case 15:
            _context42.prev = 15;
            _context42.next = 18;
            return this.chain.verifyBlock(block);

          case 18:
            _context42.next = 25;
            break;

          case 20:
            _context42.prev = 20;
            _context42.t0 = _context42['catch'](15);

            if (!(_context42.t0.type === 'VerifyError')) {
              _context42.next = 24;
              break;
            }

            return _context42.abrupt('return', _context42.t0.reason);

          case 24:
            throw _context42.t0;

          case 25:
            return _context42.abrupt('return', null);

          case 26:
            maxVersion = valid.u32('maxversion', -1);
            rules = valid.array('rules');


            if (rules) maxVersion = -1;

            capabilities = valid.array('capabilities');
            coinbase = false;

            if (!capabilities) {
              _context42.next = 72;
              break;
            }

            txnCap = false;
            valueCap = false;
            _iteratorNormalCompletion12 = true;
            _didIteratorError12 = false;
            _iteratorError12 = undefined;
            _context42.prev = 37;
            _iterator12 = (0, _getIterator3.default)(capabilities);

          case 39:
            if (_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done) {
              _context42.next = 53;
              break;
            }

            capability = _step12.value;

            if (!(typeof capability !== 'string')) {
              _context42.next = 43;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid capability.');

          case 43:
            _context42.t1 = capability;
            _context42.next = _context42.t1 === 'coinbasetxn' ? 46 : _context42.t1 === 'coinbasevalue' ? 48 : 50;
            break;

          case 46:
            txnCap = true;
            return _context42.abrupt('break', 50);

          case 48:
            // Prefer value if they support it.
            valueCap = true;
            return _context42.abrupt('break', 50);

          case 50:
            _iteratorNormalCompletion12 = true;
            _context42.next = 39;
            break;

          case 53:
            _context42.next = 59;
            break;

          case 55:
            _context42.prev = 55;
            _context42.t2 = _context42['catch'](37);
            _didIteratorError12 = true;
            _iteratorError12 = _context42.t2;

          case 59:
            _context42.prev = 59;
            _context42.prev = 60;

            if (!_iteratorNormalCompletion12 && _iterator12.return) {
              _iterator12.return();
            }

          case 62:
            _context42.prev = 62;

            if (!_didIteratorError12) {
              _context42.next = 65;
              break;
            }

            throw _iteratorError12;

          case 65:
            return _context42.finish(62);

          case 66:
            return _context42.finish(59);

          case 67:

            // BIP22 states that we can't have coinbasetxn
            // _and_ coinbasevalue in the same template.
            // The problem is, many clients _say_ they
            // support coinbasetxn when they don't (ckpool).
            // To make matters worse, some clients will
            // parse an undefined `coinbasevalue` as zero.
            // Because of all of this, coinbasetxn is
            // disabled for now.
            valueCap = true;

            if (!(txnCap && !valueCap)) {
              _context42.next = 72;
              break;
            }

            if (!(this.miner.addresses.length === 0)) {
              _context42.next = 71;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No addresses available for coinbase.');

          case 71:
            coinbase = true;

          case 72:
            if (this.network.selfConnect) {
              _context42.next = 77;
              break;
            }

            if (!(this.pool.peers.size() === 0)) {
              _context42.next = 75;
              break;
            }

            throw new RPCError(errs.CLIENT_NOT_CONNECTED, 'Bitcoin is not connected!');

          case 75:
            if (this.chain.synced) {
              _context42.next = 77;
              break;
            }

            throw new RPCError(errs.CLIENT_IN_INITIAL_DOWNLOAD, 'Bitcoin is downloading blocks...');

          case 77:
            lpid = valid.str('longpollid');

            if (!lpid) {
              _context42.next = 81;
              break;
            }

            _context42.next = 81;
            return this.handleLongpoll(lpid);

          case 81:

            if (!rules) rules = [];

            _context42.next = 84;
            return this.createTemplate(maxVersion, coinbase, rules);

          case 84:
            return _context42.abrupt('return', _context42.sent);

          case 85:
          case 'end':
            return _context42.stop();
        }
      }
    }, _callee42, this, [[15, 20], [37, 55, 59, 67], [60,, 62, 66]]);
  }));

  function getBlockTemplate(_x78, _x79) {
    return _ref44.apply(this, arguments);
  }

  return getBlockTemplate;
}();

RPC.prototype.createTemplate = function () {
  var _ref45 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee43(maxVersion, coinbase, rules) {
    var unlock;
    return _regenerator2.default.wrap(function _callee43$(_context43) {
      while (1) {
        switch (_context43.prev = _context43.next) {
          case 0:
            _context43.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context43.sent;
            _context43.prev = 3;
            _context43.next = 6;
            return this._createTemplate(maxVersion, coinbase, rules);

          case 6:
            return _context43.abrupt('return', _context43.sent);

          case 7:
            _context43.prev = 7;

            unlock();
            return _context43.finish(7);

          case 10:
          case 'end':
            return _context43.stop();
        }
      }
    }, _callee43, this, [[3,, 7, 10]]);
  }));

  function createTemplate(_x80, _x81, _x82) {
    return _ref45.apply(this, arguments);
  }

  return createTemplate;
}();

RPC.prototype._createTemplate = function () {
  var _ref46 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee44(maxVersion, coinbase, rules) {
    var attempt, scale, mutable, index, i, entry, txs, _i, _entry5, tx, deps, j, input, dep, version, vbavailable, vbrules, _iteratorNormalCompletion13, _didIteratorError13, _iteratorError13, _iterator13, _step13, deploy, state, name, json, _tx, _input, output;

    return _regenerator2.default.wrap(function _callee44$(_context44) {
      while (1) {
        switch (_context44.prev = _context44.next) {
          case 0:
            _context44.next = 2;
            return this.getTemplate();

          case 2:
            attempt = _context44.sent;
            scale = attempt.witness ? 1 : consensus.WITNESS_SCALE_FACTOR;

            // Default mutable fields.

            mutable = ['time', 'transactions', 'prevblock'];

            // The miner doesn't support
            // versionbits. Force them to
            // encode our version.

            if (maxVersion >= 2) mutable.push('version/force');

            // Allow the miner to change
            // our provided coinbase.
            // Note that these are implied
            // without `coinbasetxn`.
            if (coinbase) {
              mutable.push('coinbase');
              mutable.push('coinbase/append');
              mutable.push('generation');
            }

            // Build an index of every transaction.
            index = new _map2.default();

            for (i = 0; i < attempt.items.length; i++) {
              entry = attempt.items[i];

              index.set(entry.hash, i + 1);
            }

            // Calculate dependencies for each transaction.
            txs = [];
            _i = 0;

          case 11:
            if (!(_i < attempt.items.length)) {
              _context44.next = 29;
              break;
            }

            _entry5 = attempt.items[_i];
            tx = _entry5.tx;
            deps = [];
            j = 0;

          case 16:
            if (!(j < tx.inputs.length)) {
              _context44.next = 25;
              break;
            }

            input = tx.inputs[j];
            dep = index.get(input.prevout.hash);

            if (!(dep == null)) {
              _context44.next = 21;
              break;
            }

            return _context44.abrupt('continue', 22);

          case 21:

            if (deps.indexOf(dep) === -1) {
              assert(dep < _i + 1);
              deps.push(dep);
            }

          case 22:
            j++;
            _context44.next = 16;
            break;

          case 25:

            txs.push({
              data: tx.toRaw().toString('hex'),
              txid: tx.txid(),
              hash: tx.wtxid(),
              depends: deps,
              fee: _entry5.fee,
              sigops: _entry5.sigops / scale | 0,
              weight: tx.getWeight()
            });

          case 26:
            _i++;
            _context44.next = 11;
            break;

          case 29:

            if (this.chain.options.bip91) {
              rules.push('segwit');
              rules.push('segsignal');
            }

            if (this.chain.options.bip148) rules.push('segwit');

            // Calculate version based on given rules.
            version = attempt.version;
            vbavailable = {};
            vbrules = [];
            _iteratorNormalCompletion13 = true;
            _didIteratorError13 = false;
            _iteratorError13 = undefined;
            _context44.prev = 37;
            _iterator13 = (0, _getIterator3.default)(this.network.deploys);

          case 39:
            if (_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done) {
              _context44.next = 64;
              break;
            }

            deploy = _step13.value;
            _context44.next = 43;
            return this.chain.getState(this.chain.tip, deploy);

          case 43:
            state = _context44.sent;
            name = deploy.name;
            _context44.t0 = state;
            _context44.next = _context44.t0 === common.thresholdStates.DEFINED ? 48 : _context44.t0 === common.thresholdStates.FAILED ? 48 : _context44.t0 === common.thresholdStates.LOCKED_IN ? 49 : _context44.t0 === common.thresholdStates.STARTED ? 50 : _context44.t0 === common.thresholdStates.ACTIVE ? 53 : 59;
            break;

          case 48:
            return _context44.abrupt('break', 61);

          case 49:
            version |= 1 << deploy.bit;

          case 50:
            if (!deploy.force) {
              if (rules.indexOf(name) === -1) version &= ~(1 << deploy.bit);
              if (deploy.required) name = '!' + name;
            }
            vbavailable[name] = deploy.bit;
            return _context44.abrupt('break', 61);

          case 53:
            if (!(!deploy.force && deploy.required)) {
              _context44.next = 57;
              break;
            }

            if (!(rules.indexOf(name) === -1)) {
              _context44.next = 56;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Client must support ' + name + '.');

          case 56:
            name = '!' + name;

          case 57:
            vbrules.push(name);
            return _context44.abrupt('break', 61);

          case 59:
            assert(false, 'Bad state.');
            return _context44.abrupt('break', 61);

          case 61:
            _iteratorNormalCompletion13 = true;
            _context44.next = 39;
            break;

          case 64:
            _context44.next = 70;
            break;

          case 66:
            _context44.prev = 66;
            _context44.t1 = _context44['catch'](37);
            _didIteratorError13 = true;
            _iteratorError13 = _context44.t1;

          case 70:
            _context44.prev = 70;
            _context44.prev = 71;

            if (!_iteratorNormalCompletion13 && _iterator13.return) {
              _iterator13.return();
            }

          case 73:
            _context44.prev = 73;

            if (!_didIteratorError13) {
              _context44.next = 76;
              break;
            }

            throw _iteratorError13;

          case 76:
            return _context44.finish(73);

          case 77:
            return _context44.finish(70);

          case 78:

            version >>>= 0;

            json = {
              capabilities: ['proposal'],
              mutable: mutable,
              version: version,
              rules: vbrules,
              vbavailable: vbavailable,
              vbrequired: 0,
              height: attempt.height,
              previousblockhash: util.revHex(attempt.prevBlock),
              target: util.revHex(attempt.target.toString('hex')),
              bits: util.hex32(attempt.bits),
              noncerange: '00000000ffffffff',
              curtime: attempt.time,
              mintime: attempt.mtp + 1,
              maxtime: attempt.time + 7200,
              expires: attempt.time + 7200,
              sigoplimit: consensus.MAX_BLOCK_SIGOPS_COST / scale | 0,
              sizelimit: consensus.MAX_BLOCK_SIZE,
              weightlimit: undefined,
              longpollid: this.chain.tip.rhash() + util.pad32(this.totalTX()),
              submitold: false,
              coinbaseaux: {
                flags: attempt.coinbaseFlags.toString('hex')
              },
              coinbasevalue: undefined,
              coinbasetxn: undefined,
              default_witness_commitment: undefined,
              transactions: txs
            };

            // See:
            // bitcoin/bitcoin#9fc7f0bce94f1cea0239b1543227f22a3f3b9274

            if (attempt.witness) {
              json.sizelimit = consensus.MAX_RAW_BLOCK_SIZE;
              json.weightlimit = consensus.MAX_BLOCK_WEIGHT;
            }

            // The client wants a coinbasetxn
            // instead of a coinbasevalue.
            if (coinbase) {
              _tx = attempt.toCoinbase();
              _input = _tx.inputs[0];

              // Pop off the nonces.

              _input.script.pop();
              _input.script.compile();

              if (attempt.witness) {
                // We don't include the commitment
                // output (see bip145).
                output = _tx.outputs.pop();

                assert(output.script.isCommitment());

                // Also not including the witness nonce.
                _input.witness.clear();
              }

              _tx.refresh();

              json.coinbasetxn = {
                data: _tx.toRaw().toString('hex'),
                txid: _tx.txid(),
                hash: _tx.wtxid(),
                depends: [],
                fee: 0,
                sigops: _tx.getSigopsCost() / scale | 0,
                weight: _tx.getWeight()
              };
            } else {
              json.coinbasevalue = attempt.getReward();
            }

            if (rules.indexOf('segwit') !== -1) json.default_witness_commitment = attempt.getWitnessScript().toJSON();

            return _context44.abrupt('return', json);

          case 84:
          case 'end':
            return _context44.stop();
        }
      }
    }, _callee44, this, [[37, 66, 70, 78], [71,, 73, 77]]);
  }));

  function _createTemplate(_x83, _x84, _x85) {
    return _ref46.apply(this, arguments);
  }

  return _createTemplate;
}();

RPC.prototype.getMiningInfo = function () {
  var _ref47 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee45(args, help) {
    var attempt, size, weight, txs, diff, _iteratorNormalCompletion14, _didIteratorError14, _iteratorError14, _iterator14, _step14, item;

    return _regenerator2.default.wrap(function _callee45$(_context45) {
      while (1) {
        switch (_context45.prev = _context45.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context45.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getmininginfo');

          case 2:
            attempt = this.attempt;
            size = 0;
            weight = 0;
            txs = 0;
            diff = 0;

            if (!attempt) {
              _context45.next = 31;
              break;
            }

            weight = attempt.weight;
            txs = attempt.items.length + 1;
            diff = attempt.getDifficulty();
            size = 1000;
            _iteratorNormalCompletion14 = true;
            _didIteratorError14 = false;
            _iteratorError14 = undefined;
            _context45.prev = 15;
            for (_iterator14 = (0, _getIterator3.default)(attempt.items); !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
              item = _step14.value;

              size += item.tx.getBaseSize();
            }_context45.next = 23;
            break;

          case 19:
            _context45.prev = 19;
            _context45.t0 = _context45['catch'](15);
            _didIteratorError14 = true;
            _iteratorError14 = _context45.t0;

          case 23:
            _context45.prev = 23;
            _context45.prev = 24;

            if (!_iteratorNormalCompletion14 && _iterator14.return) {
              _iterator14.return();
            }

          case 26:
            _context45.prev = 26;

            if (!_didIteratorError14) {
              _context45.next = 29;
              break;
            }

            throw _iteratorError14;

          case 29:
            return _context45.finish(26);

          case 30:
            return _context45.finish(23);

          case 31:
            _context45.t1 = this.chain.height;
            _context45.t2 = size;
            _context45.t3 = weight;
            _context45.t4 = txs;
            _context45.t5 = diff;
            _context45.t6 = this.procLimit;
            _context45.next = 39;
            return this.getHashRate(120);

          case 39:
            _context45.t7 = _context45.sent;
            _context45.t8 = this.totalTX();
            _context45.t9 = this.network !== Network.main;
            _context45.t10 = this.network.type !== 'testnet' ? this.network.type : 'test';
            _context45.t11 = this.mining;
            return _context45.abrupt('return', {
              blocks: _context45.t1,
              currentblocksize: _context45.t2,
              currentblockweight: _context45.t3,
              currentblocktx: _context45.t4,
              difficulty: _context45.t5,
              errors: '',
              genproclimit: _context45.t6,
              networkhashps: _context45.t7,
              pooledtx: _context45.t8,
              testnet: _context45.t9,
              chain: _context45.t10,
              generate: _context45.t11
            });

          case 45:
          case 'end':
            return _context45.stop();
        }
      }
    }, _callee45, this, [[15, 19, 23, 31], [24,, 26, 30]]);
  }));

  function getMiningInfo(_x86, _x87) {
    return _ref47.apply(this, arguments);
  }

  return getMiningInfo;
}();

RPC.prototype.getNetworkHashPS = function () {
  var _ref48 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee46(args, help) {
    var valid, lookup, height;
    return _regenerator2.default.wrap(function _callee46$(_context46) {
      while (1) {
        switch (_context46.prev = _context46.next) {
          case 0:
            if (!(help || args.length > 2)) {
              _context46.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getnetworkhashps ( blocks height )');

          case 2:
            valid = new Validator([args]);
            lookup = valid.u32(0, 120);
            height = valid.u32(1);
            _context46.next = 7;
            return this.getHashRate(lookup, height);

          case 7:
            return _context46.abrupt('return', _context46.sent);

          case 8:
          case 'end':
            return _context46.stop();
        }
      }
    }, _callee46, this);
  }));

  function getNetworkHashPS(_x88, _x89) {
    return _ref48.apply(this, arguments);
  }

  return getNetworkHashPS;
}();

RPC.prototype.prioritiseTransaction = function () {
  var _ref49 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee47(args, help) {
    var valid, hash, pri, fee, entry;
    return _regenerator2.default.wrap(function _callee47$(_context47) {
      while (1) {
        switch (_context47.prev = _context47.next) {
          case 0:
            if (!(help || args.length !== 3)) {
              _context47.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'prioritisetransaction <txid> <priority delta> <fee delta>');

          case 2:
            valid = new Validator([args]);
            hash = valid.hash(0);
            pri = valid.i64(1);
            fee = valid.i64(2);

            if (this.mempool) {
              _context47.next = 8;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No mempool available.');

          case 8:
            if (hash) {
              _context47.next = 10;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid TXID');

          case 10:
            if (!(pri == null || fee == null)) {
              _context47.next = 12;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid fee or priority.');

          case 12:
            entry = this.mempool.getEntry(hash);

            if (entry) {
              _context47.next = 15;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Transaction not in mempool.');

          case 15:

            this.mempool.prioritise(entry, pri, fee);

            return _context47.abrupt('return', true);

          case 17:
          case 'end':
            return _context47.stop();
        }
      }
    }, _callee47, this);
  }));

  function prioritiseTransaction(_x90, _x91) {
    return _ref49.apply(this, arguments);
  }

  return prioritiseTransaction;
}();

RPC.prototype.verifyBlock = function () {
  var _ref50 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee48(args, help) {
    var valid, data, block;
    return _regenerator2.default.wrap(function _callee48$(_context48) {
      while (1) {
        switch (_context48.prev = _context48.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context48.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'verifyblock "block-hex"');

          case 2:
            valid = new Validator([args]);
            data = valid.buf(0);

            if (data) {
              _context48.next = 6;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid block hex.');

          case 6:
            if (!this.chain.options.spv) {
              _context48.next = 8;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Cannot verify block in SPV mode.');

          case 8:
            block = Block.fromRaw(data);
            _context48.prev = 9;
            _context48.next = 12;
            return this.chain.verifyBlock(block);

          case 12:
            _context48.next = 19;
            break;

          case 14:
            _context48.prev = 14;
            _context48.t0 = _context48['catch'](9);

            if (!(_context48.t0.type === 'VerifyError')) {
              _context48.next = 18;
              break;
            }

            return _context48.abrupt('return', _context48.t0.reason);

          case 18:
            throw _context48.t0;

          case 19:
            return _context48.abrupt('return', null);

          case 20:
          case 'end':
            return _context48.stop();
        }
      }
    }, _callee48, this, [[9, 14]]);
  }));

  function verifyBlock(_x92, _x93) {
    return _ref50.apply(this, arguments);
  }

  return verifyBlock;
}();

/*
 * Coin generation
 */

RPC.prototype.getGenerate = function () {
  var _ref51 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee49(args, help) {
    return _regenerator2.default.wrap(function _callee49$(_context49) {
      while (1) {
        switch (_context49.prev = _context49.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context49.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getgenerate');

          case 2:
            return _context49.abrupt('return', this.mining);

          case 3:
          case 'end':
            return _context49.stop();
        }
      }
    }, _callee49, this);
  }));

  function getGenerate(_x94, _x95) {
    return _ref51.apply(this, arguments);
  }

  return getGenerate;
}();

RPC.prototype.setGenerate = function () {
  var _ref52 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee50(args, help) {
    var valid, mine, limit;
    return _regenerator2.default.wrap(function _callee50$(_context50) {
      while (1) {
        switch (_context50.prev = _context50.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context50.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'setgenerate mine ( proclimit )');

          case 2:
            valid = new Validator([args]);
            mine = valid.bool(0, false);
            limit = valid.u32(1, 0);

            if (!(mine && this.miner.addresses.length === 0)) {
              _context50.next = 7;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No addresses available for coinbase.');

          case 7:

            this.mining = mine;
            this.procLimit = limit;

            if (!mine) {
              _context50.next = 12;
              break;
            }

            this.miner.cpu.start();
            return _context50.abrupt('return', true);

          case 12:
            _context50.next = 14;
            return this.miner.cpu.stop();

          case 14:
            return _context50.abrupt('return', false);

          case 15:
          case 'end':
            return _context50.stop();
        }
      }
    }, _callee50, this);
  }));

  function setGenerate(_x96, _x97) {
    return _ref52.apply(this, arguments);
  }

  return setGenerate;
}();

RPC.prototype.generate = function () {
  var _ref53 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee51(args, help) {
    var valid, blocks, tries;
    return _regenerator2.default.wrap(function _callee51$(_context51) {
      while (1) {
        switch (_context51.prev = _context51.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context51.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'generate numblocks ( maxtries )');

          case 2:
            valid = new Validator([args]);
            blocks = valid.u32(0, 1);
            tries = valid.u32(1);

            if (!(this.miner.addresses.length === 0)) {
              _context51.next = 7;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No addresses available for coinbase.');

          case 7:
            _context51.next = 9;
            return this.mineBlocks(blocks, null, tries);

          case 9:
            return _context51.abrupt('return', _context51.sent);

          case 10:
          case 'end':
            return _context51.stop();
        }
      }
    }, _callee51, this);
  }));

  function generate(_x98, _x99) {
    return _ref53.apply(this, arguments);
  }

  return generate;
}();

RPC.prototype.generateToAddress = function () {
  var _ref54 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee52(args, help) {
    var valid, blocks, str, tries, addr;
    return _regenerator2.default.wrap(function _callee52$(_context52) {
      while (1) {
        switch (_context52.prev = _context52.next) {
          case 0:
            if (!(help || args.length < 2 || args.length > 3)) {
              _context52.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'generatetoaddress numblocks address ( maxtries )');

          case 2:
            valid = new Validator([args]);
            blocks = valid.u32(0, 1);
            str = valid.str(1, '');
            tries = valid.u32(2);
            addr = parseAddress(str, this.network);
            _context52.next = 9;
            return this.mineBlocks(blocks, addr, tries);

          case 9:
            return _context52.abrupt('return', _context52.sent);

          case 10:
          case 'end':
            return _context52.stop();
        }
      }
    }, _callee52, this);
  }));

  function generateToAddress(_x100, _x101) {
    return _ref54.apply(this, arguments);
  }

  return generateToAddress;
}();

/*
 * Raw transactions
 */

RPC.prototype.createRawTransaction = function () {
  var _ref55 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee53(args, help) {
    var valid, inputs, sendTo, locktime, tx, _iteratorNormalCompletion15, _didIteratorError15, _iteratorError15, _iterator15, _step15, obj, _valid, hash, index, sequence, input, sends, uniq, _iteratorNormalCompletion16, _didIteratorError16, _iteratorError16, _iterator16, _step16, key, _value, _output, addr, b58, value, output;

    return _regenerator2.default.wrap(function _callee53$(_context53) {
      while (1) {
        switch (_context53.prev = _context53.next) {
          case 0:
            if (!(help || args.length < 2 || args.length > 3)) {
              _context53.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'createrawtransaction' + ' [{"txid":"id","vout":n},...]' + ' {"address":amount,"data":"hex",...}' + ' ( locktime )');

          case 2:
            valid = new Validator([args]);
            inputs = valid.array(0);
            sendTo = valid.obj(1);
            locktime = valid.u32(2);

            if (!(!inputs || !sendTo)) {
              _context53.next = 8;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameters (inputs and sendTo).');

          case 8:
            tx = new MTX();


            if (locktime != null) tx.locktime = locktime;

            _iteratorNormalCompletion15 = true;
            _didIteratorError15 = false;
            _iteratorError15 = undefined;
            _context53.prev = 13;
            _iterator15 = (0, _getIterator3.default)(inputs);

          case 15:
            if (_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done) {
              _context53.next = 32;
              break;
            }

            obj = _step15.value;
            _valid = new Validator([obj]);
            hash = _valid.hash('txid');
            index = _valid.u32('vout');
            sequence = _valid.u32('sequence', 0xffffffff);


            if (tx.locktime) sequence--;

            if (!(!hash || index == null)) {
              _context53.next = 24;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid outpoint.');

          case 24:
            input = new Input();

            input.prevout.hash = hash;
            input.prevout.index = index;
            input.sequence = sequence;

            tx.inputs.push(input);

          case 29:
            _iteratorNormalCompletion15 = true;
            _context53.next = 15;
            break;

          case 32:
            _context53.next = 38;
            break;

          case 34:
            _context53.prev = 34;
            _context53.t0 = _context53['catch'](13);
            _didIteratorError15 = true;
            _iteratorError15 = _context53.t0;

          case 38:
            _context53.prev = 38;
            _context53.prev = 39;

            if (!_iteratorNormalCompletion15 && _iterator15.return) {
              _iterator15.return();
            }

          case 41:
            _context53.prev = 41;

            if (!_didIteratorError15) {
              _context53.next = 44;
              break;
            }

            throw _iteratorError15;

          case 44:
            return _context53.finish(41);

          case 45:
            return _context53.finish(38);

          case 46:
            sends = new Validator([sendTo]);
            uniq = new _set2.default();
            _iteratorNormalCompletion16 = true;
            _didIteratorError16 = false;
            _iteratorError16 = undefined;
            _context53.prev = 51;
            _iterator16 = (0, _getIterator3.default)((0, _keys2.default)(sendTo));

          case 53:
            if (_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done) {
              _context53.next = 79;
              break;
            }

            key = _step16.value;

            if (!(key === 'data')) {
              _context53.next = 64;
              break;
            }

            _value = sends.buf(key);

            if (_value) {
              _context53.next = 59;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid nulldata..');

          case 59:
            _output = new Output();

            _output.value = 0;
            _output.script.fromNulldata(_value);
            tx.outputs.push(_output);

            return _context53.abrupt('continue', 76);

          case 64:
            addr = parseAddress(key, this.network);
            b58 = addr.toString(this.network);

            if (!uniq.has(b58)) {
              _context53.next = 68;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Duplicate address');

          case 68:

            uniq.add(b58);

            value = sends.ufixed(key, 8);

            if (!(value == null)) {
              _context53.next = 72;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid output value.');

          case 72:
            output = new Output();

            output.value = value;
            output.script.fromAddress(addr);

            tx.outputs.push(output);

          case 76:
            _iteratorNormalCompletion16 = true;
            _context53.next = 53;
            break;

          case 79:
            _context53.next = 85;
            break;

          case 81:
            _context53.prev = 81;
            _context53.t1 = _context53['catch'](51);
            _didIteratorError16 = true;
            _iteratorError16 = _context53.t1;

          case 85:
            _context53.prev = 85;
            _context53.prev = 86;

            if (!_iteratorNormalCompletion16 && _iterator16.return) {
              _iterator16.return();
            }

          case 88:
            _context53.prev = 88;

            if (!_didIteratorError16) {
              _context53.next = 91;
              break;
            }

            throw _iteratorError16;

          case 91:
            return _context53.finish(88);

          case 92:
            return _context53.finish(85);

          case 93:
            return _context53.abrupt('return', tx.toRaw().toString('hex'));

          case 94:
          case 'end':
            return _context53.stop();
        }
      }
    }, _callee53, this, [[13, 34, 38, 46], [39,, 41, 45], [51, 81, 85, 93], [86,, 88, 92]]);
  }));

  function createRawTransaction(_x102, _x103) {
    return _ref55.apply(this, arguments);
  }

  return createRawTransaction;
}();

RPC.prototype.decodeRawTransaction = function () {
  var _ref56 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee54(args, help) {
    var valid, data, tx;
    return _regenerator2.default.wrap(function _callee54$(_context54) {
      while (1) {
        switch (_context54.prev = _context54.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context54.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'decoderawtransaction "hexstring"');

          case 2:
            valid = new Validator([args]);
            data = valid.buf(0);

            if (data) {
              _context54.next = 6;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid hex string.');

          case 6:
            tx = TX.fromRaw(data);
            return _context54.abrupt('return', this.txToJSON(tx));

          case 8:
          case 'end':
            return _context54.stop();
        }
      }
    }, _callee54, this);
  }));

  function decodeRawTransaction(_x104, _x105) {
    return _ref56.apply(this, arguments);
  }

  return decodeRawTransaction;
}();

RPC.prototype.decodeScript = function () {
  var _ref57 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee55(args, help) {
    var valid, data, script, addr, json;
    return _regenerator2.default.wrap(function _callee55$(_context55) {
      while (1) {
        switch (_context55.prev = _context55.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context55.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'decodescript "hex"');

          case 2:
            valid = new Validator([args]);
            data = valid.buf(0);
            script = new Script();


            if (data) script = Script.fromRaw(data);

            addr = Address.fromScripthash(script.hash160());
            json = this.scriptToJSON(script);

            json.p2sh = addr.toString(this.network);

            return _context55.abrupt('return', json);

          case 10:
          case 'end':
            return _context55.stop();
        }
      }
    }, _callee55, this);
  }));

  function decodeScript(_x106, _x107) {
    return _ref57.apply(this, arguments);
  }

  return decodeScript;
}();

RPC.prototype.getRawTransaction = function () {
  var _ref58 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee56(args, help) {
    var valid, hash, verbose, meta, tx, entry, json;
    return _regenerator2.default.wrap(function _callee56$(_context56) {
      while (1) {
        switch (_context56.prev = _context56.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context56.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getrawtransaction "txid" ( verbose )');

          case 2:
            valid = new Validator([args]);
            hash = valid.hash(0);
            verbose = valid.bool(1, false);

            if (hash) {
              _context56.next = 7;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid TXID.');

          case 7:
            _context56.next = 9;
            return this.node.getMeta(hash);

          case 9:
            meta = _context56.sent;

            if (meta) {
              _context56.next = 12;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Transaction not found.');

          case 12:
            tx = meta.tx;

            if (verbose) {
              _context56.next = 15;
              break;
            }

            return _context56.abrupt('return', tx.toRaw().toString('hex'));

          case 15:
            entry = void 0;

            if (!meta.block) {
              _context56.next = 20;
              break;
            }

            _context56.next = 19;
            return this.chain.getEntry(meta.block);

          case 19:
            entry = _context56.sent;

          case 20:
            json = this.txToJSON(tx, entry);

            json.time = meta.mtime;
            json.hex = tx.toRaw().toString('hex');

            return _context56.abrupt('return', json);

          case 24:
          case 'end':
            return _context56.stop();
        }
      }
    }, _callee56, this);
  }));

  function getRawTransaction(_x108, _x109) {
    return _ref58.apply(this, arguments);
  }

  return getRawTransaction;
}();

RPC.prototype.sendRawTransaction = function () {
  var _ref59 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee57(args, help) {
    var valid, data, tx;
    return _regenerator2.default.wrap(function _callee57$(_context57) {
      while (1) {
        switch (_context57.prev = _context57.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context57.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'sendrawtransaction "hexstring" ( allowhighfees )');

          case 2:
            valid = new Validator([args]);
            data = valid.buf(0);

            if (data) {
              _context57.next = 6;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid hex string.');

          case 6:
            tx = TX.fromRaw(data);


            this.node.relay(tx);

            return _context57.abrupt('return', tx.txid());

          case 9:
          case 'end':
            return _context57.stop();
        }
      }
    }, _callee57, this);
  }));

  function sendRawTransaction(_x110, _x111) {
    return _ref59.apply(this, arguments);
  }

  return sendRawTransaction;
}();

RPC.prototype.signRawTransaction = function () {
  var _ref60 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee58(args, help) {
    var valid, data, prevout, secrets, sighash, tx, map, keys, _valid2, i, secret, key, _iteratorNormalCompletion17, _didIteratorError17, _iteratorError17, _iterator17, _step17, prev, _valid3, hash, index, scriptRaw, value, redeemRaw, outpoint, script, coin, redeem, _iteratorNormalCompletion18, _didIteratorError18, _iteratorError18, _iterator18, _step18, op, _key, type, parts;

    return _regenerator2.default.wrap(function _callee58$(_context58) {
      while (1) {
        switch (_context58.prev = _context58.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 4)) {
              _context58.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'signrawtransaction' + ' "hexstring" (' + ' [{"txid":"id","vout":n,"scriptPubKey":"hex",' + 'redeemScript":"hex"},...] ["privatekey1",...]' + ' sighashtype )');

          case 2:
            valid = new Validator([args]);
            data = valid.buf(0);
            prevout = valid.array(1);
            secrets = valid.array(2);
            sighash = valid.str(3);

            if (data) {
              _context58.next = 9;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid hex string.');

          case 9:
            if (this.mempool) {
              _context58.next = 11;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No mempool available.');

          case 11:
            tx = MTX.fromRaw(data);
            _context58.next = 14;
            return this.mempool.getSpentView(tx);

          case 14:
            tx.view = _context58.sent;
            map = new _map2.default();
            keys = [];


            if (secrets) {
              _valid2 = new Validator([secrets]);

              for (i = 0; i < secrets.length; i++) {
                secret = _valid2.str(i, '');
                key = parseSecret(secret, this.network);

                map.set(key.getPublicKey('hex'), key);
                keys.push(key);
              }
            }

            if (!prevout) {
              _context58.next = 94;
              break;
            }

            _iteratorNormalCompletion17 = true;
            _didIteratorError17 = false;
            _iteratorError17 = undefined;
            _context58.prev = 22;
            _iterator17 = (0, _getIterator3.default)(prevout);

          case 24:
            if (_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done) {
              _context58.next = 80;
              break;
            }

            prev = _step17.value;
            _valid3 = new Validator([prev]);
            hash = _valid3.hash('txid');
            index = _valid3.u32('vout');
            scriptRaw = _valid3.buf('scriptPubKey');
            value = _valid3.ufixed('amount', 8);
            redeemRaw = _valid3.buf('redeemScript');

            if (!(!hash || index == null || !scriptRaw || value == null)) {
              _context58.next = 34;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid UTXO.');

          case 34:
            outpoint = new Outpoint(hash, index);
            script = Script.fromRaw(scriptRaw);
            coin = Output.fromScript(script, value);


            tx.view.addOutput(outpoint, coin);

            if (!(keys.length === 0 || !redeemRaw)) {
              _context58.next = 40;
              break;
            }

            return _context58.abrupt('continue', 77);

          case 40:
            if (!(!script.isScripthash() && !script.isWitnessScripthash())) {
              _context58.next = 42;
              break;
            }

            return _context58.abrupt('continue', 77);

          case 42:
            if (redeemRaw) {
              _context58.next = 44;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'P2SH requires redeem script.');

          case 44:
            redeem = Script.fromRaw(redeemRaw);
            _iteratorNormalCompletion18 = true;
            _didIteratorError18 = false;
            _iteratorError18 = undefined;
            _context58.prev = 48;
            _iterator18 = (0, _getIterator3.default)(redeem.code);

          case 50:
            if (_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done) {
              _context58.next = 63;
              break;
            }

            op = _step18.value;

            if (op.data) {
              _context58.next = 54;
              break;
            }

            return _context58.abrupt('continue', 60);

          case 54:
            _key = map.get(op.data.toString('hex'));

            if (!_key) {
              _context58.next = 60;
              break;
            }

            _key.script = redeem;
            _key.witness = script.isWitnessScripthash();
            _key.refresh();
            return _context58.abrupt('break', 63);

          case 60:
            _iteratorNormalCompletion18 = true;
            _context58.next = 50;
            break;

          case 63:
            _context58.next = 69;
            break;

          case 65:
            _context58.prev = 65;
            _context58.t0 = _context58['catch'](48);
            _didIteratorError18 = true;
            _iteratorError18 = _context58.t0;

          case 69:
            _context58.prev = 69;
            _context58.prev = 70;

            if (!_iteratorNormalCompletion18 && _iterator18.return) {
              _iterator18.return();
            }

          case 72:
            _context58.prev = 72;

            if (!_didIteratorError18) {
              _context58.next = 75;
              break;
            }

            throw _iteratorError18;

          case 75:
            return _context58.finish(72);

          case 76:
            return _context58.finish(69);

          case 77:
            _iteratorNormalCompletion17 = true;
            _context58.next = 24;
            break;

          case 80:
            _context58.next = 86;
            break;

          case 82:
            _context58.prev = 82;
            _context58.t1 = _context58['catch'](22);
            _didIteratorError17 = true;
            _iteratorError17 = _context58.t1;

          case 86:
            _context58.prev = 86;
            _context58.prev = 87;

            if (!_iteratorNormalCompletion17 && _iterator17.return) {
              _iterator17.return();
            }

          case 89:
            _context58.prev = 89;

            if (!_didIteratorError17) {
              _context58.next = 92;
              break;
            }

            throw _iteratorError17;

          case 92:
            return _context58.finish(89);

          case 93:
            return _context58.finish(86);

          case 94:
            type = Script.hashType.ALL;

            if (!sighash) {
              _context58.next = 106;
              break;
            }

            parts = sighash.split('|');

            if (!(parts.length < 1 || parts.length > 2)) {
              _context58.next = 99;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid sighash type.');

          case 99:

            type = Script.hashType[parts[0]];

            if (!(type == null)) {
              _context58.next = 102;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid sighash type.');

          case 102:
            if (!(parts.length === 2)) {
              _context58.next = 106;
              break;
            }

            if (!(parts[1] !== 'ANYONECANPAY')) {
              _context58.next = 105;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid sighash type.');

          case 105:
            type |= Script.hashType.ANYONECANPAY;

          case 106:
            _context58.next = 108;
            return tx.signAsync(keys, type, this.workers);

          case 108:
            return _context58.abrupt('return', {
              hex: tx.toRaw().toString('hex'),
              complete: tx.isSigned()
            });

          case 109:
          case 'end':
            return _context58.stop();
        }
      }
    }, _callee58, this, [[22, 82, 86, 94], [48, 65, 69, 77], [70,, 72, 76], [87,, 89, 93]]);
  }));

  function signRawTransaction(_x112, _x113) {
    return _ref60.apply(this, arguments);
  }

  return signRawTransaction;
}();

/*
 * Utility Functions
 */

RPC.prototype.createMultisig = function () {
  var _ref61 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee59(args, help) {
    var valid, keys, m, n, items, i, key, script, addr;
    return _regenerator2.default.wrap(function _callee59$(_context59) {
      while (1) {
        switch (_context59.prev = _context59.next) {
          case 0:
            if (!(help || args.length < 2 || args.length > 2)) {
              _context59.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'createmultisig nrequired ["key",...]');

          case 2:
            valid = new Validator([args]);
            keys = valid.array(1, []);
            m = valid.u32(0, 0);
            n = keys.length;

            if (!(m < 1 || n < m || n > 16)) {
              _context59.next = 8;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid m and n values.');

          case 8:
            items = new Validator([keys]);
            i = 0;

          case 10:
            if (!(i < keys.length)) {
              _context59.next = 20;
              break;
            }

            key = items.buf(i);

            if (key) {
              _context59.next = 14;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid key.');

          case 14:
            if (secp256k1.publicKeyVerify(key)) {
              _context59.next = 16;
              break;
            }

            throw new RPCError(errs.INVALID_ADDRESS_OR_KEY, 'Invalid key.');

          case 16:

            keys[i] = key;

          case 17:
            i++;
            _context59.next = 10;
            break;

          case 20:
            script = Script.fromMultisig(m, n, keys);

            if (!(script.getSize() > consensus.MAX_SCRIPT_PUSH)) {
              _context59.next = 23;
              break;
            }

            throw new RPCError(errs.VERIFY_ERROR, 'Redeem script exceeds size limit.');

          case 23:
            addr = script.getAddress();
            return _context59.abrupt('return', {
              address: addr.toString(this.network),
              redeemScript: script.toJSON()
            });

          case 25:
          case 'end':
            return _context59.stop();
        }
      }
    }, _callee59, this);
  }));

  function createMultisig(_x114, _x115) {
    return _ref61.apply(this, arguments);
  }

  return createMultisig;
}();

RPC.prototype.createWitnessAddress = function () {
  var _ref62 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee60(args, help) {
    var valid, raw, script, program, addr;
    return _regenerator2.default.wrap(function _callee60$(_context60) {
      while (1) {
        switch (_context60.prev = _context60.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context60.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'createwitnessaddress "script"');

          case 2:
            valid = new Validator([args]);
            raw = valid.buf(0);

            if (raw) {
              _context60.next = 6;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid script hex.');

          case 6:
            script = Script.fromRaw(raw);
            program = script.forWitness();
            addr = program.getAddress();
            return _context60.abrupt('return', {
              address: addr.toString(this.network),
              witnessScript: program.toJSON()
            });

          case 10:
          case 'end':
            return _context60.stop();
        }
      }
    }, _callee60, this);
  }));

  function createWitnessAddress(_x116, _x117) {
    return _ref62.apply(this, arguments);
  }

  return createWitnessAddress;
}();

RPC.prototype.validateAddress = function () {
  var _ref63 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee61(args, help) {
    var valid, str, addr, script;
    return _regenerator2.default.wrap(function _callee61$(_context61) {
      while (1) {
        switch (_context61.prev = _context61.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context61.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'validateaddress "bitcoinaddress"');

          case 2:
            valid = new Validator([args]);
            str = valid.str(0, '');
            addr = void 0;
            _context61.prev = 5;

            addr = Address.fromString(str, this.network);
            _context61.next = 12;
            break;

          case 9:
            _context61.prev = 9;
            _context61.t0 = _context61['catch'](5);
            return _context61.abrupt('return', {
              isvalid: false
            });

          case 12:
            script = Script.fromAddress(addr);
            return _context61.abrupt('return', {
              isvalid: true,
              address: addr.toString(this.network),
              scriptPubKey: script.toJSON(),
              ismine: false,
              iswatchonly: false
            });

          case 14:
          case 'end':
            return _context61.stop();
        }
      }
    }, _callee61, this, [[5, 9]]);
  }));

  function validateAddress(_x118, _x119) {
    return _ref63.apply(this, arguments);
  }

  return validateAddress;
}();

RPC.prototype.verifyMessage = function () {
  var _ref64 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee62(args, help) {
    var valid, b58, sig, str, addr, msg, hash, key;
    return _regenerator2.default.wrap(function _callee62$(_context62) {
      while (1) {
        switch (_context62.prev = _context62.next) {
          case 0:
            if (!(help || args.length !== 3)) {
              _context62.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'verifymessage "bitcoinaddress" "signature" "message"');

          case 2:
            valid = new Validator([args]);
            b58 = valid.str(0, '');
            sig = valid.buf(1, null, 'base64');
            str = valid.str(2);

            if (!(!sig || !str)) {
              _context62.next = 8;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameters.');

          case 8:
            addr = parseAddress(b58, this.network);
            msg = Buffer.from(MAGIC_STRING + str, 'utf8');
            hash = digest.hash256(msg);
            key = secp256k1.recover(hash, sig, 0, true);

            if (key) {
              _context62.next = 14;
              break;
            }

            return _context62.abrupt('return', false);

          case 14:
            return _context62.abrupt('return', ccmp(digest.hash160(key), addr.hash));

          case 15:
          case 'end':
            return _context62.stop();
        }
      }
    }, _callee62, this);
  }));

  function verifyMessage(_x120, _x121) {
    return _ref64.apply(this, arguments);
  }

  return verifyMessage;
}();

RPC.prototype.signMessageWithPrivkey = function () {
  var _ref65 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee63(args, help) {
    var valid, wif, str, key, msg, hash, sig;
    return _regenerator2.default.wrap(function _callee63$(_context63) {
      while (1) {
        switch (_context63.prev = _context63.next) {
          case 0:
            if (!(help || args.length !== 2)) {
              _context63.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'signmessagewithprivkey "privkey" "message"');

          case 2:
            valid = new Validator([args]);
            wif = valid.str(0, '');
            str = valid.str(1, '');
            key = parseSecret(wif, this.network);
            msg = Buffer.from(MAGIC_STRING + str, 'utf8');
            hash = digest.hash256(msg);
            sig = key.sign(hash);
            return _context63.abrupt('return', sig.toString('base64'));

          case 10:
          case 'end':
            return _context63.stop();
        }
      }
    }, _callee63, this);
  }));

  function signMessageWithPrivkey(_x122, _x123) {
    return _ref65.apply(this, arguments);
  }

  return signMessageWithPrivkey;
}();

RPC.prototype.estimateFee = function () {
  var _ref66 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee64(args, help) {
    var valid, blocks, fee;
    return _regenerator2.default.wrap(function _callee64$(_context64) {
      while (1) {
        switch (_context64.prev = _context64.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context64.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'estimatefee nblocks');

          case 2:
            valid = new Validator([args]);
            blocks = valid.u32(0, 1);

            if (this.fees) {
              _context64.next = 6;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Fee estimation not available.');

          case 6:
            fee = this.fees.estimateFee(blocks, false);

            if (!(fee === 0)) {
              _context64.next = 9;
              break;
            }

            return _context64.abrupt('return', -1);

          case 9:
            return _context64.abrupt('return', Amount.btc(fee, true));

          case 10:
          case 'end':
            return _context64.stop();
        }
      }
    }, _callee64, this);
  }));

  function estimateFee(_x124, _x125) {
    return _ref66.apply(this, arguments);
  }

  return estimateFee;
}();

RPC.prototype.estimatePriority = function () {
  var _ref67 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee65(args, help) {
    var valid, blocks;
    return _regenerator2.default.wrap(function _callee65$(_context65) {
      while (1) {
        switch (_context65.prev = _context65.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context65.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'estimatepriority nblocks');

          case 2:
            valid = new Validator([args]);
            blocks = valid.u32(0, 1);

            if (this.fees) {
              _context65.next = 6;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Priority estimation not available.');

          case 6:
            return _context65.abrupt('return', this.fees.estimatePriority(blocks, false));

          case 7:
          case 'end':
            return _context65.stop();
        }
      }
    }, _callee65, this);
  }));

  function estimatePriority(_x126, _x127) {
    return _ref67.apply(this, arguments);
  }

  return estimatePriority;
}();

RPC.prototype.estimateSmartFee = function () {
  var _ref68 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee66(args, help) {
    var valid, blocks, fee;
    return _regenerator2.default.wrap(function _callee66$(_context66) {
      while (1) {
        switch (_context66.prev = _context66.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context66.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'estimatesmartfee nblocks');

          case 2:
            valid = new Validator([args]);
            blocks = valid.u32(0, 1);

            if (this.fees) {
              _context66.next = 6;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Fee estimation not available.');

          case 6:
            fee = this.fees.estimateFee(blocks, true);


            if (fee === 0) fee = -1;else fee = Amount.btc(fee, true);

            return _context66.abrupt('return', {
              fee: fee,
              blocks: blocks
            });

          case 9:
          case 'end':
            return _context66.stop();
        }
      }
    }, _callee66, this);
  }));

  function estimateSmartFee(_x128, _x129) {
    return _ref68.apply(this, arguments);
  }

  return estimateSmartFee;
}();

RPC.prototype.estimateSmartPriority = function () {
  var _ref69 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee67(args, help) {
    var valid, blocks, pri;
    return _regenerator2.default.wrap(function _callee67$(_context67) {
      while (1) {
        switch (_context67.prev = _context67.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context67.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'estimatesmartpriority nblocks');

          case 2:
            valid = new Validator([args]);
            blocks = valid.u32(0, 1);

            if (this.fees) {
              _context67.next = 6;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Priority estimation not available.');

          case 6:
            pri = this.fees.estimatePriority(blocks, true);
            return _context67.abrupt('return', {
              priority: pri,
              blocks: blocks
            });

          case 8:
          case 'end':
            return _context67.stop();
        }
      }
    }, _callee67, this);
  }));

  function estimateSmartPriority(_x130, _x131) {
    return _ref69.apply(this, arguments);
  }

  return estimateSmartPriority;
}();

RPC.prototype.invalidateBlock = function () {
  var _ref70 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee68(args, help) {
    var valid, hash;
    return _regenerator2.default.wrap(function _callee68$(_context68) {
      while (1) {
        switch (_context68.prev = _context68.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context68.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'invalidateblock "hash"');

          case 2:
            valid = new Validator([args]);
            hash = valid.hash(0);

            if (hash) {
              _context68.next = 6;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid block hash.');

          case 6:
            _context68.next = 8;
            return this.chain.invalidate(hash);

          case 8:
            return _context68.abrupt('return', null);

          case 9:
          case 'end':
            return _context68.stop();
        }
      }
    }, _callee68, this);
  }));

  function invalidateBlock(_x132, _x133) {
    return _ref70.apply(this, arguments);
  }

  return invalidateBlock;
}();

RPC.prototype.reconsiderBlock = function () {
  var _ref71 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee69(args, help) {
    var valid, hash;
    return _regenerator2.default.wrap(function _callee69$(_context69) {
      while (1) {
        switch (_context69.prev = _context69.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context69.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'reconsiderblock "hash"');

          case 2:
            valid = new Validator([args]);
            hash = valid.hash(0);

            if (hash) {
              _context69.next = 6;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid block hash.');

          case 6:

            this.chain.removeInvalid(hash);

            return _context69.abrupt('return', null);

          case 8:
          case 'end':
            return _context69.stop();
        }
      }
    }, _callee69, this);
  }));

  function reconsiderBlock(_x134, _x135) {
    return _ref71.apply(this, arguments);
  }

  return reconsiderBlock;
}();

RPC.prototype.setMockTime = function () {
  var _ref72 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee70(args, help) {
    var valid, time, delta;
    return _regenerator2.default.wrap(function _callee70$(_context70) {
      while (1) {
        switch (_context70.prev = _context70.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context70.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'setmocktime timestamp');

          case 2:
            valid = new Validator([args]);
            time = valid.u32(0);

            if (!(time == null)) {
              _context70.next = 6;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid timestamp.');

          case 6:

            this.network.time.offset = 0;

            delta = this.network.now() - time;


            this.network.time.offset = -delta;

            return _context70.abrupt('return', null);

          case 10:
          case 'end':
            return _context70.stop();
        }
      }
    }, _callee70, this);
  }));

  function setMockTime(_x136, _x137) {
    return _ref72.apply(this, arguments);
  }

  return setMockTime;
}();

RPC.prototype.getMemoryInfo = function () {
  var _ref73 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee71(args, help) {
    return _regenerator2.default.wrap(function _callee71$(_context71) {
      while (1) {
        switch (_context71.prev = _context71.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context71.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getmemoryinfo');

          case 2:
            return _context71.abrupt('return', util.memoryUsage());

          case 3:
          case 'end':
            return _context71.stop();
        }
      }
    }, _callee71, this);
  }));

  function getMemoryInfo(_x138, _x139) {
    return _ref73.apply(this, arguments);
  }

  return getMemoryInfo;
}();

RPC.prototype.setLogLevel = function () {
  var _ref74 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee72(args, help) {
    var valid, level;
    return _regenerator2.default.wrap(function _callee72$(_context72) {
      while (1) {
        switch (_context72.prev = _context72.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context72.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'setloglevel "level"');

          case 2:
            valid = new Validator([args]);
            level = valid.str(0, '');


            this.logger.setLevel(level);

            return _context72.abrupt('return', null);

          case 6:
          case 'end':
            return _context72.stop();
        }
      }
    }, _callee72, this);
  }));

  function setLogLevel(_x140, _x141) {
    return _ref74.apply(this, arguments);
  }

  return setLogLevel;
}();

/*
 * Helpers
 */

RPC.prototype.handleLongpoll = function () {
  var _ref75 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee73(lpid) {
    var watched, lastTX, hash;
    return _regenerator2.default.wrap(function _callee73$(_context73) {
      while (1) {
        switch (_context73.prev = _context73.next) {
          case 0:
            if (!(lpid.length !== 74)) {
              _context73.next = 2;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid longpoll ID.');

          case 2:
            watched = lpid.slice(0, 64);
            lastTX = parseInt(lpid.slice(64, 74), 10);

            if (!(!util.isHex(watched) || !util.isU32(lastTX))) {
              _context73.next = 6;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid longpoll ID.');

          case 6:
            hash = util.revHex(watched);

            if (!(this.chain.tip.hash !== hash)) {
              _context73.next = 9;
              break;
            }

            return _context73.abrupt('return');

          case 9:
            _context73.next = 11;
            return this.longpoll();

          case 11:
          case 'end':
            return _context73.stop();
        }
      }
    }, _callee73, this);
  }));

  function handleLongpoll(_x142) {
    return _ref75.apply(this, arguments);
  }

  return handleLongpoll;
}();

RPC.prototype.longpoll = function longpoll() {
  var _this = this;

  return new _promise2.default(function (resolve, reject) {
    _this.pollers.push(co.job(resolve, reject));
  });
};

RPC.prototype.refreshBlock = function refreshBlock() {
  var pollers = this.pollers;

  this.attempt = null;
  this.lastActivity = 0;
  this.merkleMap.clear();
  this.nonce1 = 0;
  this.nonce2 = 0;
  this.pollers = [];

  var _iteratorNormalCompletion19 = true;
  var _didIteratorError19 = false;
  var _iteratorError19 = undefined;

  try {
    for (var _iterator19 = (0, _getIterator3.default)(pollers), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
      var job = _step19.value;

      job.resolve();
    }
  } catch (err) {
    _didIteratorError19 = true;
    _iteratorError19 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion19 && _iterator19.return) {
        _iterator19.return();
      }
    } finally {
      if (_didIteratorError19) {
        throw _iteratorError19;
      }
    }
  }
};

RPC.prototype.bindChain = function bindChain() {
  var _this2 = this;

  if (this.boundChain) return;

  this.boundChain = true;

  this.node.on('connect', function () {
    if (!_this2.attempt) return;

    _this2.refreshBlock();
  });

  if (!this.mempool) return;

  this.node.on('tx', function () {
    if (!_this2.attempt) return;

    if (util.now() - _this2.lastActivity > 10) _this2.refreshBlock();
  });
};

RPC.prototype.getTemplate = function () {
  var _ref76 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee74() {
    var attempt;
    return _regenerator2.default.wrap(function _callee74$(_context74) {
      while (1) {
        switch (_context74.prev = _context74.next) {
          case 0:
            this.bindChain();

            attempt = this.attempt;

            if (!attempt) {
              _context74.next = 6;
              break;
            }

            this.miner.updateTime(attempt);
            _context74.next = 11;
            break;

          case 6:
            _context74.next = 8;
            return this.miner.createBlock();

          case 8:
            attempt = _context74.sent;

            this.attempt = attempt;
            this.lastActivity = util.now();

          case 11:
            return _context74.abrupt('return', attempt);

          case 12:
          case 'end':
            return _context74.stop();
        }
      }
    }, _callee74, this);
  }));

  function getTemplate() {
    return _ref76.apply(this, arguments);
  }

  return getTemplate;
}();

RPC.prototype.updateWork = function () {
  var _ref77 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee75() {
    var attempt, _n, _n2, _root, _hash3, n1, n2, root, hash;

    return _regenerator2.default.wrap(function _callee75$(_context75) {
      while (1) {
        switch (_context75.prev = _context75.next) {
          case 0:
            this.bindChain();

            attempt = this.attempt;

            if (!attempt) {
              _context75.next = 13;
              break;
            }

            if (!attempt.address.isNull()) {
              _context75.next = 5;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No addresses available for coinbase.');

          case 5:

            this.miner.updateTime(attempt);

            if (++this.nonce2 === 0x100000000) {
              this.nonce2 = 0;
              this.nonce1++;
            }

            _n = this.nonce1;
            _n2 = this.nonce2;
            _root = attempt.getRoot(_n, _n2);
            _hash3 = _root.toString('hex');


            this.merkleMap.set(_hash3, [_n, _n2]);

            return _context75.abrupt('return', attempt);

          case 13:
            if (!(this.miner.addresses.length === 0)) {
              _context75.next = 15;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'No addresses available for coinbase.');

          case 15:
            _context75.next = 17;
            return this.miner.createBlock();

          case 17:
            attempt = _context75.sent;
            n1 = this.nonce1;
            n2 = this.nonce2;
            root = attempt.getRoot(n1, n2);
            hash = root.toString('hex');


            this.attempt = attempt;
            this.lastActivity = util.now();
            this.merkleMap.set(hash, [n1, n2]);

            return _context75.abrupt('return', attempt);

          case 26:
          case 'end':
            return _context75.stop();
        }
      }
    }, _callee75, this);
  }));

  function updateWork() {
    return _ref77.apply(this, arguments);
  }

  return updateWork;
}();

RPC.prototype.addBlock = function () {
  var _ref78 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee76(block) {
    var unlock1, unlock2;
    return _regenerator2.default.wrap(function _callee76$(_context76) {
      while (1) {
        switch (_context76.prev = _context76.next) {
          case 0:
            _context76.next = 2;
            return this.locker.lock();

          case 2:
            unlock1 = _context76.sent;
            _context76.next = 5;
            return this.chain.locker.lock();

          case 5:
            unlock2 = _context76.sent;
            _context76.prev = 6;
            _context76.next = 9;
            return this._addBlock(block);

          case 9:
            return _context76.abrupt('return', _context76.sent);

          case 10:
            _context76.prev = 10;

            unlock2();
            unlock1();
            return _context76.finish(10);

          case 14:
          case 'end':
            return _context76.stop();
        }
      }
    }, _callee76, this, [[6,, 10, 14]]);
  }));

  function addBlock(_x143) {
    return _ref78.apply(this, arguments);
  }

  return addBlock;
}();

RPC.prototype._addBlock = function () {
  var _ref79 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee77(block) {
    var prev, state, tx, input, entry;
    return _regenerator2.default.wrap(function _callee77$(_context77) {
      while (1) {
        switch (_context77.prev = _context77.next) {
          case 0:
            this.logger.info('Handling submitted block: %s.', block.rhash());

            _context77.next = 3;
            return this.chain.getEntry(block.prevBlock);

          case 3:
            prev = _context77.sent;

            if (!prev) {
              _context77.next = 9;
              break;
            }

            _context77.next = 7;
            return this.chain.getDeployments(block.time, prev);

          case 7:
            state = _context77.sent;


            // Fix eloipool bug (witness nonce is not present).
            if (state.hasWitness() && block.getCommitmentHash()) {
              tx = block.txs[0];
              input = tx.inputs[0];

              if (!tx.hasWitness()) {
                this.logger.warning('Submitted block had no witness nonce.');
                this.logger.debug(tx);

                // Recreate witness nonce (all zeroes).
                input.witness.push(encoding.ZERO_HASH);
                input.witness.compile();

                tx.refresh();
                block.refresh();
              }
            }

          case 9:
            entry = void 0;
            _context77.prev = 10;
            _context77.next = 13;
            return this.chain._add(block);

          case 13:
            entry = _context77.sent;
            _context77.next = 22;
            break;

          case 16:
            _context77.prev = 16;
            _context77.t0 = _context77['catch'](10);

            if (!(_context77.t0.type === 'VerifyError')) {
              _context77.next = 21;
              break;
            }

            this.logger.warning('RPC block rejected: %s (%s).', block.rhash(), _context77.t0.reason);
            return _context77.abrupt('return', 'rejected: ' + _context77.t0.reason);

          case 21:
            throw _context77.t0;

          case 22:
            if (entry) {
              _context77.next = 25;
              break;
            }

            this.logger.warning('RPC block rejected: %s (bad-prevblk).', block.rhash());
            return _context77.abrupt('return', 'rejected: bad-prevblk');

          case 25:
            return _context77.abrupt('return', null);

          case 26:
          case 'end':
            return _context77.stop();
        }
      }
    }, _callee77, this, [[10, 16]]);
  }));

  function _addBlock(_x144) {
    return _ref79.apply(this, arguments);
  }

  return _addBlock;
}();

RPC.prototype.totalTX = function totalTX() {
  return this.mempool ? this.mempool.map.size : 0;
};

RPC.prototype.getSoftforks = function getSoftforks() {
  return [toDeployment('bip34', 2, this.chain.state.hasBIP34()), toDeployment('bip66', 3, this.chain.state.hasBIP66()), toDeployment('bip65', 4, this.chain.state.hasCLTV())];
};

RPC.prototype.getBIP9Softforks = function () {
  var _ref80 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee78() {
    var tip, forks, _iteratorNormalCompletion20, _didIteratorError20, _iteratorError20, _iterator20, _step20, deployment, state, status;

    return _regenerator2.default.wrap(function _callee78$(_context78) {
      while (1) {
        switch (_context78.prev = _context78.next) {
          case 0:
            tip = this.chain.tip;
            forks = {};
            _iteratorNormalCompletion20 = true;
            _didIteratorError20 = false;
            _iteratorError20 = undefined;
            _context78.prev = 5;
            _iterator20 = (0, _getIterator3.default)(this.network.deploys);

          case 7:
            if (_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done) {
              _context78.next = 32;
              break;
            }

            deployment = _step20.value;
            _context78.next = 11;
            return this.chain.getState(tip, deployment);

          case 11:
            state = _context78.sent;
            status = void 0;
            _context78.t0 = state;
            _context78.next = _context78.t0 === common.thresholdStates.DEFINED ? 16 : _context78.t0 === common.thresholdStates.STARTED ? 18 : _context78.t0 === common.thresholdStates.LOCKED_IN ? 20 : _context78.t0 === common.thresholdStates.ACTIVE ? 22 : _context78.t0 === common.thresholdStates.FAILED ? 24 : 26;
            break;

          case 16:
            status = 'defined';
            return _context78.abrupt('break', 28);

          case 18:
            status = 'started';
            return _context78.abrupt('break', 28);

          case 20:
            status = 'locked_in';
            return _context78.abrupt('break', 28);

          case 22:
            status = 'active';
            return _context78.abrupt('break', 28);

          case 24:
            status = 'failed';
            return _context78.abrupt('break', 28);

          case 26:
            assert(false, 'Bad state.');
            return _context78.abrupt('break', 28);

          case 28:

            forks[deployment.name] = {
              status: status,
              bit: deployment.bit,
              startTime: deployment.startTime,
              timeout: deployment.timeout
            };

          case 29:
            _iteratorNormalCompletion20 = true;
            _context78.next = 7;
            break;

          case 32:
            _context78.next = 38;
            break;

          case 34:
            _context78.prev = 34;
            _context78.t1 = _context78['catch'](5);
            _didIteratorError20 = true;
            _iteratorError20 = _context78.t1;

          case 38:
            _context78.prev = 38;
            _context78.prev = 39;

            if (!_iteratorNormalCompletion20 && _iterator20.return) {
              _iterator20.return();
            }

          case 41:
            _context78.prev = 41;

            if (!_didIteratorError20) {
              _context78.next = 44;
              break;
            }

            throw _iteratorError20;

          case 44:
            return _context78.finish(41);

          case 45:
            return _context78.finish(38);

          case 46:
            return _context78.abrupt('return', forks);

          case 47:
          case 'end':
            return _context78.stop();
        }
      }
    }, _callee78, this, [[5, 34, 38, 46], [39,, 41, 45]]);
  }));

  function getBIP9Softforks() {
    return _ref80.apply(this, arguments);
  }

  return getBIP9Softforks;
}();

RPC.prototype.getHashRate = function () {
  var _ref81 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee79(lookup, height) {
    var tip, min, max, entry, i, diff, work;
    return _regenerator2.default.wrap(function _callee79$(_context79) {
      while (1) {
        switch (_context79.prev = _context79.next) {
          case 0:
            tip = this.chain.tip;

            if (!(height != null)) {
              _context79.next = 5;
              break;
            }

            _context79.next = 4;
            return this.chain.getEntry(height);

          case 4:
            tip = _context79.sent;

          case 5:
            if (tip) {
              _context79.next = 7;
              break;
            }

            return _context79.abrupt('return', 0);

          case 7:

            assert(typeof lookup === 'number');
            assert(lookup >= 0);

            if (lookup === 0) lookup = tip.height % this.network.pow.retargetInterval + 1;

            if (lookup > tip.height) lookup = tip.height;

            min = tip.time;
            max = min;
            entry = tip;
            i = 0;

          case 15:
            if (!(i < lookup)) {
              _context79.next = 26;
              break;
            }

            _context79.next = 18;
            return this.chain.getPrevious(entry);

          case 18:
            entry = _context79.sent;

            if (entry) {
              _context79.next = 21;
              break;
            }

            throw new RPCError(errs.DATABASE_ERROR, 'Not found.');

          case 21:

            min = Math.min(entry.time, min);
            max = Math.max(entry.time, max);

          case 23:
            i++;
            _context79.next = 15;
            break;

          case 26:
            diff = max - min;

            if (!(diff === 0)) {
              _context79.next = 29;
              break;
            }

            return _context79.abrupt('return', 0);

          case 29:
            work = tip.chainwork.sub(entry.chainwork);
            return _context79.abrupt('return', Number(work.toString()) / diff);

          case 31:
          case 'end':
            return _context79.stop();
        }
      }
    }, _callee79, this);
  }));

  function getHashRate(_x145, _x146) {
    return _ref81.apply(this, arguments);
  }

  return getHashRate;
}();

RPC.prototype.mineBlocks = function () {
  var _ref82 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee80(blocks, addr, tries) {
    var unlock;
    return _regenerator2.default.wrap(function _callee80$(_context80) {
      while (1) {
        switch (_context80.prev = _context80.next) {
          case 0:
            _context80.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context80.sent;
            _context80.prev = 3;
            _context80.next = 6;
            return this._mineBlocks(blocks, addr, tries);

          case 6:
            return _context80.abrupt('return', _context80.sent);

          case 7:
            _context80.prev = 7;

            unlock();
            return _context80.finish(7);

          case 10:
          case 'end':
            return _context80.stop();
        }
      }
    }, _callee80, this, [[3,, 7, 10]]);
  }));

  function mineBlocks(_x147, _x148, _x149) {
    return _ref82.apply(this, arguments);
  }

  return mineBlocks;
}();

RPC.prototype._mineBlocks = function () {
  var _ref83 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee81(blocks, addr, tries) {
    var hashes, i, block, entry;
    return _regenerator2.default.wrap(function _callee81$(_context81) {
      while (1) {
        switch (_context81.prev = _context81.next) {
          case 0:
            hashes = [];
            i = 0;

          case 2:
            if (!(i < blocks)) {
              _context81.next = 14;
              break;
            }

            _context81.next = 5;
            return this.miner.mineBlock(null, addr);

          case 5:
            block = _context81.sent;
            _context81.next = 8;
            return this.chain.add(block);

          case 8:
            entry = _context81.sent;

            assert(entry);
            hashes.push(entry.rhash());

          case 11:
            i++;
            _context81.next = 2;
            break;

          case 14:
            return _context81.abrupt('return', hashes);

          case 15:
          case 'end':
            return _context81.stop();
        }
      }
    }, _callee81, this);
  }));

  function _mineBlocks(_x150, _x151, _x152) {
    return _ref83.apply(this, arguments);
  }

  return _mineBlocks;
}();

RPC.prototype.findFork = function () {
  var _ref84 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee82(entry) {
    return _regenerator2.default.wrap(function _callee82$(_context82) {
      while (1) {
        switch (_context82.prev = _context82.next) {
          case 0:
            if (!entry) {
              _context82.next = 10;
              break;
            }

            _context82.next = 3;
            return this.chain.isMainChain(entry);

          case 3:
            if (!_context82.sent) {
              _context82.next = 5;
              break;
            }

            return _context82.abrupt('return', entry);

          case 5:
            _context82.next = 7;
            return this.chain.getPrevious(entry);

          case 7:
            entry = _context82.sent;
            _context82.next = 0;
            break;

          case 10:
            throw new Error('Fork not found.');

          case 11:
          case 'end':
            return _context82.stop();
        }
      }
    }, _callee82, this);
  }));

  function findFork(_x153) {
    return _ref84.apply(this, arguments);
  }

  return findFork;
}();

RPC.prototype.txToJSON = function txToJSON(tx, entry) {
  var height = -1;
  var time = 0;
  var hash = null;
  var conf = 0;

  if (entry) {
    height = entry.height;
    time = entry.time;
    hash = entry.rhash();
    conf = this.chain.height - height + 1;
  }

  var vin = [];

  var _iteratorNormalCompletion21 = true;
  var _didIteratorError21 = false;
  var _iteratorError21 = undefined;

  try {
    for (var _iterator21 = (0, _getIterator3.default)(tx.inputs), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
      var input = _step21.value;

      var json = {
        coinbase: undefined,
        txid: undefined,
        scriptSig: undefined,
        txinwitness: undefined,
        sequence: input.sequence
      };

      if (tx.isCoinbase()) {
        json.coinbase = input.script.toJSON();
      } else {
        json.txid = input.prevout.txid();
        json.vout = input.prevout.index;
        json.scriptSig = {
          asm: input.script.toASM(),
          hex: input.script.toJSON()
        };
      }

      if (input.witness.items.length > 0) {
        json.txinwitness = input.witness.items.map(function (item) {
          return item.toString('hex');
        });
      }

      vin.push(json);
    }
  } catch (err) {
    _didIteratorError21 = true;
    _iteratorError21 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion21 && _iterator21.return) {
        _iterator21.return();
      }
    } finally {
      if (_didIteratorError21) {
        throw _iteratorError21;
      }
    }
  }

  var vout = [];

  for (var i = 0; i < tx.outputs.length; i++) {
    var output = tx.outputs[i];
    vout.push({
      value: Amount.btc(output.value, true),
      n: i,
      scriptPubKey: this.scriptToJSON(output.script, true)
    });
  }

  return {
    txid: tx.txid(),
    hash: tx.wtxid(),
    size: tx.getSize(),
    vsize: tx.getVirtualSize(),
    version: tx.version,
    locktime: tx.locktime,
    vin: vin,
    vout: vout,
    blockhash: hash,
    confirmations: conf,
    time: time,
    blocktime: time,
    hex: undefined
  };
};

RPC.prototype.scriptToJSON = function scriptToJSON(script, hex) {
  var type = script.getType();

  var json = {
    asm: script.toASM(),
    hex: undefined,
    type: Script.typesByVal[type],
    reqSigs: 1,
    addresses: [],
    p2sh: undefined
  };

  if (hex) json.hex = script.toJSON();

  var _script$getMultisig = script.getMultisig(),
      _script$getMultisig2 = (0, _slicedToArray3.default)(_script$getMultisig, 1),
      m = _script$getMultisig2[0];

  if (m !== -1) json.reqSigs = m;

  var addr = script.getAddress();

  if (addr) {
    var str = addr.toString(this.network);
    json.addresses.push(str);
  }

  return json;
};

RPC.prototype.headerToJSON = function () {
  var _ref85 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee83(entry) {
    var mtp, next;
    return _regenerator2.default.wrap(function _callee83$(_context83) {
      while (1) {
        switch (_context83.prev = _context83.next) {
          case 0:
            _context83.next = 2;
            return this.chain.getMedianTime(entry);

          case 2:
            mtp = _context83.sent;
            _context83.next = 5;
            return this.chain.getNextHash(entry.hash);

          case 5:
            next = _context83.sent;
            return _context83.abrupt('return', {
              hash: entry.rhash(),
              confirmations: this.chain.height - entry.height + 1,
              height: entry.height,
              version: entry.version,
              versionHex: util.hex32(entry.version),
              merkleroot: util.revHex(entry.merkleRoot),
              time: entry.time,
              mediantime: mtp,
              bits: entry.bits,
              difficulty: toDifficulty(entry.bits),
              chainwork: entry.chainwork.toString('hex', 64),
              previousblockhash: entry.prevBlock !== encoding.NULL_HASH ? util.revHex(entry.prevBlock) : null,
              nextblockhash: next ? util.revHex(next) : null
            });

          case 7:
          case 'end':
            return _context83.stop();
        }
      }
    }, _callee83, this);
  }));

  function headerToJSON(_x154) {
    return _ref85.apply(this, arguments);
  }

  return headerToJSON;
}();

RPC.prototype.blockToJSON = function () {
  var _ref86 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee84(entry, block, details) {
    var mtp, next, txs, _iteratorNormalCompletion22, _didIteratorError22, _iteratorError22, _iterator22, _step22, tx, json;

    return _regenerator2.default.wrap(function _callee84$(_context84) {
      while (1) {
        switch (_context84.prev = _context84.next) {
          case 0:
            _context84.next = 2;
            return this.chain.getMedianTime(entry);

          case 2:
            mtp = _context84.sent;
            _context84.next = 5;
            return this.chain.getNextHash(entry.hash);

          case 5:
            next = _context84.sent;
            txs = [];
            _iteratorNormalCompletion22 = true;
            _didIteratorError22 = false;
            _iteratorError22 = undefined;
            _context84.prev = 10;
            _iterator22 = (0, _getIterator3.default)(block.txs);

          case 12:
            if (_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done) {
              _context84.next = 22;
              break;
            }

            tx = _step22.value;

            if (!details) {
              _context84.next = 18;
              break;
            }

            json = this.txToJSON(tx, entry);

            txs.push(json);
            return _context84.abrupt('continue', 19);

          case 18:
            txs.push(tx.txid());

          case 19:
            _iteratorNormalCompletion22 = true;
            _context84.next = 12;
            break;

          case 22:
            _context84.next = 28;
            break;

          case 24:
            _context84.prev = 24;
            _context84.t0 = _context84['catch'](10);
            _didIteratorError22 = true;
            _iteratorError22 = _context84.t0;

          case 28:
            _context84.prev = 28;
            _context84.prev = 29;

            if (!_iteratorNormalCompletion22 && _iterator22.return) {
              _iterator22.return();
            }

          case 31:
            _context84.prev = 31;

            if (!_didIteratorError22) {
              _context84.next = 34;
              break;
            }

            throw _iteratorError22;

          case 34:
            return _context84.finish(31);

          case 35:
            return _context84.finish(28);

          case 36:
            return _context84.abrupt('return', {
              hash: entry.rhash(),
              confirmations: this.chain.height - entry.height + 1,
              strippedsize: block.getBaseSize(),
              size: block.getSize(),
              weight: block.getWeight(),
              height: entry.height,
              version: entry.version,
              versionHex: util.hex32(entry.version),
              merkleroot: util.revHex(entry.merkleRoot),
              coinbase: block.txs[0].inputs[0].script.toJSON(),
              tx: txs,
              time: entry.time,
              mediantime: mtp,
              bits: entry.bits,
              difficulty: toDifficulty(entry.bits),
              chainwork: entry.chainwork.toString('hex', 64),
              previousblockhash: entry.prevBlock !== encoding.NULL_HASH ? util.revHex(entry.prevBlock) : null,
              nextblockhash: next ? util.revHex(next) : null
            });

          case 37:
          case 'end':
            return _context84.stop();
        }
      }
    }, _callee84, this, [[10, 24, 28, 36], [29,, 31, 35]]);
  }));

  function blockToJSON(_x155, _x156, _x157) {
    return _ref86.apply(this, arguments);
  }

  return blockToJSON;
}();

RPC.prototype.entryToJSON = function entryToJSON(entry) {
  return {
    size: entry.size,
    fee: Amount.btc(entry.deltaFee, true),
    modifiedfee: 0,
    time: entry.time,
    height: entry.height,
    startingpriority: entry.priority,
    currentpriority: entry.getPriority(this.chain.height),
    descendantcount: this.mempool.countDescendants(entry),
    descendantsize: entry.descSize,
    descendantfees: entry.descFee,
    ancestorcount: this.mempool.countAncestors(entry),
    ancestorsize: 0,
    ancestorfees: 0,
    depends: this.mempool.getDepends(entry.tx).map(util.revHex)
  };
};

/*
 * Helpers
 */

function swap32(data) {
  for (var i = 0; i < data.length; i += 4) {
    var field = data.readUInt32LE(i, true);
    data.writeUInt32BE(field, i, true);
  }
  return data;
}

function toDeployment(id, version, status) {
  return {
    id: id,
    version: version,
    reject: {
      status: status
    }
  };
}

function parseAddress(raw, network) {
  try {
    return Address.fromString(raw, network);
  } catch (e) {
    throw new RPCError(errs.INVALID_ADDRESS_OR_KEY, 'Invalid address.');
  }
}

function parseSecret(raw, network) {
  try {
    return KeyRing.fromSecret(raw, network);
  } catch (e) {
    throw new RPCError(errs.INVALID_ADDRESS_OR_KEY, 'Invalid key.');
  }
}

function parseIP(addr, network) {
  try {
    return IP.fromHostname(addr, network.port);
  } catch (e) {
    throw new RPCError(errs.CLIENT_INVALID_IP_OR_SUBNET, 'Invalid IP address or subnet.');
  }
}

function parseNetAddress(addr, network) {
  try {
    return NetAddress.fromHostname(addr, network);
  } catch (e) {
    throw new RPCError(errs.CLIENT_INVALID_IP_OR_SUBNET, 'Invalid IP address or subnet.');
  }
}

function toDifficulty(bits) {
  var shift = bits >>> 24 & 0xff;
  var diff = 0x0000ffff / (bits & 0x00ffffff);

  while (shift < 29) {
    diff *= 256.0;
    shift++;
  }

  while (shift > 29) {
    diff /= 256.0;
    shift--;
  }

  return diff;
}

/*
 * Expose
 */

module.exports = RPC;