import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useIsAuthenticated } from "../../state/session";
import { loginPathFor } from "./next-path";

/** Route guard (F-FE-01): unauthenticated users are redirected to `/login?next=<path>`. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const authenticated = useIsAuthenticated();
  const location = useLocation();
  if (!authenticated) {
    return <Navigate to={loginPathFor(`${location.pathname}${location.search}`)} replace />;
  }
  return children ?? <Outlet />;
}
