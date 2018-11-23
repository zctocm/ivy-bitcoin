"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bcoin_1 = require("bcoin");
const errors_1 = require("./errors");
const crypto = require("bcrypto");
const MTX = bcoin_1.primitives.MTX;
function createFundingTransaction(address, valueArgs, seed) {
    if (valueArgs.some(isNaN)) {
        return undefined;
    }
    const mtx = new MTX();
    console.log('valuesArgs: ' + JSON.stringify(valueArgs));
    valueArgs.forEach(amount => {
        mtx.addInput({
            prevout: new bcoin_1.outpoint(),
            script: new bcoin_1.script(),
            sequence: 0xffffffff
        });
    });
    const totalAmount = valueArgs.reduce((a, b) => a + b, 0);
    mtx.addOutput({
        address,
        value: totalAmount
    });
    // add dummy output for uniqueness
    const randomScript = bcoin_1.script.fromNulldata(seed);
    mtx.addOutput({
        script: randomScript,
        value: 0
    });
    const tx = mtx.toTX();
    console.warn('tx json createFundingTransaction: ' + JSON.stringify(tx.toJSON()));
    return tx.toJSON();
}
function argToPushData(arg) {
    if (typeof arg === "number") {
        return bcoin_1.opcode.fromInt(arg);
    }
    else if (typeof arg === "string") {
        return bcoin_1.opcode.fromData(Buffer.from(arg, "hex"));
    }
    else {
        return bcoin_1.opcode.fromData(arg);
    }
}
exports.argToPushData = argToPushData;
function symbolToOpcode(sym, argMap) {
    if (sym[sym.length - 1] === ")") {
        // it's a contract argument
        const name = sym.slice(5, sym.length - 1);
        const arg = argMap.get(name);
        if (arg === undefined) {
            throw new errors_1.BugError("argument '" + name + "' unexpectedly has no data");
        }
        return argToPushData(arg);
    }
    else if (/^\d+$/.test(sym)) {
        return bcoin_1.opcode.fromInt(parseInt(sym, 10));
    }
    return bcoin_1.opcode.fromSymbol(sym);
}
exports.symbolToOpcode = symbolToOpcode;
function instantiate(template, args, seed = crypto.randomBytes(32)) {
    const numArgs = template.params.length;
    if (numArgs !== args.length) {
        throw new Error("expected " + numArgs + " arguments, got " + args.length);
    }
    const dataArgs = args.filter((_, i) => template.params[i].valueType !== "Value");
    const valueArgs = args.filter((_, i) => template.params[i].valueType === "Value");
    const instructions = template.instructions;
    const argMap = new Map();
    template.params.map((param, i) => {
        if (param.valueType !== "Value") {
            argMap.set(param.name, args[i]);
        }
    });
    // console.log('argMap: '+JSON.stringify(argMap))
    const opcodes = instructions.map(inst => symbolToOpcode(inst, argMap));
    // console.log('opcodes: '+JSON.stringify(opcodes))
    const script = bcoin_1.script.fromArray(opcodes);
    // console.log('script: '+JSON.stringify(script))
    const testnetAddress = bcoin_1.address.fromScripthash(script.hash160(), "testnet");
    const mainnetAddress = bcoin_1.address.fromScripthash(script.hash160());
    const tx = createFundingTransaction(testnetAddress, valueArgs, seed);
    // if (tx === undefined) {
    //   throw new Error(
    //     "expected tx to not be undefined when called in instantiate"
    //   )
    // }
    const instantiated = {
        script: script.toJSON(),
        testnetAddress: testnetAddress.toBase58(),
        mainnetAddress: mainnetAddress.toBase58(),
        publicKey: script.isPubkey()
            ? args[0].toString("hex")
            : undefined,
        fundingTransaction: tx,
        amount: valueArgs.reduce((a, b) => a + b, 0),
        template
    };
    return instantiated;
}
exports.instantiate = instantiate;
//# sourceMappingURL=instantiate.js.map