import { CircleDashed } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/stories/:username` (auth optional, full-screen overlay outside the shell) — F-FE-09; implemented by w04. */
export function StoryViewerPage() {
  const { username = "" } = useParams();
  useDocumentTitle(`Stories • @${username}`);
  return (
    <main id="main-content" className="story-viewer-page">
      <PagePlaceholder
        title={`@${username}'s story`}
        icon={CircleDashed}
        message="Stories will play here."
        action={<Link to="/">Close</Link>}
      />
    </main>
  );
}
