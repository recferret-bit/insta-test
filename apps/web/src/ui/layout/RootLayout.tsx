import { Outlet, ScrollRestoration } from "react-router-dom";

import { ToastRegion } from "../components/Toast";

/** Top-level route element: page outlet + global toast region (also shown on auth and story-viewer pages). */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <ToastRegion />
      <ScrollRestoration />
    </>
  );
}
