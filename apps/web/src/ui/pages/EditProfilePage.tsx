import { Settings } from "lucide-react";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/settings/profile` (auth required) — F-FE-07; implemented by w01 (`GET /me`, `POST /media` avatar, `PATCH /me`). */
export function EditProfilePage() {
  useDocumentTitle("Edit profile");
  return (
    <PagePlaceholder
      title="Edit profile"
      icon={Settings}
      message="Change your photo, username, name and bio."
    />
  );
}
