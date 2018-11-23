"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const optimize_1 = require("./btc/optimize");
const parameters_1 = require("./btc/parameters");
const toOpcodes_1 = require("./btc/toOpcodes");
const desugar_1 = require("./desugar");
const intermediate_1 = require("./intermediate");
const references_1 = require("./references");
const stack_1 = require("./stack");
const template_1 = require("./template");
const typeCheck_1 = require("./typeCheck");
const parser = require("../lib/parser");
function compile(source) {
    try {
        // console.warn('source:'+source)
        const rawAst = parser.parse(source);
        // console.warn('rawAst:'+JSON.stringify(rawAst))
        const referenceChecked = references_1.referenceCheck(rawAst);
        // console.warn('referenceChecked:'+JSON.stringify(referenceChecked))
        const ast = typeCheck_1.typeCheckContract(referenceChecked);
        // console.warn('ast:'+JSON.stringify(ast))
        const templateClauses = ast.clauses.map(template_1.toTemplateClause);
        // console.warn('templateClauses:'+JSON.stringify(templateClauses))
        const desugarContent = desugar_1.desugarContract(ast);
        // console.warn('desugar: '+JSON.stringify(desugarContent))
        const contractData = intermediate_1.compileContractToIntermediate(desugarContent);
        // console.warn('contractToIntermediate: '+JSON.stringify(contractData))
        const operations = stack_1.compileStackOps(contractData);
        // console.warn('operations:'+JSON.stringify(operations))
        const instructions = optimize_1.optimize(toOpcodes_1.default(operations));
        // console.warn('instructions:'+JSON.stringify(instructions))
        const params = ast.parameters.map(parameters_1.toContractParameter);
        // console.warn('params:'+JSON.stringify(params))
        return {
            type: "template",
            name: ast.name,
            instructions,
            clauses: templateClauses,
            clauseNames: templateClauses.map(clause => clause.name),
            params,
            source
        };
    }
    catch (e) {
        // catch and return CompilerError
        let errorMessage;
        if (e.location !== undefined) {
            const start = e.location.start;
            const name = e.name === "IvyTypeError" ? "TypeError" : e.name;
            errorMessage =
                name +
                    " at line " +
                    start.line +
                    ", column " +
                    start.column +
                    ": " +
                    e.message;
        }
        else {
            errorMessage = e.toString();
        }
        return {
            type: "compilerError",
            source,
            message: errorMessage
        };
    }
}
exports.compile = compile;
//# sourceMappingURL=compile.js.map