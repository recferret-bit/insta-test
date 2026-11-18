import { Search } from "lucide-react";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/search` (auth optional) — F-FE-08; implemented by w05 (`GET /search/users`, `GET /search/hashtags`). */
export function SearchPage() {
  useDocumentTitle("Search");
  return <PagePlaceholder title="Search" icon={Search} message="Find people and hashtags." />;
}
