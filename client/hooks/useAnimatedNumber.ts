import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(value: number, duration = 700): number {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const start = performance.now();
    const from = previous.current;
    const delta = value - from;
    previous.current = value;

    let frame = 0;
    const animate = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(from + delta * eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}
