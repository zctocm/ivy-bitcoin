// internal imports
import { compile, DEMO_ID_LIST } from "ivy-bitcoin";
import { getSourceMap } from "./selectors";
export const SHOW_LOCK_INPUT_ERRORS = "templates/SHOW_LOCK_INPUT_ERRORS";
export const showLockInputErrors = (result) => {
    return {
        type: SHOW_LOCK_INPUT_ERRORS,
        result
    };
};
export const loadTemplate = (selected) => {
    return (dispatch, getState) => {
        if (!selected) {
            selected = DEMO_ID_LIST[0];
        }
        const state = getState();
        const source = getSourceMap(state)[selected];
        // todo fake source
        const source2 = getSourceMap(state).TransferWithTimeout;
        dispatch(setSource(source));
        dispatch(setSourceTwo(source2));
    };
};
export const UPDATE_ERROR = "templates/UPDATE_ERROR";
export const updateError = (error) => {
    return {
        type: UPDATE_ERROR,
        error
    };
};
export const SET_SOURCE = "templates/SET_SOURCE";
export const setSource = (source) => {
    return (dispatch, getState) => {
        const type = SET_SOURCE;
        dispatch({ type, source });
        const compiled = compile(source);
        if (compiled.type === "compilerError") {
            dispatch(updateError(compiled.message));
        }
        else {
            dispatch(updateCompiled(compiled));
        }
    };
};
export const SET_SOURCE_TWO = "templates/SET_SOURCE_TWO";
export const setSourceTwo = (source2) => {
    return (dispatch, getState) => {
        const type = SET_SOURCE_TWO;
        const compiled = compile(source2);
        dispatch({ type, source2 });
        if (compiled.type === "compilerError") {
            dispatch(updateError(compiled.message));
        }
        else {
            dispatch(updateCompiledTwo(compiled));
        }
    };
};
export const SAVE_TEMPLATE = "templates/SAVE_TEMPLATE";
export const saveTemplate = () => ({ type: SAVE_TEMPLATE });
export const UPDATE_COMPILED = "templates/UPDATE_COMPILED";
export const updateCompiled = (compiled) => {
    return {
        type: UPDATE_COMPILED,
        compiled
    };
};
export const UPDATE_COMPILED_TWO = "templates/UPDATE_COMPILED_TWO";
export const updateCompiledTwo = (compiled) => {
    return {
        type: UPDATE_COMPILED_TWO,
        compiled
    };
};
export const UPDATE_CHOSEN_TEMPLATE = "contracts/UPDATE_CHOSEN_TEMPLATE";
export const updateChosenTemplate = (tem) => {
    return (dispatch) => {
        dispatch({
            type: UPDATE_CHOSEN_TEMPLATE,
            tem
        });
    };
};
