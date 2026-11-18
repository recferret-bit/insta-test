import { Compass } from "lucide-react";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/explore` (auth optional) — F-FE-08; implemented by w05 (`GET /explore`). */
export function ExplorePage() {
  useDocumentTitle("Explore");
  return <PagePlaceholder title="Explore" icon={Compass} width="wide" message="Discover recent posts." />;
}
