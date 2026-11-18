import {
  AuthTokenResponseDto,
  LoginRequestDto,
  MeResponseDto,
  SignupRequestDto,
  UpdateProfileRequestDto,
  UserProfileResponseDto,
  UsernameParamsDto,
} from "@insta/contracts";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { RouteDeps } from "../app-services.js";
import { requireAuth } from "../auth.plugin.js";
import {
  mapLoginDtoToCommand,
  mapSessionToAuthTokenDto,
  mapSignupDtoToCommand,
  mapUpdateProfileDtoToCommand,
  mapUserProfileViewToResponseDto,
  mapUserToMeResponseDto,
} from "../mappers/identity.dto-mapper.js";
import { RATE_LIMIT_PRESETS } from "../rate-limit.js";
import { API_V1 } from "./index.js";

function userAgentOf(request: FastifyRequest): string {
  return request.headers["user-agent"] ?? "";
}

/**
 * `identity` route module (`F-ECOMM-02`, `F-ECOMM-03`; external-communication/02-auth-and-users-api.md):
 * POST /auth/signup, POST /auth/login, POST /auth/logout, GET|PATCH /me, GET /users/{username}.
 */
export const identityRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, { services, urls }) => {
  const identity = services.identity;

  app.post(
    `${API_V1}/auth/signup`,
    {
      schema: { body: SignupRequestDto, response: { 201: AuthTokenResponseDto } },
      config: { auth: "none", rateLimit: RATE_LIMIT_PRESETS.auth },
    },
    async (request, reply) => {
      const { user, issued } = await identity.register(
        mapSignupDtoToCommand(request.body, userAgentOf(request)),
      );
      const me = await identity.getMe(user.id);
      return reply.code(201).send(mapSessionToAuthTokenDto(issued, me, urls));
    },
  );

  app.post(
    `${API_V1}/auth/login`,
    {
      schema: { body: LoginRequestDto, response: { 200: AuthTokenResponseDto } },
      config: { auth: "none", rateLimit: RATE_LIMIT_PRESETS.auth },
    },
    async (request, reply) => {
      const { user, issued } = await identity.login(mapLoginDtoToCommand(request.body, userAgentOf(request)));
      const me = await identity.getMe(user.id);
      return reply.code(200).send(mapSessionToAuthTokenDto(issued, me, urls));
    },
  );

  app.post(`${API_V1}/auth/logout`, { config: { auth: "required" } }, async (request, reply) => {
    await identity.logout(requireAuth(request).sessionId);
    return reply.code(204).send();
  });

  app.get(
    `${API_V1}/me`,
    { schema: { response: { 200: MeResponseDto } }, config: { auth: "required" } },
    async (request, reply) => {
      const me = await identity.getMe(requireAuth(request).userId);
      return reply.code(200).send(mapUserToMeResponseDto(me, urls));
    },
  );

  app.patch(
    `${API_V1}/me`,
    {
      schema: { body: UpdateProfileRequestDto, response: { 200: MeResponseDto } },
      config: { auth: "required" },
    },
    async (request, reply) => {
      const cmd = mapUpdateProfileDtoToCommand(request.body, requireAuth(request).userId);
      const me = await identity.updateProfile(cmd);
      return reply.code(200).send(mapUserToMeResponseDto(me, urls));
    },
  );

  app.get(
    `${API_V1}/users/:username`,
    {
      schema: { params: UsernameParamsDto, response: { 200: UserProfileResponseDto } },
      config: { auth: "optional" },
    },
    async (request, reply) => {
      const view = await identity.getProfile(request.params.username, request.auth?.userId ?? null);
      return reply.code(200).send(mapUserProfileViewToResponseDto(view, urls));
    },
  );
};
