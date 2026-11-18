import {
  CreatePostRequestDto,
  PageQuery,
  PostIdParamsDto,
  PostPageResponseDto,
  PostResponseDto,
  UpdatePostRequestDto,
  UsernameParamsDto,
} from "@insta/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { PostId } from "../../domain/shared/ids.js";
import type { RouteDeps } from "../app-services.js";
import { requireAuth } from "../auth.plugin.js";
import {
  mapCreatePostDtoToCommand,
  mapPostPageToResponseDto,
  mapPostViewToResponseDto,
  mapUpdatePostDtoToCommand,
} from "../mappers/posts.dto-mapper.js";
import { mapPageQueryToRequest, parsePublicId } from "../mappers/shared.dto-mapper.js";
import { API_V1 } from "./index.js";

const postIdOf = (params: PostIdParamsDto): PostId => parsePublicId<PostId>("pst", params.post_id, "post_id");

/**
 * `posts` route module (`F-ECOMM-05`; external-communication/03-media-and-posts-api.md):
 * POST /posts, GET|PATCH|DELETE /posts/{post_id}, GET /users/{username}/posts.
 * Mutations use the global 120/min-per-user limit; reads the 600/min-per-IP limit.
 */
export const postsRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, { services, urls }) => {
  const posts = services.posts;

  app.post(
    `${API_V1}/posts`,
    {
      schema: { body: CreatePostRequestDto, response: { 201: PostResponseDto } },
      config: { auth: "required" },
    },
    async (request, reply) => {
      const view = await posts.createPost(
        mapCreatePostDtoToCommand(request.body, requireAuth(request).userId),
      );
      return reply.code(201).send(mapPostViewToResponseDto(view, urls));
    },
  );

  app.get(
    `${API_V1}/posts/:post_id`,
    {
      schema: { params: PostIdParamsDto, response: { 200: PostResponseDto } },
      config: { auth: "optional" },
    },
    async (request, reply) => {
      const view = await posts.getPost(postIdOf(request.params), request.auth?.userId ?? null);
      return reply.code(200).send(mapPostViewToResponseDto(view, urls));
    },
  );

  app.patch(
    `${API_V1}/posts/:post_id`,
    {
      schema: { params: PostIdParamsDto, body: UpdatePostRequestDto, response: { 200: PostResponseDto } },
      config: { auth: "required" },
    },
    async (request, reply) => {
      const cmd = mapUpdatePostDtoToCommand(
        request.body,
        postIdOf(request.params),
        requireAuth(request).userId,
      );
      const view = await posts.editCaption(cmd);
      return reply.code(200).send(mapPostViewToResponseDto(view, urls));
    },
  );

  app.delete(
    `${API_V1}/posts/:post_id`,
    { schema: { params: PostIdParamsDto }, config: { auth: "required" } },
    async (request, reply) => {
      await posts.deletePost(postIdOf(request.params), requireAuth(request).userId);
      return reply.code(204).send();
    },
  );

  app.get(
    `${API_V1}/users/:username/posts`,
    {
      schema: { params: UsernameParamsDto, querystring: PageQuery, response: { 200: PostPageResponseDto } },
      config: { auth: "optional" },
    },
    async (request, reply) => {
      const page = await posts.listUserPosts(
        request.params.username,
        request.auth?.userId ?? null,
        mapPageQueryToRequest(request.query),
      );
      return reply.code(200).send(mapPostPageToResponseDto(page, urls));
    },
  );
};
