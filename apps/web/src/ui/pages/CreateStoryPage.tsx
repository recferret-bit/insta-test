import { CirclePlus } from "lucide-react";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/create/story` (auth required) — F-FE-09; implemented by w04 (`POST /media` purpose story, `POST /stories`). */
export function CreateStoryPage() {
  useDocumentTitle("Add to story");
  return (
    <PagePlaceholder
      title="Add to your story"
      icon={CirclePlus}
      message="Stories disappear after 24 hours."
    />
  );
}
