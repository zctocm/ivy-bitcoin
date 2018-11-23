import { Type, TypeSignature } from "./btc/types";
import { Clause, Expression, RawContract, Statement } from "./ast";
import { Template } from "./template";
export declare type TypeMap = Map<string, Type>;
export interface ImportMap {
    [s: string]: Template;
}
export declare function matchTypes(firstType: Type, secondType: Type): void;
export declare function unifyFunction(typeSignature: TypeSignature, inputTypes: Type[]): Type;
export declare function typeCheckExpression(expression: Expression): Type;
export declare function typeCheckStatement(statement: Statement): void;
export declare function typeCheckClause(clause: Clause): void;
export declare function typeCheckContract(rawContract: RawContract): RawContract;
