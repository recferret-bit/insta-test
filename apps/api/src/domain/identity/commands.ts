import type { MediaId, UserId } from "../shared/ids.js";

export type RegisterUserCommand = {
  username: string;
  email: string;
  password: string;
  fullName: string;
  userAgent: string;
};

export type LoginCommand = { login: string; password: string; userAgent: string };

/** `avatarMediaId: null` removes the avatar; `undefined` leaves it unchanged. */
export type UpdateProfileCommand = {
  userId: UserId;
  username?: string;
  fullName?: string;
  bio?: string;
  avatarMediaId?: MediaId | null;
};
