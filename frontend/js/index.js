import React from "react";
import * as ReactDOM from "react-dom";
import App from "./containers/App";

import "../node_modules/atrium/atrium.scss";

/** Initialize the main application page */
window.initApp = () => {
  ReactDOM.render(
    <App />,
    document.getElementById("root"));
};
