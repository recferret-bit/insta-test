import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

import { BrandLogo } from "../layout/BrandMark";
import { APP_NAME } from "../layout/useDocumentTitle";
import { Button } from "./Button";
import "./AuthForm.css";

export type AuthFormProps = {
  title: string;
  subtitle?: ReactNode;
  submitLabel: string;
  submitting?: boolean;
  /** Error not tied to a field (e.g. `INVALID_CREDENTIALS`, network failure). */
  formError?: string | null;
  onSubmit: () => void;
  /** Footer below the card (e.g. "Don't have an account? Sign up"). */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Card layout shared by the log-in and sign-up pages (F-FE-02). Native validation is disabled (`noValidate`) so
 * client checks and server `VALIDATION_FAILED.details` render the same way, inline under each field.
 */
export function AuthForm({
  title,
  subtitle,
  submitLabel,
  submitting = false,
  formError,
  onSubmit,
  footer,
  children,
}: AuthFormProps) {
  const titleId = `auth-title-${useId()}`;
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitting) onSubmit();
  }

  return (
    <div className="auth-form">
      <section className="auth-form__card" aria-labelledby={titleId}>
        <div className="auth-form__brand">
          <BrandLogo size={40} />
          <span className="auth-form__app-name">{APP_NAME}</span>
        </div>
        <h1 id={titleId} className="auth-form__title">
          {title}
        </h1>
        {subtitle ? <p className="auth-form__subtitle">{subtitle}</p> : null}
        <form
          className="auth-form__form"
          noValidate
          onSubmit={handleSubmit}
          aria-busy={submitting || undefined}
        >
          {formError ? (
            <p ref={errorRef} className="auth-form__error" role="alert" tabIndex={-1}>
              {formError}
            </p>
          ) : null}
          {children}
          <Button type="submit" block loading={submitting}>
            {submitLabel}
          </Button>
        </form>
      </section>
      {footer ? <div className="auth-form__footer">{footer}</div> : null}
    </div>
  );
}
