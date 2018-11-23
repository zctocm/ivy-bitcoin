"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ast_1 = require("./ast");
const errors_1 = require("./errors");
function setupClauses(oldClauses, clauseSelector) {
    const newClauses = [...oldClauses];
    const clause = newClauses.pop();
    if (clause === undefined) {
        throw new errors_1.BugError("undefined clause");
    }
    if (newClauses.length === 0) {
        // last clause, or only one clause
        return clause;
    }
    let condition;
    if (newClauses.length === 1) {
        condition = {
            type: "variable",
            location: clause.location,
            name: clauseSelector
        };
    }
    else {
        const args = [
            {
                type: "literal",
                literalType: "Integer",
                location: clause.location,
                value: newClauses.length.toString()
            },
            {
                type: "variable",
                location: clause.location,
                name: clauseSelector
            }
        ];
        condition = {
            type: "instructionExpression",
            expressionType: "binaryExpression",
            location: clause.location,
            instruction: "==",
            args
        };
    }
    return {
        type: "conditional",
        location: clause.location,
        condition,
        ifBlock: clause,
        elseBlock: setupClauses(newClauses, clauseSelector)
    };
}
function desugarClauses(rawContract) {
    const clauses = rawContract.clauses;
    const numClauses = clauses.length;
    const clauseSelector = clauses.map(clause => clause.name).join("/");
    const block = setupClauses(clauses, clauseSelector);
    if (rawContract.referenceCounts === undefined) {
        throw new errors_1.BugError("raw contract reference counts unexpectedly undefined");
    }
    return {
        type: "contract",
        location: rawContract.location,
        name: rawContract.name,
        parameters: rawContract.parameters,
        block,
        numClauses,
        clauseSelector: clauseSelector === "/" ? undefined : clauseSelector,
        referenceCounts: rawContract.referenceCounts
    };
}
exports.desugarClauses = desugarClauses;
function desugarContract(rawContract) {
    const contract = desugarClauses(rawContract);
    return ast_1.mapOverAST((node) => {
        switch (node.type) {
            case "instructionExpression": {
                if (node.instruction === "checkMultiSig") {
                    // deconstruct the lists
                    // and add the dummy 0 value
                    const pubKeys = node.args[0];
                    const sigs = node.args[1];
                    const args = [
                        {
                            type: "literal",
                            location: pubKeys.location,
                            literalType: "Integer",
                            value: pubKeys.values.length.toString()
                        },
                        ...pubKeys.values,
                        {
                            type: "literal",
                            location: sigs.location,
                            literalType: "Integer",
                            value: sigs.values.length.toString()
                        },
                        ...sigs.values,
                        {
                            type: "literal",
                            location: node.location,
                            literalType: "Integer",
                            value: "0"
                        }
                    ]; // dummy 0 value
                    return Object.assign({}, node, { args });
                }
                else {
                    return node;
                }
            }
            default:
                return node;
        }
    }, contract);
}
exports.desugarContract = desugarContract;
//# sourceMappingURL=desugar.js.map