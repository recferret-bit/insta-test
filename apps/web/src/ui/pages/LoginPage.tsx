import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
  EMPTY_LOGIN_FORM,
  hasErrors,
  LOGIN_FIELD_MAP,
  useLoginMutation,
  validateLoginForm,
  type LoginField,
  type LoginForm,
} from "../../state/auth";
import { mapApiErrorToFormErrors } from "../../state/errors";
import { AuthForm } from "../components/AuthForm";
import { Input } from "../components/Input";
import { safeNextPath } from "../layout/next-path";
import { useDocumentTitle } from "../layout/useDocumentTitle";

/** Keeps `?next=` when switching between `/login` and `/signup`. */
export function withNext(path: string, next: string | null): string {
  const safe = safeNextPath(next, "");
  return safe && safe !== "/" ? `${path}?next=${encodeURIComponent(safe)}` : path;
}

/** `/login` (public-only) — F-FE-02: `POST /auth/login`, then return to the safe `?next=` path. */
export function LoginPage() {
  useDocumentTitle("Log in");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const mutation = useLoginMutation();
  const [form, setForm] = useState<LoginForm>(EMPTY_LOGIN_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function update(field: LoginField, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  }

  function submit() {
    const errors = validateLoginForm(form);
    setFieldErrors(errors);
    setFormError(null);
    if (hasErrors(errors)) return;
    mutation.mutate(form, {
      onSuccess: () => navigate(safeNextPath(next), { replace: true }),
      onError: (error) => {
        const mapped = mapApiErrorToFormErrors(error, LOGIN_FIELD_MAP);
        setFieldErrors(mapped.fieldErrors);
        setFormError(mapped.formError);
        // Never keep a rejected password in the field.
        setForm((f) => ({ ...f, password: "" }));
      },
    });
  }

  return (
    <main id="main-content" className="auth-page">
      <AuthForm
        title="Log in"
        subtitle="Sign in with your username or email."
        submitLabel="Log in"
        submitting={mutation.isPending}
        formError={formError}
        onSubmit={submit}
        footer={
          <span>
            Don&apos;t have an account? <Link to={withNext("/signup", next)}>Sign up</Link>
          </span>
        }
      >
        <Input
          label="Username or email"
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={form.login}
          onChange={(e) => update("login", e.target.value)}
          error={fieldErrors.login}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          error={fieldErrors.password}
          required
        />
      </AuthForm>
    </main>
  );
}
