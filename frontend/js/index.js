import React from "react";
import * as ReactDOM from "react-dom";
import App from "./containers/App";

/** Initialize the main application page */
window.initApp = () => {
  ReactDOM.render(
    <App />,
    document.getElementById("root"));
};
