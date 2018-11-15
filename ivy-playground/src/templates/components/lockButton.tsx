// external imports
import React from "react"
import { connect } from "react-redux"
import ReactTooltip from "react-tooltip"

// ivy imports
import { create,  create2} from "../../contracts/actions"

// internal imports
import { Col, Grid, Row } from "react-bootstrap"
import { getCreateability } from "../selectors"

const LockButton = (props: {
  createability: { createable: boolean; error: string }
  create: (e) => undefined,
  isTwo?: boolean
}) => {
  const { isTwo } = props
  const button = (
    <button
      className="btn btn-primary btn-lg form-button"
      disabled={!props.createability.createable}
      onClick={ isTwo ? props.create2 : props.create }
    >
      Create
    </button>
  )
  if (props.createability.createable) {
    return (
      <Grid>
        <Row>
          <Col>{button}</Col>
        </Row>
      </Grid>
    )
  } else {
    return (
      <Grid>
        <Row>
          <Col>
            <div
              data-for="lockButtonTooltip"
              data-tip={props.createability.error}
              style={{ width: 119, height: 45 }}
            >
              {button}
            </div>
            <ReactTooltip
              id="lockButtonTooltip"
              place="right"
              type="error"
              effect="solid"
            >
              {props.createability.error}
            </ReactTooltip>
          </Col>
        </Row>
      </Grid>
    )
  }
}

export default connect(state => ({ createability: getCreateability(state) }), {
    create, create2
})(LockButton)
