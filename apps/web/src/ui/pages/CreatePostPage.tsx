import { PlusSquare } from "lucide-react";
import { Link } from "react-router-dom";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/create` (auth required) — F-FE-04; implemented by w02 (`POST /media` purpose post, `POST /posts`). */
export function CreatePostPage() {
  useDocumentTitle("Create new post");
  return (
    <PagePlaceholder
      title="Create new post"
      icon={PlusSquare}
      message="Share up to 10 photos or short videos."
      action={<Link to="/create/story">Add to your story instead</Link>}
    />
  );
}
