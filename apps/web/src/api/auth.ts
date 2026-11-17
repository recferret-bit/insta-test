/** Auth endpoints — external-communication/02-auth-and-users-api.md. */
import { AuthTokenResponseDto, type LoginRequestDto, type SignupRequestDto } from "@insta/contracts";

import { request, type InputOf } from "./http";

export type SignupBody = InputOf<typeof SignupRequestDto>;
export type LoginBody = InputOf<typeof LoginRequestDto>;

/** `POST /auth/signup` → `201 AuthTokenResponseDto`. */
export function signup(body: SignupBody, signal?: AbortSignal): Promise<AuthTokenResponseDto> {
  return request("POST", "/auth/signup", { body, schema: AuthTokenResponseDto, signal });
}

/** `POST /auth/login` (`login` = username or email) → `200 AuthTokenResponseDto`. */
export function login(body: LoginBody, signal?: AbortSignal): Promise<AuthTokenResponseDto> {
  return request("POST", "/auth/login", { body, schema: AuthTokenResponseDto, signal });
}

/** `POST /auth/logout` → `204` (revokes the current session). */
export function logout(signal?: AbortSignal): Promise<void> {
  return request<void>("POST", "/auth/logout", { signal });
}
