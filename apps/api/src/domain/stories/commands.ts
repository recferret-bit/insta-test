import type { MediaId, UserId } from "../shared/ids.js";

export type CreateStoryCommand = { authorId: UserId; mediaId: MediaId };
