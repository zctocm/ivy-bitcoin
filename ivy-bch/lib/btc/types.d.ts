export declare type Type = Primitive | Hash | List;
export declare type Primitive = "PublicKey" | "Signature" | "Bytes" | "Time" | "Duration" | "Value" | "Boolean" | "Integer";
export declare type HashFunction = "sha1" | "sha256" | "ripemd160";
export interface Hash {
    type: "hashType";
    hashFunction: HashFunction;
    inputType: Type;
}
export interface List {
    type: "listType";
    elementType: Type;
}
export declare type TypeClass = "Primitive" | "Hash" | "List" | "BooleanType";
export interface TypeSignature {
    type: "typeSignature";
    inputs: Type[];
    output: Type;
}
export declare function createTypeSignature(inputs: Type[], output: Type): TypeSignature;
export declare function inputTypesToString(inputTypes: Type[]): string;
export declare function isPrimitive(str: Type | string): str is Primitive;
export declare function isHashTypeName(str: any): boolean;
export declare function isHash(type: Type): type is Hash;
export declare function isList(type: Type): type is List;
export declare function isTypeClass(type: Type | TypeClass): type is TypeClass;
export declare function getTypeClass(type: Type): TypeClass;
export declare function isHashFunctionName(str: string): str is HashFunction;
export declare function hashFunctionToTypeName(hash: HashFunction): string;
export declare function typeNameToHashFunction(hash: string): HashFunction;
export declare function typeToString(type: Type): string;
