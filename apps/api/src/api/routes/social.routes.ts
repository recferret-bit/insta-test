import {
  FollowStateResponseDto,
  PageQuery,
  UserSummaryPageResponseDto,
  UsernameParamsDto,
} from "@insta/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { RouteDeps } from "../app-services.js";
import { requireAuth } from "../auth.plugin.js";
import { mapPageQueryToRequest, mapPageToResponseDto } from "../mappers/shared.dto-mapper.js";
import {
  mapFollowStateToResponseDto,
  mapUserSummaryViewToFollowListItemDto,
} from "../mappers/social.dto-mapper.js";
import { API_V1 } from "./index.js";

/**
 * `social` route module (`F-ECOMM-07`; external-communication/04-social-api.md#follows):
 * PUT|DELETE /users/{username}/follow, GET /users/{username}/followers, GET /users/{username}/following.
 * Mutations use the global per-user write limit (120/min).
 */
export const socialRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, { services, urls }) => {
  const follows = services.follows;

  app.put(
    `${API_V1}/users/:username/follow`,
    {
      schema: { params: UsernameParamsDto, response: { 200: FollowStateResponseDto } },
      config: { auth: "required" },
    },
    async (request, reply) => {
      const state = await follows.follow(requireAuth(request).userId, request.params.username);
      return reply.code(200).send(mapFollowStateToResponseDto(state));
    },
  );

  app.delete(
    `${API_V1}/users/:username/follow`,
    {
      schema: { params: UsernameParamsDto, response: { 200: FollowStateResponseDto } },
      config: { auth: "required" },
    },
    async (request, reply) => {
      const state = await follows.unfollow(requireAuth(request).userId, request.params.username);
      return reply.code(200).send(mapFollowStateToResponseDto(state));
    },
  );

  app.get(
    `${API_V1}/users/:username/followers`,
    {
      schema: {
        params: UsernameParamsDto,
        querystring: PageQuery,
        response: { 200: UserSummaryPageResponseDto },
      },
      config: { auth: "optional" },
    },
    async (request, reply) => {
      const page = await follows.listFollowers(
        request.params.username,
        request.auth?.userId ?? null,
        mapPageQueryToRequest(request.query),
      );
      return reply
        .code(200)
        .send(mapPageToResponseDto(page, (v) => mapUserSummaryViewToFollowListItemDto(v, urls)));
    },
  );

  app.get(
    `${API_V1}/users/:username/following`,
    {
      schema: {
        params: UsernameParamsDto,
        querystring: PageQuery,
        response: { 200: UserSummaryPageResponseDto },
      },
      config: { auth: "optional" },
    },
    async (request, reply) => {
      const page = await follows.listFollowing(
        request.params.username,
        request.auth?.userId ?? null,
        mapPageQueryToRequest(request.query),
      );
      return reply
        .code(200)
        .send(mapPageToResponseDto(page, (v) => mapUserSummaryViewToFollowListItemDto(v, urls)));
    },
  );
};
