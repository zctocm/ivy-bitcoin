"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
function isComparisonOperator(str) {
    return ["==", "!=", ">", "<"].indexOf(str) !== -1;
}
exports.isComparisonOperator = isComparisonOperator;
// slightly hackish runtime type guard
function isInstruction(instructionName) {
    const opcodes = getOpcodes(instructionName);
    return opcodes !== undefined;
}
exports.isInstruction = isInstruction;
function getOpcodes(instruction) {
    switch (instruction) {
        case "checkSig":
            return ["CHECKSIG"];
        case "checkDataSig":
            return ["CHECKDATASIG"];
        case "ripemd160":
            return ["RIPEMD160"];
        case "sha1":
            return ["SHA1"];
        case "sha256":
            return ["SHA256"];
        case "older":
            return ["CHECKSEQUENCEVERIFY", "DROP", "1"]; // will get special treatment
        case "after":
            return ["CHECKLOCKTIMEVERIFY", "DROP", "1"]; // will get special treatment
        case "checkMultiSig":
            return ["CHECKMULTISIG"]; // will get special treatment
        case "==":
            return ["EQUAL"];
        case "!=":
            return ["EQUAL", "NOT"];
        case "bytes":
            return [];
        case "size":
            return ["SIZE", "SWAP", "DROP"];
        case ">":
            return ["GREATERTHAN", "DROP", "1"];
        case "<":
            return ["LESSTHAN", "DROP", "1"];
    }
}
exports.getOpcodes = getOpcodes;
function getTypeSignature(instruction) {
    switch (instruction) {
        case "checkSig":
            return types_1.createTypeSignature(["PublicKey", "Signature"], "Boolean");
        case "checkDataSig":
            return types_1.createTypeSignature(["PublicKey", "Bytes", "Signature"], "Boolean");
        case "older":
            return types_1.createTypeSignature(["Duration"], "Boolean");
        case "after":
            return types_1.createTypeSignature(["Time"], "Boolean");
        case "size":
            return types_1.createTypeSignature(["Bytes"], "Integer");
        case "checkMultiSig":
            return types_1.createTypeSignature([
                { type: "listType", elementType: "PublicKey" },
                { type: "listType", elementType: "Signature" }
            ], "Boolean");
        case "==":
        case "!=":
        case ">":
        case "<":
            throw new Error("should not call getTypeSignature on == or !=");
        case "ripemd160":
        case "sha1":
        case "sha256":
            throw new Error("should not call getTypeSignature on hash function");
        case "bytes":
            throw new Error("should not call getTypeSignature on bytes function");
    }
}
exports.getTypeSignature = getTypeSignature;
//# sourceMappingURL=instructions.js.map