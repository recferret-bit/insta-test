import {
  LikeStateResponseDto,
  PageQuery,
  PostIdParamsDto,
  UserSummaryPageResponseDto,
} from "@insta/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { PostId } from "../../domain/shared/ids.js";
import type { RouteDeps } from "../app-services.js";
import { requireAuth } from "../auth.plugin.js";
import { mapLikerPageToResponseDto, mapLikeStateToResponseDto } from "../mappers/likes.dto-mapper.js";
import { mapPageQueryToRequest, parsePublicId } from "../mappers/shared.dto-mapper.js";
import { API_V1 } from "./index.js";

const postIdOf = (params: PostIdParamsDto): PostId => parsePublicId<PostId>("pst", params.post_id, "post_id");

/**
 * `likes` route module (`F-ECOMM-06`; external-communication/04-social-api.md#likes):
 * PUT|DELETE /posts/{post_id}/like (idempotent), GET /posts/{post_id}/likes.
 * Mutations use the global 120/min-per-user limit; reads the 600/min-per-IP limit.
 */
export const likesRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, { services, urls }) => {
  const likes = services.likes;

  app.put(
    `${API_V1}/posts/:post_id/like`,
    {
      schema: { params: PostIdParamsDto, response: { 200: LikeStateResponseDto } },
      config: { auth: "required" },
    },
    async (request, reply) => {
      const state = await likes.like(postIdOf(request.params), requireAuth(request).userId);
      return reply.code(200).send(mapLikeStateToResponseDto(state));
    },
  );

  app.delete(
    `${API_V1}/posts/:post_id/like`,
    {
      schema: { params: PostIdParamsDto, response: { 200: LikeStateResponseDto } },
      config: { auth: "required" },
    },
    async (request, reply) => {
      const state = await likes.unlike(postIdOf(request.params), requireAuth(request).userId);
      return reply.code(200).send(mapLikeStateToResponseDto(state));
    },
  );

  app.get(
    `${API_V1}/posts/:post_id/likes`,
    {
      schema: {
        params: PostIdParamsDto,
        querystring: PageQuery,
        response: { 200: UserSummaryPageResponseDto },
      },
      config: { auth: "optional" },
    },
    async (request, reply) => {
      const page = await likes.listLikers(
        postIdOf(request.params),
        request.auth?.userId ?? null,
        mapPageQueryToRequest(request.query),
      );
      return reply.code(200).send(mapLikerPageToResponseDto(page, urls));
    },
  );
};
