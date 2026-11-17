import { useEffect } from "react";

export const APP_NAME = "Insta-test";

/** Sets `document.title` to `"<title> • Insta-test"` (or just the app name). */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} • ${APP_NAME}` : APP_NAME;
  }, [title]);
}
