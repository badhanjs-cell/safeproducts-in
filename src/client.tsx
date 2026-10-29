import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", color: "#E2E8F0", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#F87171" }}>
            SafeProducts Startup Notice
          </h1>
          <pre style={{ marginTop: "1rem", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function mount() {
  const rootElement = document.getElementById("root") || document.body;
  const router = getRouter();
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
