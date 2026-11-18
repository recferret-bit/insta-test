import {
  CommentIdParamsDto,
  CommentPageResponseDto,
  CommentResponseDto,
  CreateCommentRequestDto,
  PageQuery,
  PostIdParamsDto,
} from "@insta/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { CommentId, PostId } from "../../domain/shared/ids.js";
import type { RouteDeps } from "../app-services.js";
import { requireAuth } from "../auth.plugin.js";
import {
  mapCommentPageToResponseDto,
  mapCommentViewToResponseDto,
  mapCreateCommentDtoToCommand,
} from "../mappers/comments.dto-mapper.js";
import { mapPageQueryToRequest, parsePublicId } from "../mappers/shared.dto-mapper.js";
import { API_V1 } from "./index.js";

const postIdOf = (params: PostIdParamsDto): PostId => parsePublicId<PostId>("pst", params.post_id, "post_id");

/**
 * `comments` route module (`F-ECOMM-06`; external-communication/04-social-api.md#comments):
 * GET|POST /posts/{post_id}/comments, DELETE /comments/{comment_id}.
 * Mutations use the global 120/min-per-user limit; reads the 600/min-per-IP limit.
 */
export const commentsRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, { services, urls }) => {
  const comments = services.comments;

  app.get(
    `${API_V1}/posts/:post_id/comments`,
    {
      schema: { params: PostIdParamsDto, querystring: PageQuery, response: { 200: CommentPageResponseDto } },
      config: { auth: "optional" },
    },
    async (request, reply) => {
      const page = await comments.listComments(
        postIdOf(request.params),
        mapPageQueryToRequest(request.query),
      );
      return reply.code(200).send(mapCommentPageToResponseDto(page, urls));
    },
  );

  app.post(
    `${API_V1}/posts/:post_id/comments`,
    {
      schema: {
        params: PostIdParamsDto,
        body: CreateCommentRequestDto,
        response: { 201: CommentResponseDto },
      },
      config: { auth: "required" },
    },
    async (request, reply) => {
      const cmd = mapCreateCommentDtoToCommand(
        request.body,
        postIdOf(request.params),
        requireAuth(request).userId,
      );
      const view = await comments.addComment(cmd);
      return reply.code(201).send(mapCommentViewToResponseDto(view, urls));
    },
  );

  app.delete(
    `${API_V1}/comments/:comment_id`,
    { schema: { params: CommentIdParamsDto }, config: { auth: "required" } },
    async (request, reply) => {
      const commentId = parsePublicId<CommentId>("cmt", request.params.comment_id, "comment_id");
      await comments.deleteComment(commentId, requireAuth(request).userId);
      return reply.code(204).send();
    },
  );
};
