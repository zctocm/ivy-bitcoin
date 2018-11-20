// external imports
import React from "react";
import { connect } from "react-redux";
import ReactTooltip from "react-tooltip";
// ivy imports
import { create, create2 } from "../../contracts/actions";
// internal imports
import { Col, Grid, Row } from "react-bootstrap";
import { getCreateability, getCreateability2 } from "../selectors";
const LockButton = (props) => {
    const { isTwo } = props;
    console.log('createability2', props.createability2);
    const button = (React.createElement("button", { className: "btn btn-primary btn-lg form-button", disabled: !props.createability.createable || !props.createability2.createable, onClick: isTwo ? props.create2 : props.create }, "Create"));
    if (props.createability.createable && props.createability2.createable) {
        return (React.createElement(Grid, null,
            React.createElement(Row, null,
                React.createElement(Col, null, button))));
    }
    else {
        return (React.createElement(Grid, null,
            React.createElement(Row, null,
                React.createElement(Col, null,
                    React.createElement("div", { "data-for": "lockButtonTooltip", "data-tip": props.createability.error || props.createability2.error, style: { width: 119, height: 45 } }, button),
                    React.createElement(ReactTooltip, { id: "lockButtonTooltip", place: "right", type: "error", effect: "solid" }, props.createability.error || props.createability2.error)))));
    }
};
export default connect(state => ({
    createability: getCreateability(state),
    createability2: getCreateability2(state),
}), { create, create2 })(LockButton);
