import { LIMITS } from "@insta/contracts";
import { forwardRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";

import { commentError, useCreateCommentMutation } from "../../state/comments";
import { errorMessage } from "../../state/errors";
import { useIsAuthenticated } from "../../state/session";
import { loginPathFor } from "../layout/next-path";
import { Button } from "./Button";
import { TextArea } from "./TextArea";
import "./CommentComposer.css";

export type CommentComposerProps = {
  postId: string;
  postAuthorId: string | null;
};

/**
 * "Add a comment…" box (F-FE-05): `Enter` posts, `Shift+Enter` adds a line; 1–500 characters after trim.
 * Anonymous visitors get a "Log in to comment" link instead.
 */
export const CommentComposer = forwardRef<HTMLTextAreaElement, CommentComposerProps>(function CommentComposer(
  { postId, postAuthorId },
  ref,
) {
  const authenticated = useIsAuthenticated();
  const location = useLocation();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateCommentMutation();

  if (!authenticated) {
    return (
      <p className="comment-composer comment-composer--anonymous">
        <Link to={loginPathFor(`${location.pathname}${location.search}`)}>Log in</Link> to like or comment.
      </p>
    );
  }

  const submit = () => {
    const problem = commentError(text);
    if (problem) {
      setError(problem);
      return;
    }
    create.mutate(
      { postId, postAuthorId, text },
      {
        onSuccess: () => {
          setText("");
          setError(null);
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!create.isPending) submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!create.isPending) submit();
    }
  };

  const showCounter = Array.from(text).length > LIMITS.commentMax - 100;

  return (
    <form className="comment-composer" onSubmit={onSubmit} noValidate>
      <TextArea
        ref={ref}
        label="Add a comment"
        hideLabel
        placeholder="Add a comment…"
        rows={1}
        value={text}
        maxLength={LIMITS.commentMax}
        showCounter={showCounter}
        error={error}
        readOnly={create.isPending}
        onChange={(event) => {
          setText(event.target.value);
          if (error) setError(null);
        }}
        onKeyDown={onKeyDown}
      />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={text.trim() === ""}
        loading={create.isPending}
      >
        Post
      </Button>
    </form>
  );
});
