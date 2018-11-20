import { push } from "react-router-redux";
import templates from "../templates";
import { DEMO_CONTRACTS, DEMO_ID_LIST } from "ivy-bitcoin";
import { updateChosenTemplate, loadTemplate } from "../templates/actions";
export const RESET = "app/RESET";
export const reset = () => {
    return (dispatch, getState) => {
        let selected = templates.selectors.getSelectedTemplate(getState());
        if (selected === "" || DEMO_CONTRACTS[selected] === undefined) {
            selected = DEMO_ID_LIST[0];
        }
        dispatch(push("/"));
        dispatch({ type: RESET });
        dispatch(loadTemplate(selected));
        dispatch(updateChosenTemplate(selected));
    };
};
