import { Location } from "./ast";
export declare class ExtendableError extends Error {
    message: string;
    name: string;
    location?: Location | undefined;
    constructor(message: string, name: string, location?: Location | undefined);
}
export declare class NameError extends ExtendableError {
    constructor(message: string, location?: Location);
}
export declare class BugError extends ExtendableError {
    constructor(message: string);
}
export declare class IvyTypeError extends ExtendableError {
    constructor(message: string, location?: Location);
}
export declare class ValueError extends ExtendableError {
    constructor(message: string, location?: Location);
}
