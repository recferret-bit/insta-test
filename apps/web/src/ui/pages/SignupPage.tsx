import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
  EMPTY_SIGNUP_FORM,
  FORM_LIMITS as LIMITS,
  hasErrors,
  SIGNUP_FIELD_MAP,
  useSignupMutation,
  validateSignupForm,
  type SignupField,
  type SignupForm,
} from "../../state/auth";
import { mapApiErrorToFormErrors } from "../../state/errors";
import { AuthForm } from "../components/AuthForm";
import { Input } from "../components/Input";
import { safeNextPath } from "../layout/next-path";
import { useDocumentTitle } from "../layout/useDocumentTitle";
import { withNext } from "./LoginPage";

/**
 * `/signup` (public-only) — F-FE-02: `POST /auth/signup` (auto-login). Field errors come from client checks or
 * the server (`VALIDATION_FAILED.details`, `409 USERNAME_TAKEN` / `EMAIL_TAKEN`).
 */
export function SignupPage() {
  useDocumentTitle("Sign up");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const mutation = useSignupMutation();
  const [form, setForm] = useState<SignupForm>(EMPTY_SIGNUP_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignupField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function update(field: SignupField, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  }

  function submit() {
    const errors = validateSignupForm(form);
    setFieldErrors(errors);
    setFormError(null);
    if (hasErrors(errors)) return;
    mutation.mutate(form, {
      onSuccess: () => navigate(safeNextPath(next), { replace: true }),
      onError: (error) => {
        const mapped = mapApiErrorToFormErrors(error, SIGNUP_FIELD_MAP);
        setFieldErrors(mapped.fieldErrors);
        setFormError(mapped.formError);
      },
    });
  }

  return (
    <main id="main-content" className="auth-page">
      <AuthForm
        title="Create your account"
        subtitle="Sign up to share photos and videos with your friends."
        submitLabel="Sign up"
        submitting={mutation.isPending}
        formError={formError}
        onSubmit={submit}
        footer={
          <span>
            Have an account? <Link to={withNext("/login", next)}>Log in</Link>
          </span>
        }
      >
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          error={fieldErrors.email}
          maxLength={LIMITS.emailMax}
          required
        />
        <Input
          label="Full name"
          name="full_name"
          autoComplete="name"
          value={form.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          error={fieldErrors.fullName}
          hint="Optional"
          maxLength={LIMITS.fullNameMax}
        />
        <Input
          label="Username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={form.username}
          onChange={(e) => update("username", e.target.value)}
          error={fieldErrors.username}
          hint="Letters, digits, '.' and '_'"
          maxLength={LIMITS.usernameMax}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          error={fieldErrors.password}
          hint={`At least ${LIMITS.passwordMin} characters`}
          maxLength={LIMITS.passwordMax}
          required
        />
      </AuthForm>
    </main>
  );
}
