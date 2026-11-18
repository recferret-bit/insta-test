import type { CommentPageResponseDto, CommentResponseDto, CreateCommentRequestDto } from "@insta/contracts";

import type { CreateCommentCommand } from "../../domain/posts/commands.js";
import type { CommentView } from "../../domain/posts/views.js";
import type { PostId, UserId } from "../../domain/shared/ids.js";
import type { Page, TimeCursor } from "../../domain/shared/pagination.js";
import type { UrlBuilder } from "../url-builder.js";
import { mapUserToSummaryDto } from "./identity.dto-mapper.js";
import { mapPageToResponseDto, toPublicId } from "./shared.dto-mapper.js";

/**
 * Comment DTO ↔ Business mappers (external-communication/04-social-api.md#mapping-dto--business).
 * Request DTOs arrive already validated by their Zod schema; the domain re-validates invariants.
 */

/** `CreateCommentRequestDto` + path `post_id` → `CreateCommentCommand`. */
export function mapCreateCommentDtoToCommand(
  dto: CreateCommentRequestDto,
  postId: PostId,
  authorId: UserId,
): CreateCommentCommand {
  return { postId, authorId, text: dto.text };
}

/** `CommentView` → `CommentResponseDto`. */
export function mapCommentViewToResponseDto(view: CommentView, urls: UrlBuilder): CommentResponseDto {
  return {
    id: toPublicId("cmt", view.id),
    post_id: toPublicId("pst", view.postId),
    author: mapUserToSummaryDto(view.author, urls),
    text: view.text,
    created_at: view.createdAt.toISOString(),
  };
}

/** Comment page (`created_at ASC, id ASC`) → `CommentPageResponseDto`. */
export function mapCommentPageToResponseDto(
  page: Page<CommentView, TimeCursor>,
  urls: UrlBuilder,
): CommentPageResponseDto {
  return mapPageToResponseDto(page, (view) => mapCommentViewToResponseDto(view, urls));
}
