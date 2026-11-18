import { Eye } from "lucide-react";

import { errorMessage } from "../../state/errors";
import { useStoryViewersQuery } from "../../state/stories";
import { Button } from "./Button";
import { EmptyState, ErrorState } from "./EmptyState";
import { Sheet } from "./Sheet";
import { Spinner } from "./Spinner";
import { UserRow } from "./UserRow";
import "./StoryViewers.css";

export type StoryViewersProps = {
  storyId: string;
  open: boolean;
  onClose: () => void;
  /** `"Seen by 3"` — used as the sheet title. */
  title: string;
};

/** Author-only "Seen by" list (`GET /stories/{id}/viewers`, most recent first) in a bottom sheet. */
export function StoryViewers({ storyId, open, onClose, title }: StoryViewersProps) {
  const query = useStoryViewersQuery(storyId, open);
  const viewers = query.data?.pages.flatMap((page) => page.items) ?? [];

  let body;
  if (query.isPending) {
    body = (
      <div className="story-viewers__status">
        <Spinner label="Loading viewers" />
      </div>
    );
  } else if (query.isError) {
    body = <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  } else if (viewers.length === 0) {
    body = <EmptyState icon={Eye} title="No viewers yet" headingLevel="h3" />;
  } else {
    body = (
      <>
        <ul className="story-viewers__list">
          {viewers.map((viewer) => (
            <li key={viewer.user.id}>
              <UserRow user={viewer.user} subtitle={viewer.viewedAtRelative} onNavigate={onClose} />
            </li>
          ))}
        </ul>
        {query.hasNextPage ? (
          <div className="story-viewers__more">
            <Button
              variant="secondary"
              size="sm"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Load more
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={title} size="sm">
      {body}
    </Sheet>
  );
}
