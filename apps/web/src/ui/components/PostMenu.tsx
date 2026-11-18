import { LIMITS } from "@insta/contracts";
import { MoreHorizontal } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import type { PostViewModel } from "../../state/mappers/post";
import {
  captionError,
  postErrorMessage,
  useDeletePostMutation,
  useUpdateCaptionMutation,
} from "../../state/posts";
import { showToast } from "../../state/toast";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { TextArea } from "./TextArea";
import "./PostMenu.css";

type View = "closed" | "menu" | "edit" | "delete";

export type PostMenuProps = {
  post: Pick<PostViewModel, "id" | "path" | "caption" | "author">;
  /** Called after the post was deleted (e.g. the post page navigates away). */
  onDeleted?: () => void;
  /** Show "Go to post" (cards in lists; not on the post page itself). */
  showGoToPost?: boolean;
};

/** "…" menu for the post author (frontend/01 "PostCard"): edit caption, delete with confirmation. */
export function PostMenu({ post, onDeleted, showGoToPost = false }: PostMenuProps) {
  const [view, setView] = useState<View>("closed");
  const [caption, setCaption] = useState(post.caption);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateCaptionMutation();
  const remove = useDeletePostMutation();
  const close = () => {
    if (update.isPending || remove.isPending) return;
    setView("closed");
    setError(null);
  };

  const openEdit = () => {
    setCaption(post.caption);
    setError(null);
    update.reset();
    setView("edit");
  };

  const openDelete = () => {
    setError(null);
    remove.reset();
    setView("delete");
  };

  const onSave = (event: FormEvent) => {
    event.preventDefault();
    const problem = captionError(caption);
    if (problem) {
      setError(problem);
      return;
    }
    if (caption === post.caption) {
      setView("closed");
      return;
    }
    update.mutate(
      { postId: post.id, caption },
      {
        onSuccess: () => {
          setView("closed");
          showToast("Caption updated.", { tone: "success" });
        },
        onError: (err) => setError(postErrorMessage(err)),
      },
    );
  };

  const onConfirmDelete = () => {
    remove.mutate(
      { postId: post.id, authorUsername: post.author.username },
      {
        onSuccess: () => {
          setView("closed");
          showToast("Post deleted.", { tone: "success" });
          onDeleted?.();
        },
        onError: (err) => setError(postErrorMessage(err)),
      },
    );
  };

  return (
    <>
      <button
        type="button"
        className="post-menu__trigger"
        aria-label="More options"
        aria-haspopup="dialog"
        onClick={() => setView("menu")}
      >
        <Icon icon={MoreHorizontal} size={20} />
      </button>

      <Modal open={view === "menu"} onClose={close} title="Post options" hideTitle variant="sheet" size="sm">
        <ul className="post-menu__list">
          <li>
            <button type="button" className="post-menu__item" onClick={openEdit}>
              Edit caption
            </button>
          </li>
          <li>
            <button type="button" className="post-menu__item post-menu__item--danger" onClick={openDelete}>
              Delete
            </button>
          </li>
          {showGoToPost ? (
            <li>
              <Link className="post-menu__item" to={post.path} onClick={close}>
                Go to post
              </Link>
            </li>
          ) : null}
          <li>
            <button type="button" className="post-menu__item" onClick={close}>
              Cancel
            </button>
          </li>
        </ul>
      </Modal>

      <Modal open={view === "edit"} onClose={close} title="Edit caption" size="md">
        <form className="post-menu__form" onSubmit={onSave} noValidate>
          <TextArea
            label="Caption"
            hideLabel
            value={caption}
            rows={6}
            maxLength={LIMITS.captionMax}
            showCounter
            error={error}
            onChange={(event) => {
              setCaption(event.target.value);
              if (error) setError(null);
            }}
            autoFocus
          />
          <div className="post-menu__actions">
            <Button variant="secondary" onClick={close} disabled={update.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={update.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={view === "delete"} onClose={close} title="Delete post?" size="sm">
        <p className="post-menu__confirm">
          This post, its likes and comments will be removed from your profile.
        </p>
        {error ? (
          <p className="post-menu__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="post-menu__actions">
          <Button variant="secondary" onClick={close} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirmDelete} loading={remove.isPending}>
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
