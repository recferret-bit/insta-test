import type {
  AuthTokenResponseDto,
  LoginRequestDto,
  MeResponseDto,
  SignupRequestDto,
  UpdateProfileRequestDto,
  UserProfileResponseDto,
  UserSummaryDto,
} from "@insta/contracts";

import type {
  LoginCommand,
  RegisterUserCommand,
  UpdateProfileCommand,
} from "../../domain/identity/commands.js";
import type { IssuedSession } from "../../domain/identity/session.entity.js";
import type { UserProfileView, UserSummaryView } from "../../domain/identity/views.js";
import { DomainError } from "../../domain/shared/errors.js";
import type { MediaId, UserId } from "../../domain/shared/ids.js";
import type { UrlBuilder } from "../url-builder.js";
import { parsePublicId, toPublicId } from "./shared.dto-mapper.js";

/**
 * Identity DTO ↔ Business mappers (external-communication/02-auth-and-users-api.md#mapping-dto--business).
 * Request DTOs arrive already validated by their Zod schema; the domain re-validates invariants.
 */

/** `SignupRequestDto` → `RegisterUserCommand`. */
export function mapSignupDtoToCommand(dto: SignupRequestDto, userAgent: string): RegisterUserCommand {
  return {
    username: dto.username,
    email: dto.email,
    password: dto.password,
    fullName: dto.full_name,
    userAgent,
  };
}

/** `LoginRequestDto` → `LoginCommand`. */
export function mapLoginDtoToCommand(dto: LoginRequestDto, userAgent: string): LoginCommand {
  return { login: dto.login, password: dto.password, userAgent };
}

/** `UpdateProfileRequestDto` → `UpdateProfileCommand`; `avatar_media_id` public ID parsed, `null` kept (remove). */
export function mapUpdateProfileDtoToCommand(
  dto: UpdateProfileRequestDto,
  userId: UserId,
): UpdateProfileCommand {
  const cmd: UpdateProfileCommand = { userId };
  if (dto.username !== undefined) cmd.username = dto.username;
  if (dto.full_name !== undefined) cmd.fullName = dto.full_name;
  if (dto.bio !== undefined) cmd.bio = dto.bio;
  if (dto.avatar_media_id !== undefined) {
    cmd.avatarMediaId =
      dto.avatar_media_id === null
        ? null
        : parsePublicId<MediaId>("med", dto.avatar_media_id, "avatar_media_id");
  }
  return cmd;
}

function avatarUrl(storageKey: string | null, urls: UrlBuilder): string | null {
  return storageKey === null ? null : urls.mediaUrl(storageKey);
}

/** `UserSummaryView` → `UserSummaryDto` (embedded user card). */
export function mapUserToSummaryDto(view: UserSummaryView, urls: UrlBuilder): UserSummaryDto {
  return {
    id: toPublicId("usr", view.id),
    username: view.username,
    full_name: view.fullName,
    avatar_url: avatarUrl(view.avatarStorageKey, urls),
    is_following: view.viewerIsFollowing,
  };
}

/** `UserProfileView` → `UserProfileResponseDto` (never includes `email`). */
export function mapUserProfileViewToResponseDto(
  view: UserProfileView,
  urls: UrlBuilder,
): UserProfileResponseDto {
  return {
    ...mapUserToSummaryDto(view, urls),
    bio: view.bio,
    posts_count: view.stats.posts,
    followers_count: view.stats.followers,
    following_count: view.stats.following,
    has_active_story: view.hasActiveStory,
    created_at: view.createdAt.toISOString(),
  };
}

/** Own `UserProfileView` (with `email`) → `MeResponseDto`. */
export function mapUserToMeResponseDto(view: UserProfileView, urls: UrlBuilder): MeResponseDto {
  if (view.email === undefined) {
    throw new DomainError("INTERNAL", "Own profile view is missing the email");
  }
  return { ...mapUserProfileViewToResponseDto(view, urls), email: view.email };
}

/** `IssuedSession` + own profile → `AuthTokenResponseDto` (the only place the raw token leaves, `INV-09`). */
export function mapSessionToAuthTokenDto(
  issued: IssuedSession,
  me: UserProfileView,
  urls: UrlBuilder,
): AuthTokenResponseDto {
  return {
    access_token: issued.rawToken,
    token_type: "Bearer",
    expires_at: issued.session.expiresAt.toISOString(),
    user: mapUserToMeResponseDto(me, urls),
  };
}
