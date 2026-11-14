import { useEffect, useRef } from "react";
export function ToolResize({
  width,
  onChange,
  side = "left",
}: {
  width: number;
  onChange: (width: number) => void;
  side?: "left" | "right";
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (drag.current)
        onChange(
          Math.max(
            260,
            Math.min(
              720,
              window.innerWidth / 2,
              drag.current.width +
                (side === "right"
                  ? e.clientX - drag.current.x
                  : drag.current.x - e.clientX),
            ),
          ),
        );
    };
    const end = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [onChange, side]);
  return (
    <div
      className="tool-resize"
      role="separator"
      aria-label="Resize tools panel"
      aria-orientation="vertical"
      aria-valuemin={260}
      aria-valuemax={720}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        drag.current = { x: e.clientX, width };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onChange(
            Math.max(
              260,
              Math.min(
                720,
                width +
                  (e.key === (side === "right" ? "ArrowRight" : "ArrowLeft")
                    ? 20
                    : -20),
              ),
            ),
          );
        }
      }}
    />
  );
}
