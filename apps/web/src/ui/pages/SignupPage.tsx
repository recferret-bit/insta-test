import { UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

import { PagePlaceholder } from "../components/PagePlaceholder";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** `/signup` (public-only) — F-FE-02; implemented by w01 (`POST /auth/signup`). */
export function SignupPage() {
  useDocumentTitle("Sign up");
  return (
    <main id="main-content" className="auth-page">
      <PagePlaceholder
        title="Create your account"
        icon={UserPlus}
        message="Sign up to share photos and videos with your friends."
        action={
          <span>
            Have an account? <Link to="/login">Log in</Link>
          </span>
        }
      />
    </main>
  );
}
