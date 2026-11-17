import { Hash } from "lucide-react";
import { useParams } from "react-router-dom";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/tags/:tag` (auth optional) — F-FE-08; implemented by w05 (`GET /hashtags/{tag}/posts`). */
export function HashtagPage() {
  const { tag = "" } = useParams();
  useDocumentTitle(`#${tag}`);
  return <PagePlaceholder title={`#${tag}`} icon={Hash} width="wide" message="Posts with this hashtag." />;
}
