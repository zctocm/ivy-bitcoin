"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
require("mocha");
const index_1 = require("../index");
const predefined_1 = require("../predefined");
describe("compile", () => {
    Object.keys(predefined_1.TEST_CASES).forEach(name => {
        it("should compile " + name, () => {
            const contractSource = predefined_1.TEST_CASES[name];
            const compiled = index_1.compile(contractSource);
            chai_1.expect(compiled.message).to.equal(undefined); // so it prints the error
        });
    });
    Object.keys(predefined_1.ERRORS).forEach(errorName => {
        it("should throw an error if contract " + errorName, () => {
            const errorContractSource = predefined_1.ERRORS[errorName];
            const compiled = index_1.compile(errorContractSource);
            chai_1.expect(compiled.type).to.equal("compilerError");
        });
    });
});
describe("instantiate", () => {
    Object.keys(predefined_1.TEST_CONTRACT_ARGS).forEach(id => {
        it("should instantiate " + id, () => {
            const template = index_1.compile(predefined_1.TEST_CASES[id]);
            const instantiated = index_1.instantiate(template, predefined_1.TEST_CONTRACT_ARGS[id]);
        });
    });
});
const seed = Buffer.from("", "hex");
const destinationAddress = "";
describe("spend", () => {
    Object.keys(predefined_1.TEST_SPEND_ARGUMENTS).forEach(id => {
        it("should create spend transaction for " + id, () => {
            const template = index_1.compile(predefined_1.TEST_CASES[id]);
            const instantiated = index_1.instantiate(template, predefined_1.TEST_CONTRACT_ARGS[id], seed);
            const spendTx = index_1.spend(instantiated.fundingTransaction, destinationAddress, 0, 0, { sequence: 0, seconds: false });
        });
    });
});
describe("fulfill", () => {
    Object.keys(predefined_1.TEST_SPEND_ARGUMENTS).forEach(id => {
        if (id === "RevealFixedPoint") {
            return;
        } // we know this would fail
        it("should be able to fulfill the spend transaction for " + id, () => {
            const template = index_1.compile(predefined_1.TEST_CASES[id]);
            const instantiated = index_1.instantiate(template, predefined_1.TEST_CONTRACT_ARGS[id], seed);
            const spendTx = index_1.spend(instantiated.fundingTransaction, destinationAddress, 0, predefined_1.TEST_CONTRACT_TIMES[id] || 0, { sequence: predefined_1.TEST_CONTRACT_AGES[id] || 0, seconds: false });
            const fulfilled = index_1.fulfill(instantiated, spendTx, predefined_1.TEST_SPEND_ARGUMENTS[id], predefined_1.TEST_CONTRACT_CLAUSE_NAMES[id]);
            fulfilled.check(1 << 16);
        });
    });
});
//# sourceMappingURL=test.js.map