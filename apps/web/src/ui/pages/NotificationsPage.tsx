import { Heart } from "lucide-react";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/notifications` (auth required) — F-FE-10; implemented by w06 (`GET /notifications`, `POST /notifications/read`). */
export function NotificationsPage() {
  useDocumentTitle("Notifications");
  return (
    <PagePlaceholder
      title="Notifications"
      icon={Heart}
      message="Likes, comments and new followers will appear here."
    />
  );
}
