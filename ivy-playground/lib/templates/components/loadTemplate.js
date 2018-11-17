// external imports
import React from "react";
import { connect } from "react-redux";
// internal imports
import { loadTemplate, updateChosenTemplate } from "../actions";
import { getTemplateIds } from "../selectors";
const mapStateToProps = (state) => {
    return {
        idList: getTemplateIds(state)
    };
};
const mapDispatchToProps = dispatch => ({
    handleClick: (e, id) => {
        e.preventDefault();
        dispatch(loadTemplate(id));
        dispatch(updateChosenTemplate(id));
    }
});
const LoadTemplate = ({ idList, selected, handleClick, chooseTem }) => {
    const options = idList.map(id => {
        // todo 判断key 隐藏output 2
        return (React.createElement("li", { key: id },
            React.createElement("a", { onClick: e => handleClick(e, id), href: "#" }, id)));
    });
    return (React.createElement("div", { className: "dropdown" },
        React.createElement("button", { className: "btn btn-primary dropdown-toggle", type: "button", id: "dropdownMenu1", "data-toggle": "dropdown", "aria-haspopup": "true", "aria-expanded": "true" },
            React.createElement("span", { className: "glyphicon glyphicon-open" }),
            "Load Template"),
        React.createElement("ul", { className: "dropdown-menu", "aria-labelledby": "dropdownMenu1" }, options)));
};
export default connect(mapStateToProps, mapDispatchToProps)(LoadTemplate);
