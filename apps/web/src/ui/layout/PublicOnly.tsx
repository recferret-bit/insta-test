import type { ReactNode } from "react";
import { Navigate, Outlet, useSearchParams } from "react-router-dom";

import { useIsAuthenticated } from "../../state/session";
import { safeNextPath } from "./next-path";

/**
 * Route guard for `/login` and `/signup`: signed-in users are sent to `/` — or to a safe same-origin `?next=` path,
 * so a successful login lands where the `RequireAuth` redirect started.
 */
export function PublicOnly({ children }: { children?: ReactNode }) {
  const authenticated = useIsAuthenticated();
  const [params] = useSearchParams();
  if (authenticated) return <Navigate to={safeNextPath(params.get("next"))} replace />;
  return children ?? <Outlet />;
}
