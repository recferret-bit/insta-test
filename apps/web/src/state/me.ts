/**
 * `["me"]` query & `PATCH /me` mutation (F-FE-07, frontend/02 "Query Keys": `["me"]`, stale 5 min).
 * The cached value is always a `MeViewModel`; every refresh is mirrored into the session store so the app shell
 * avatar/username stay current.
 */
import { LIMITS } from "@insta/contracts";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { getMe, updateMe } from "../api/users";
import { fullNameError, usernameError } from "./auth";
import { toMeVM, toUpdateProfileDto, type EditProfileForm, type MeViewModel } from "./mappers/user";
import { queryKeys, STALE_TIMES } from "./query-keys";
import { setSessionMe, useIsAuthenticated, useMe } from "./session";

export type { EditProfileForm };
export type EditProfileField = "username" | "fullName" | "bio" | "avatar";

/** `VALIDATION_FAILED.details[].path` → edit-profile field. */
export const EDIT_PROFILE_FIELD_MAP: Partial<Record<string, EditProfileField>> = {
  username: "username",
  full_name: "fullName",
  bio: "bio",
  avatar_media_id: "avatar",
};

export async function fetchMe(signal?: AbortSignal): Promise<MeViewModel> {
  const me = toMeVM(await getMe(signal));
  setSessionMe(me);
  return me;
}

/** `GET /me` while signed in; seeded from the session store so the page renders instantly after reload. */
export function useMeQuery() {
  const authenticated = useIsAuthenticated();
  const cached = useMe();
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: STALE_TIMES.me,
    enabled: authenticated,
    placeholderData: cached ?? undefined,
  });
}

export function editProfileFormFrom(me: MeViewModel): EditProfileForm {
  return { username: me.username, fullName: me.fullName, bio: me.bio, avatarMediaId: undefined };
}

export function countLineBreaks(value: string): number {
  return value.match(/\n/g)?.length ?? 0;
}

export function bioError(bio: string): string | null {
  if (Array.from(bio).length > LIMITS.bioMax) return `Bio is at most ${LIMITS.bioMax} characters.`;
  if (countLineBreaks(bio) > LIMITS.bioMaxNewlines)
    return `At most ${LIMITS.bioMaxNewlines} line breaks are allowed.`;
  return null;
}

export function validateEditProfileForm(form: EditProfileForm): Partial<Record<EditProfileField, string>> {
  const errors: Partial<Record<EditProfileField, string>> = {};
  const username = usernameError(form.username);
  if (username) errors.username = username;
  const fullName = fullNameError(form.fullName);
  if (fullName) errors.fullName = fullName;
  const bio = bioError(form.bio);
  if (bio) errors.bio = bio;
  return errors;
}

/** Writes a fresh `MeViewModel` everywhere it is cached (`["me"]`, session store) and refreshes profile pages. */
export function applyMeUpdate(client: QueryClient, previous: MeViewModel, next: MeViewModel): void {
  client.setQueryData(queryKeys.me(), next);
  setSessionMe(next);
  // Username/avatar/name may have changed: drop cached profile headers for both handles.
  void client.invalidateQueries({ queryKey: queryKeys.profile(previous.username) });
  if (next.username !== previous.username)
    void client.invalidateQueries({ queryKey: queryKeys.profile(next.username) });
}

export type UpdateProfileVariables = { form: EditProfileForm; original: MeViewModel };

/**
 * `PATCH /me` with only the changed fields. Resolves with `null` (no request sent) when nothing changed, because
 * the API rejects an empty body.
 */
export function useUpdateProfileMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ form, original }: UpdateProfileVariables): Promise<MeViewModel | null> => {
      const body = toUpdateProfileDto(form, original);
      if (!body) return null;
      return toMeVM(await updateMe(body));
    },
    onSuccess: (next, { original }) => {
      if (next) applyMeUpdate(client, original, next);
    },
  });
}
