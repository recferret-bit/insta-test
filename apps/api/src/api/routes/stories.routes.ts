import {
  CreateStoryRequestDto,
  PageQuery,
  StoryIdParamsDto,
  StoryResponseDto,
  StoryTrayResponseDto,
  StoryViewerPageResponseDto,
  UserStoriesResponseDto,
  UsernameParamsDto,
} from "@insta/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { StoryId } from "../../domain/shared/ids.js";
import type { RouteDeps } from "../app-services.js";
import { requireAuth } from "../auth.plugin.js";
import { mapPageQueryToRequest, mapPageToResponseDto, parsePublicId } from "../mappers/shared.dto-mapper.js";
import {
  mapCreateStoryDtoToCommand,
  mapStoryItemViewToResponseDto,
  mapStoryTrayItemToDto,
  mapStoryViewerToResponseDto,
  mapUserStoriesViewToResponseDto,
} from "../mappers/stories.dto-mapper.js";
import { API_V1 } from "./index.js";

function storyIdOf(params: StoryIdParamsDto): StoryId {
  return parsePublicId<StoryId>("sty", params.story_id, "story_id");
}

/**
 * `stories` route module (`F-ECOMM-08`; external-communication/05-stories-api.md):
 * POST /stories, DELETE /stories/{story_id}, GET /stories/tray, GET /users/{username}/stories,
 * POST /stories/{story_id}/seen, GET /stories/{story_id}/viewers.
 */
export const storiesRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, { services, urls }) => {
  const stories = services.stories;

  app.post(
    `${API_V1}/stories`,
    {
      schema: { body: CreateStoryRequestDto, response: { 201: StoryResponseDto } },
      config: { auth: "required" },
    },
    async (request, reply) => {
      const cmd = mapCreateStoryDtoToCommand(request.body, requireAuth(request).userId);
      const view = await stories.createStory(cmd);
      return reply.code(201).send(mapStoryItemViewToResponseDto(view, urls));
    },
  );

  app.delete(
    `${API_V1}/stories/:story_id`,
    { schema: { params: StoryIdParamsDto }, config: { auth: "required" } },
    async (request, reply) => {
      await stories.deleteStory(storyIdOf(request.params), requireAuth(request).userId);
      return reply.code(204).send();
    },
  );

  app.get(
    `${API_V1}/stories/tray`,
    { schema: { response: { 200: StoryTrayResponseDto } }, config: { auth: "required" } },
    async (request, reply) => {
      const items = await stories.getTray(requireAuth(request).userId);
      return reply.code(200).send({ items: items.map((i) => mapStoryTrayItemToDto(i, urls)) });
    },
  );

  app.get(
    `${API_V1}/users/:username/stories`,
    {
      schema: { params: UsernameParamsDto, response: { 200: UserStoriesResponseDto } },
      config: { auth: "optional" },
    },
    async (request, reply) => {
      const view = await stories.getUserStories(request.params.username, request.auth?.userId ?? null);
      return reply.code(200).send(mapUserStoriesViewToResponseDto(view, urls));
    },
  );

  app.post(
    `${API_V1}/stories/:story_id/seen`,
    { schema: { params: StoryIdParamsDto }, config: { auth: "required" } },
    async (request, reply) => {
      await stories.markSeen(storyIdOf(request.params), requireAuth(request).userId);
      return reply.code(204).send();
    },
  );

  app.get(
    `${API_V1}/stories/:story_id/viewers`,
    {
      schema: {
        params: StoryIdParamsDto,
        querystring: PageQuery,
        response: { 200: StoryViewerPageResponseDto },
      },
      config: { auth: "required" },
    },
    async (request, reply) => {
      const page = await stories.listViewers(
        storyIdOf(request.params),
        requireAuth(request).userId,
        mapPageQueryToRequest(request.query),
      );
      return reply.code(200).send(mapPageToResponseDto(page, (v) => mapStoryViewerToResponseDto(v, urls)));
    },
  );
};
