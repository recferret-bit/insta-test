import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `*` — unknown routes. */
export function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <PagePlaceholder
      title="Page not found"
      icon={Compass}
      message="The link may be broken or the page may have been removed."
      action={<Link to="/">Go home</Link>}
    />
  );
}
