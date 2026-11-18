import { LogIn } from "lucide-react";
import { Link } from "react-router-dom";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/login` (public-only) — F-FE-02; implemented by w01 (`POST /auth/login`). */
export function LoginPage() {
  useDocumentTitle("Log in");
  return (
    <main id="main-content" className="auth-page">
      <PagePlaceholder
        title="Log in"
        icon={LogIn}
        message="Sign in with your username or email."
        action={
          <span>
            Don&apos;t have an account? <Link to="/signup">Sign up</Link>
          </span>
        }
      />
    </main>
  );
}
