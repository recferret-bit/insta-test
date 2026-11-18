import { LIMITS } from "@insta/contracts";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { captionError, captionHashtags, postErrorMessage, useCreatePostMutation } from "../../state/posts";
import { usePostComposer, type ComposerDeps, type ComposerSummary } from "../../state/posts-composer";
import { Button } from "../components/Button";
import { MediaPicker } from "../components/MediaPicker";
import { TextArea } from "../components/TextArea";
import { useDocumentTitle } from "../layout/useDocumentTitle";
import "./CreatePostPage.css";

export type CreatePostPageProps = ComposerDeps;

/** Status line under the publish button explaining why it is (not yet) enabled. */
export function publishStatus(summary: ComposerSummary): string {
  if (summary.total === 0) return "Add at least one photo or video.";
  if (summary.failed > 0)
    return `${summary.failed === 1 ? "1 upload" : `${summary.failed} uploads`} failed. Retry or remove ${summary.failed === 1 ? "it" : "them"}.`;
  if (!summary.ready) return `Uploading… ${summary.uploaded} of ${summary.total} done.`;
  return "All files uploaded. Ready to share.";
}

/**
 * `/create` (auth required) — F-FE-04: pick 1–10 photos/videos (client checks), reorder (drag or buttons), caption
 * with a live 2200 counter; uploads run in parallel (max 3) with progress; "Share" stays disabled until every upload
 * succeeded, then `POST /posts` and navigate to `/p/:id`.
 */
export function CreatePostPage(deps: CreatePostPageProps) {
  useDocumentTitle("Create new post");
  const navigate = useNavigate();
  const composer = usePostComposer(deps);
  const create = useCreatePostMutation();
  const [caption, setCaption] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { summary, state } = composer;
  const captionProblem = captionError(caption);
  const tagCount = captionHashtags(caption).length;
  const canPublish = summary.ready && !captionProblem && !create.isPending;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canPublish) return;
    setSubmitError(null);
    create.mutate(
      { caption, mediaIds: summary.mediaIds },
      {
        onSuccess: (post) => navigate(post.path, { replace: true }),
        onError: (error) => setSubmitError(postErrorMessage(error)),
      },
    );
  };

  return (
    <section className="page page--narrow create-post" aria-labelledby="create-post-title">
      <header className="create-post__header">
        <h1 id="create-post-title" className="create-post__title">
          Create new post
        </h1>
        <Link to="/create/story" className="create-post__story-link">
          Add to your story instead
        </Link>
      </header>

      <form className="create-post__form" onSubmit={onSubmit} noValidate>
        <fieldset className="create-post__step" disabled={create.isPending}>
          <legend className="create-post__legend">1. Photos and videos</legend>
          <MediaPicker
            items={state.items}
            problems={state.problems}
            onAdd={(files) => void composer.addFiles(files)}
            onRemove={composer.remove}
            onMove={composer.move}
            onRetry={composer.retry}
            onDismissProblems={composer.dismissProblems}
            disabled={create.isPending}
          />
        </fieldset>

        {summary.total > 0 ? (
          <fieldset className="create-post__step" disabled={create.isPending}>
            <legend className="create-post__legend">2. Caption</legend>
            <TextArea
              label="Caption"
              placeholder="Write a caption… Add #hashtags and @mentions."
              rows={5}
              value={caption}
              maxLength={LIMITS.captionMax}
              showCounter
              error={captionProblem}
              hint={tagCount > 0 ? `${tagCount}/${LIMITS.hashtagsPerPostMax} hashtags` : undefined}
              onChange={(event) => setCaption(event.target.value)}
            />
          </fieldset>
        ) : null}

        {submitError ? (
          <p className="create-post__error" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="create-post__footer">
          <p className="create-post__status" aria-live="polite">
            {publishStatus(summary)}
          </p>
          <Button type="submit" disabled={!canPublish} loading={create.isPending}>
            Share
          </Button>
        </div>
      </form>
    </section>
  );
}
