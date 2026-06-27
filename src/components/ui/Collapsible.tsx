const DURATION_MS = 150;

type Props = {
  open: boolean;
  children: React.ReactNode;
  /** "up" = panel appears above toggle (default). "down" = panel appears below toggle. */
  direction?: "up" | "down";
  className?: string;
};

/**
 * Wraps children with a fade + slide enter/exit animation.
 * Always stays in the DOM; CSS controls visibility and pointer events.
 */
export function Collapsible({ open, children, direction = "up", className }: Props) {
  const origin = direction === "up" ? "origin-bottom" : "origin-top";
  const hiddenTranslate = direction === "up" ? "translate-y-1" : "-translate-y-1";

  return (
    <div
      aria-hidden={!open}
      className={`${origin} transition-all ease-out ${
        open
          ? "scale-100 translate-y-0 opacity-100"
          : `pointer-events-none scale-95 ${hiddenTranslate} opacity-0`
      } ${className ?? ""}`}
      style={{ transitionDuration: `${DURATION_MS}ms` }}
    >
      {children}
    </div>
  );
}
