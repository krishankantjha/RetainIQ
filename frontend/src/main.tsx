import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import favicon from "./assets/logo-icon.png";
import { initTheme } from "./lib/theme";
import "./styles.css";

initTheme();

const faviconLink = document.querySelector<HTMLLinkElement>("link[rel='icon']");
if (faviconLink) {
  faviconLink.href = favicon;
} else {
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = favicon;
  document.head.appendChild(link);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
