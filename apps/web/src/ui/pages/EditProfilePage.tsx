import { LogOut } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { FORM_LIMITS as LIMITS, hasErrors, useLogoutMutation } from "../../state/auth";
import { errorMessage, mapApiErrorToFormErrors } from "../../state/errors";
import { initialsAvatarUrl } from "../../state/mappers/format";
import { toUpdateProfileDto, type MeViewModel } from "../../state/mappers/user";
import {
  countLineBreaks,
  EDIT_PROFILE_FIELD_MAP,
  editProfileFormFrom,
  useMeQuery,
  useUpdateProfileMutation,
  validateEditProfileForm,
  type EditProfileField,
  type EditProfileForm,
} from "../../state/me";
import { showToast } from "../../state/toast";
import type { UploadFn } from "../../state/upload";
import { AvatarUploader } from "../components/AvatarUploader";
import { Button } from "../components/Button";
import { ErrorState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { Input } from "../components/Input";
import { Spinner } from "../components/Spinner";
import { TextArea } from "../components/TextArea";
import { useDocumentTitle } from "../layout/useDocumentTitle";
import "./EditProfilePage.css";

/** Changes whenever the saved profile changes, so the form restarts from the server values. */
function formVersion(me: MeViewModel): string {
  return JSON.stringify([me.id, me.username, me.fullName, me.bio, me.avatarUrl]);
}

type AvatarPreview = { src: string; hasAvatar: boolean };

type EditProfileFormViewProps = {
  me: MeViewModel;
  upload?: UploadFn;
};

function EditProfileFormView({ me, upload }: EditProfileFormViewProps) {
  const mutation = useUpdateProfileMutation();
  const [form, setForm] = useState<EditProfileForm>(() => editProfileFormFrom(me));
  const [avatar, setAvatar] = useState<AvatarPreview>({ src: me.avatarUrl, hasAvatar: me.hasCustomAvatar });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditProfileField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const onBusyChange = useCallback((busy: boolean) => setUploading(busy), []);

  const dirty = toUpdateProfileDto(form, me) !== null;
  const lineBreaks = countLineBreaks(form.bio);

  function update(field: "username" | "fullName" | "bio", value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending || uploading) return;
    const errors = validateEditProfileForm(form);
    setFieldErrors(errors);
    setFormError(null);
    if (hasErrors(errors) || !dirty) return;
    mutation.mutate(
      { form, original: me },
      {
        onSuccess: (next) => {
          if (next) showToast("Profile saved", { tone: "success" });
        },
        onError: (error) => {
          const mapped = mapApiErrorToFormErrors(error, EDIT_PROFILE_FIELD_MAP);
          setFieldErrors(mapped.fieldErrors);
          setFormError(mapped.formError);
        },
      },
    );
  }

  return (
    <form
      className="edit-profile__form"
      noValidate
      onSubmit={submit}
      aria-busy={mutation.isPending || undefined}
    >
      <AvatarUploader
        src={avatar.src}
        hasAvatar={avatar.hasAvatar}
        username={me.username}
        upload={upload}
        disabled={mutation.isPending}
        error={fieldErrors.avatar}
        onBusyChange={onBusyChange}
        onUploaded={(media) => {
          setAvatar({ src: media.url, hasAvatar: true });
          setForm((f) => ({ ...f, avatarMediaId: media.id }));
          setFieldErrors((e) => ({ ...e, avatar: undefined }));
        }}
        onRemove={() => {
          setAvatar({ src: initialsAvatarUrl(me.username, me.fullName), hasAvatar: false });
          setForm((f) => ({ ...f, avatarMediaId: null }));
          setFieldErrors((e) => ({ ...e, avatar: undefined }));
        }}
      />
      {formError ? (
        <p className="edit-profile__error" role="alert">
          {formError}
        </p>
      ) : null}
      <Input
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={form.username}
        onChange={(e) => update("username", e.target.value)}
        error={fieldErrors.username}
        maxLength={LIMITS.usernameMax}
        showCounter
      />
      <Input
        label="Full name"
        name="full_name"
        autoComplete="name"
        value={form.fullName}
        onChange={(e) => update("fullName", e.target.value)}
        error={fieldErrors.fullName}
        maxLength={LIMITS.fullNameMax}
        showCounter
      />
      <TextArea
        label="Bio"
        name="bio"
        rows={4}
        value={form.bio}
        onChange={(e) => update("bio", e.target.value)}
        error={fieldErrors.bio}
        hint={`${lineBreaks}/${LIMITS.bioMaxNewlines} line breaks`}
        maxLength={LIMITS.bioMax}
        showCounter
      />
      <div className="edit-profile__actions">
        <Button type="submit" loading={mutation.isPending} disabled={!dirty || uploading}>
          Save
        </Button>
      </div>
    </form>
  );
}

export type EditProfilePageProps = {
  /** Injectable media upload (tests); production uses the XHR client. */
  upload?: UploadFn;
};

/** `/settings/profile` (auth required) — F-FE-07: `GET /me`, `POST /media` (purpose avatar), `PATCH /me`. */
export function EditProfilePage({ upload }: EditProfilePageProps = {}) {
  useDocumentTitle("Edit profile");
  const navigate = useNavigate();
  const query = useMeQuery();
  // Hook-level callback: the page unmounts (RequireAuth) as soon as the session is cleared.
  const logout = useLogoutMutation({ onLoggedOut: () => navigate("/login", { replace: true }) });
  const me = query.data;

  function onLogout() {
    logout.mutate();
  }

  return (
    <section className="page page--narrow edit-profile" aria-labelledby="edit-profile-title">
      <h1 id="edit-profile-title" className="edit-profile__title">
        Edit profile
      </h1>
      {me ? (
        <EditProfileFormView key={formVersion(me)} me={me} upload={upload} />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <Spinner label="Loading profile" />
      )}
      <div className="edit-profile__logout">
        <Button
          variant="ghost"
          onClick={onLogout}
          loading={logout.isPending}
          leadingIcon={<Icon icon={LogOut} size={18} />}
        >
          Log out
        </Button>
      </div>
    </section>
  );
}
