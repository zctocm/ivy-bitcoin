"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ast_1 = require("./ast");
const errors_1 = require("./errors");
function referenceCheck(contract) {
    // annotate parameters and variables with their scope and reference count within that clause
    // there are two mappings over ASTs—one that finds the clauses, and one that maps over those clauses
    // also throw an error on undefined or unused variables
    const types = new Map();
    const contractCounts = new Map();
    for (const parameter of contract.parameters) {
        if (contractCounts.has(parameter.name)) {
            throw new errors_1.NameError("parameter " + parameter.name + " is already defined");
        }
        contractCounts.set(parameter.name, 0);
        types.set(parameter.name, parameter.itemType);
    }
    const result = ast_1.mapOverAST((node) => {
        switch (node.type) {
            case "clause": {
                const clauseName = node.name;
                const clauseParameters = node.parameters.map(param => {
                    return Object.assign({}, param, { scope: clauseName });
                });
                const counts = new Map();
                for (const parameter of contract.parameters) {
                    counts.set(parameter.name, 0);
                }
                for (const parameter of clauseParameters) {
                    if (contractCounts.has(parameter.name)) {
                        throw new errors_1.NameError("parameter " + parameter.name + " is already defined");
                    }
                    counts.set(parameter.name, 0);
                    types.set(clauseName + "." + parameter.name, parameter.itemType);
                }
                const mappedClause = ast_1.mapOverAST((astNode) => {
                    switch (astNode.type) {
                        case "variable": {
                            const currentContractCount = contractCounts.get(astNode.name);
                            const currentCount = counts.get(astNode.name);
                            if (currentCount === undefined) {
                                throw new errors_1.NameError("unknown variable: " + astNode.name);
                            }
                            counts.set(astNode.name, currentCount + 1);
                            if (currentContractCount !== undefined) {
                                contractCounts.set(astNode.name, currentContractCount + 1);
                                return Object.assign({}, astNode, { itemType: types.get(astNode.name) });
                            }
                            else {
                                return Object.assign({}, astNode, { scope: clauseName, itemType: types.get(clauseName + "." + astNode.name) });
                            }
                        }
                        default:
                            return astNode;
                    }
                }, node);
                for (const parameter of clauseParameters) {
                    if (counts.get(parameter.name) === 0) {
                        throw new errors_1.NameError("unused variable in clause " + clauseName + ": " + parameter.name);
                    }
                }
                for (const parameter of contract.parameters) {
                    if (parameter.itemType === "Value") {
                        const count = counts.get(parameter.name);
                        if (count === undefined) {
                            throw new Error("count unexpectedly undefined");
                        }
                        if (count === 0) {
                            throw new errors_1.NameError("Value " +
                                parameter.name +
                                " must be disposed of in clause " +
                                clauseName);
                        }
                        else if (count > 1) {
                            throw new errors_1.NameError("Value " +
                                parameter.name +
                                " cannot be used twice in clause " +
                                clauseName);
                        }
                    }
                }
                return Object.assign({}, mappedClause, { referenceCounts: counts, parameters: clauseParameters });
            }
            default:
                return node;
        }
    }, contract);
    for (const parameter of contract.parameters) {
        if (contractCounts.get(parameter.name) === 0) {
            throw new errors_1.NameError("unused parameter: " + parameter.name);
        }
    }
    return Object.assign({}, result, { referenceCounts: contractCounts });
}
exports.referenceCheck = referenceCheck;
//# sourceMappingURL=references.js.map