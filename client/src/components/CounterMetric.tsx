import { useState, useEffect, useRef } from "react";

interface CounterMetricProps {
  target: number;
  duration?: number;
  label: string;
}

export default function CounterMetric({ target, duration = 1500, label }: CounterMetricProps) {
  const [count, setCount] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutQuad = 1 - (1 - progress) * (1 - progress);
      const currentCount = Math.floor(easeOutQuad * target);
      
      setCount(currentCount);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [target, duration]);

  return (
    <div className="text-center" data-testid="counter-metric">
      <p className="text-4xl font-bold text-foreground tabular-nums" data-testid="counter-value">
        {count.toLocaleString()}
      </p>
      <p className="text-sm text-muted-foreground mt-1" data-testid="counter-label">
        {label}
      </p>
    </div>
  );
}
