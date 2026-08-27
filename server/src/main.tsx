import * as React from "react";
import { createRoot } from "react-dom/client";

// The generated stylesheet. Without it every component renders with class names
// that have no rules behind them — which looks like a broken design system
// rather than a missing build step.
import "styled-system/styles.css";

import { App } from "./App.js";

const container = document.getElementById("root");
if (container === null) throw new Error("#root is missing from index.html");

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
