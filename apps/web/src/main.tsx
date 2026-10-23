import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./context/AuthContext.js";
import { WebSocketProvider } from "./context/WebSocketContext.js";
import { AppShell } from "./components/AppShell.js";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AuthProvider>
        <WebSocketProvider>
          <AppShell />
        </WebSocketProvider>
      </AuthProvider>
    </React.StrictMode>,
  );
}