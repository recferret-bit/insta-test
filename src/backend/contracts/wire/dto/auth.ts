import { z } from "zod";
import { IsoDateTime } from "../ids.ts";
import { LIMITS } from "../limits.ts";
import { EmailInput, UsernameInput } from "./common.ts";
import { MeResponseDto } from "./users.ts";

export const SignupRequestDto = z
  .object({
    username: UsernameInput,
    email: EmailInput,
    password: z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax),
    full_name: z.string().trim().max(LIMITS.fullNameMax).default(""),
  })
  .strict();
export type SignupRequestDto = z.infer<typeof SignupRequestDto>;

export const LoginRequestDto = z
  .object({
    /** Username or email; matched lowercased by the service. */
    login: z.string().trim().min(1).max(LIMITS.loginMax),
    password: z.string().min(1).max(LIMITS.passwordMax),
  })
  .strict();
export type LoginRequestDto = z.infer<typeof LoginRequestDto>;

export const AuthTokenResponseDto = z.object({
  access_token: z.string().length(LIMITS.accessTokenLength),
  token_type: z.literal("Bearer"),
  expires_at: IsoDateTime,
  user: MeResponseDto,
});
export type AuthTokenResponseDto = z.infer<typeof AuthTokenResponseDto>;

/** `POST /events/ticket` response (P-2: DTO lives here, endpoint is implemented by the SSE wave). */
export const SseTicketResponseDto = z.object({
  ticket: z.string().min(1),
  expires_at: IsoDateTime,
});
export type SseTicketResponseDto = z.infer<typeof SseTicketResponseDto>;

/** `GET /events/stream?ticket=…` */
export const SseStreamQuery = z.object({ ticket: z.string().min(1).max(256) }).strict();
export type SseStreamQuery = z.infer<typeof SseStreamQuery>;
