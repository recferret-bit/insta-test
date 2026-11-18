import { Home } from "lucide-react";
import { Link } from "react-router-dom";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/` (auth required) — F-FE-03; story tray + feed implemented by w05/w04 (`GET /stories/tray`, `GET /feed`). */
export function HomePage() {
  useDocumentTitle(null);
  return (
    <PagePlaceholder
      title="Home"
      icon={Home}
      message="Posts from people you follow will appear here."
      action={<Link to="/explore">Explore posts</Link>}
    />
  );
}
