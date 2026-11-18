import { Image } from "lucide-react";
import { useParams } from "react-router-dom";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/p/:postId` (auth optional) — F-FE-05; implemented by w02 (`GET /posts/{id}`, comments, likes). */
export function PostPage() {
  const { postId = "" } = useParams();
  useDocumentTitle("Post");
  return <PagePlaceholder title="Post" icon={Image} message={`Post ${postId} will appear here.`} />;
}
