import { optimize } from "./btc/optimize"
import { toContractParameter } from "./btc/parameters"
import toOpcodes from "./btc/toOpcodes"
import { desugarContract } from "./desugar"
import { NameError } from "./errors"
import { compileContractToIntermediate } from "./intermediate"
import { referenceCheck } from "./references"
import { compileStackOps } from "./stack"
import { CompilerError, Template, toTemplateClause } from "./template"
import { typeCheckContract } from "./typeCheck"

import { RawContract } from "./ast"

const parser = require("../lib/parser")

export function compile(source: string): Template | CompilerError {
  try {
    console.warn('source:'+source)
    const rawAst = parser.parse(source) as RawContract
    console.warn('rawAst:'+JSON.stringify(rawAst))
    const referenceChecked = referenceCheck(rawAst)
    console.warn('referenceChecked:'+JSON.stringify(referenceChecked))
    const ast = typeCheckContract(referenceChecked)
    console.warn('ast:'+JSON.stringify(ast))
    const templateClauses = ast.clauses.map(toTemplateClause)
    console.warn('templateClauses:'+JSON.stringify(templateClauses))
    const desugarContent=desugarContract(ast)
    console.warn('desugar: '+JSON.stringify(desugarContent))
    const contractData=compileContractToIntermediate(desugarContent)
    console.warn('contractToIntermediate: '+JSON.stringify(contractData))
    const operations = compileStackOps(contractData)
    console.warn('operations:'+JSON.stringify(operations))
    const instructions = optimize(toOpcodes(operations))
    console.warn('instructions:'+JSON.stringify(instructions))
    const params = ast.parameters.map(toContractParameter)
    console.warn('params:'+JSON.stringify(params))
    return {
      type: "template",
      name: ast.name,
      instructions,
      clauses: templateClauses,
      clauseNames: templateClauses.map(clause => clause.name),
      params,
      source
    }
  } catch (e) {
    // catch and return CompilerError
    let errorMessage: string
    if (e.location !== undefined) {
      const start = e.location.start
      const name = e.name === "IvyTypeError" ? "TypeError" : e.name
      errorMessage =
        name +
        " at line " +
        start.line +
        ", column " +
        start.column +
        ": " +
        e.message
    } else {
      errorMessage = e.toString()
    }
    return {
      type: "compilerError",
      source,
      message: errorMessage
    }
  }
}
