import { z } from "zod";

import { LIMITS } from "../limits.js";
import { EmailField, FullNameField, IsoDateTime, UsernameField } from "./common.js";
import { MeResponseDto } from "./users.js";

/** `POST /auth/signup`. */
export const SignupRequestDto = z
  .object({
    username: UsernameField,
    email: EmailField,
    password: z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax),
    full_name: FullNameField.default(""),
  })
  .strict();
export type SignupRequestDto = z.infer<typeof SignupRequestDto>;

/** `POST /auth/login` — `login` is a username or an email. */
export const LoginRequestDto = z
  .object({
    login: z.string().trim().min(1).max(LIMITS.loginMax),
    password: z.string().min(1).max(LIMITS.loginPasswordMax),
  })
  .strict();
export type LoginRequestDto = z.infer<typeof LoginRequestDto>;

export const AuthTokenResponseDto = z.object({
  /** Opaque base64url token (43 chars). */
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_at: IsoDateTime,
  user: MeResponseDto,
});
export type AuthTokenResponseDto = z.infer<typeof AuthTokenResponseDto>;

/** `POST /events/ticket` — one-time SSE ticket (`DEC-08`). */
export const SseTicketResponseDto = z.object({
  ticket: z.string(),
  expires_at: IsoDateTime,
});
export type SseTicketResponseDto = z.infer<typeof SseTicketResponseDto>;
