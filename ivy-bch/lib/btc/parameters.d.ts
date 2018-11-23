import { Hash, HashFunction, Type } from "./types";
import { Parameter } from "../ast";
export interface ContractParameterHash {
    type: "hashType";
    inputType: "Bytes" | "PublicKey" | ContractParameterHash;
    hashFunction: HashFunction;
}
export declare type ContractParameterType = "PublicKey" | "Bytes" | "Time" | "Duration" | "Signature" | "Value" | "Boolean" | "Integer" | ContractParameterHash;
export interface ContractParameter {
    type: "contractParameter";
    valueType: ContractParameterType;
    name: string;
}
export interface ClauseParameter {
    type: "clauseParameter";
    valueType: ContractParameterType;
    name: string;
}
export declare function isContractParameterHash(type: Hash): type is ContractParameterHash;
export declare function isContractParameterType(type: Type): type is ContractParameterType;
export declare function toContractParameter(parameter: Parameter): ContractParameter;
export declare function isClauseParameterHash(type: Hash): type is ContractParameterHash;
export declare function isClauseParameterType(type: Type): type is ContractParameterHash;
export declare function toClauseParameter(parameter: Parameter): ClauseParameter;
