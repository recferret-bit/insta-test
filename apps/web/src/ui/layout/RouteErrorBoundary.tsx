import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertTriangle, Compass } from "lucide-react";
import { isRouteErrorResponse, Link, useLocation, useNavigate, useRouteError } from "react-router-dom";

import { errorMessage, isNotFound } from "../../state/errors";
import { EmptyState, ErrorState } from "../components/EmptyState";

/**
 * Per-route error element (frontend/01 "error boundary per route with Retry"). Retry resets failed queries and
 * re-navigates to the same location, which resets React Router's render error boundary.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  const navigate = useNavigate();
  const { reset } = useQueryErrorResetBoundary();

  if ((isRouteErrorResponse(error) && error.status === 404) || isNotFound(error)) {
    return (
      <section className="page page--narrow">
        <EmptyState
          icon={Compass}
          title="Page not found"
          headingLevel="h1"
          message="The link may be broken or the content may have been removed."
          action={<Link to="/">Go home</Link>}
        />
      </section>
    );
  }

  const message = isRouteErrorResponse(error)
    ? error.statusText || `Error ${error.status}`
    : errorMessage(error);
  return (
    <section className="page page--narrow">
      <ErrorState
        icon={AlertTriangle}
        message={message}
        onRetry={() => {
          reset();
          navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true });
        }}
      />
    </section>
  );
}
