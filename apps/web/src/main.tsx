/**
 * Composition root of the SPA: runtime config → API client wiring → session boot → render.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { configureHttp } from "./api/http";
import { App, createAppRouter } from "./App";
import { getAppConfig } from "./config";
import { queryClient } from "./state/queryClient";
import { bootstrapSession, clearSession, getSessionToken } from "./state/session";
import { applyThemePreference, getThemePreference } from "./state/theme";
import { loginPathFor } from "./ui/layout/next-path";
import "./styles/tokens.css";
import "./styles/global.css";

const PUBLIC_ONLY_PATHS = new Set(["/login", "/signup"]);

function renderFatal(root: HTMLElement, message: string): void {
  root.innerHTML = "";
  const box = document.createElement("main");
  box.setAttribute("role", "alert");
  box.className = "page page--narrow";
  const title = document.createElement("h1");
  title.textContent = "Insta-test could not start";
  const text = document.createElement("p");
  text.textContent = message;
  box.append(title, text);
  root.append(box);
}

function start(): void {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("#root element missing from index.html");
  applyThemePreference(getThemePreference());

  let apiUrl: string;
  try {
    apiUrl = getAppConfig().apiUrl;
  } catch (error) {
    renderFatal(rootElement, error instanceof Error ? error.message : String(error));
    return;
  }

  const router = createAppRouter();
  configureHttp({
    baseUrl: apiUrl,
    getToken: getSessionToken,
    // frontend/01 "Errors": 401 from any call → clear session, redirect to /login.
    onUnauthenticated: () => {
      clearSession();
      queryClient.clear();
      const { pathname, search } = router.state.location;
      if (!PUBLIC_ONLY_PATHS.has(pathname))
        void router.navigate(loginPathFor(`${pathname}${search}`), { replace: true });
    },
  });
  void bootstrapSession();

  createRoot(rootElement).render(
    <StrictMode>
      <App router={router} queryClient={queryClient} />
    </StrictMode>,
  );
}

start();
