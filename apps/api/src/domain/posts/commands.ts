import type { MediaId, PostId, UserId } from "../shared/ids.js";

export type CreatePostCommand = { authorId: UserId; caption: string; mediaIds: MediaId[] };

export type UpdatePostCaptionCommand = { postId: PostId; actorId: UserId; caption: string };

export type CreateCommentCommand = { postId: PostId; authorId: UserId; text: string };
