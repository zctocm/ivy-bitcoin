"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parameters_1 = require("./btc/parameters");
function toTemplateClause(clause) {
    const clauseParameters = clause.parameters.map(parameters_1.toClauseParameter);
    return {
        type: "templateClause",
        name: clause.name,
        parameters: clauseParameters
    };
}
exports.toTemplateClause = toTemplateClause;
//# sourceMappingURL=template.js.map