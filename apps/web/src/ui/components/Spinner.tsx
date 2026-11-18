import "./Spinner.css";

export type SpinnerProps = {
  size?: number;
  /** Announced to screen readers; pass `null` when a parent already announces busy state. */
  label?: string | null;
  className?: string;
};

export function Spinner({ size = 20, label = "Loading", className }: SpinnerProps) {
  const ring = (
    <span
      className={["spinner", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
  if (label === null) return ring;
  return (
    <span role="status" className="spinner-wrap">
      {ring}
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
