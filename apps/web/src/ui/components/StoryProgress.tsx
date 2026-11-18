import { segmentFill } from "../../state/stories-playback";
import "./StoryProgress.css";

export type StoryProgressProps = {
  /** Display duration of each story, in order. */
  durations: readonly number[];
  index: number;
  elapsedMs: number;
};

/** Segmented story progress bar (frontend/03 `StoryProgress`): one segment per story, the current one filling up. */
export function StoryProgress({ durations, index, elapsedMs }: StoryProgressProps) {
  return (
    <div
      className="story-progress"
      role="progressbar"
      aria-label={`Story ${index + 1} of ${durations.length}`}
      aria-valuemin={0}
      aria-valuemax={durations.length}
      aria-valuenow={index + 1}
    >
      {durations.map((duration, i) => (
        <span key={i} className="story-progress__segment" aria-hidden="true">
          <span
            className="story-progress__fill"
            data-testid="story-progress-fill"
            style={{ width: `${segmentFill(i, { index, elapsedMs }, duration) * 100}%` }}
          />
        </span>
      ))}
    </div>
  );
}
