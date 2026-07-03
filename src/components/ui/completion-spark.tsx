"use client";

import { ReactNode, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Spark = {
  angle: number;
  startTime: number;
  x: number;
  y: number;
};

type CompletionSparkProps = {
  children: ReactNode;
  className?: string;
  color?: string;
  disabled?: boolean;
  sparkOnMount?: boolean;
};

const SPARK_COUNT = 10;
const SPARK_DURATION_MS = 460;
const SPARK_RADIUS = 28;

export function CompletionSpark({
  children,
  className,
  color = "rgba(11, 99, 206, 0.72)",
  disabled = false,
  sparkOnMount = false
}: CompletionSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const rect = parent.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext("2d");
    context?.setTransform(scale, 0, 0, scale, 0, 0);
  }, []);

  const emitSpark = useCallback((x: number, y: number) => {
    if (disabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const now = performance.now();
    sparksRef.current.push(
      ...Array.from({ length: SPARK_COUNT }, (_, index) => ({
        angle: (Math.PI * 2 * index) / SPARK_COUNT,
        startTime: now,
        x,
        y
      }))
    );
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;

    resizeCanvas();
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(parent);

    return () => observer.disconnect();
  }, [disabled, resizeCanvas]);

  useEffect(() => {
    if (disabled) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let frame = 0;
    const draw = (timestamp: number) => {
      const parent = canvas.parentElement;
      const rect = parent?.getBoundingClientRect();
      context.clearRect(0, 0, rect?.width ?? canvas.width, rect?.height ?? canvas.height);

      sparksRef.current = sparksRef.current.filter((spark) => {
        const progress = (timestamp - spark.startTime) / SPARK_DURATION_MS;
        if (progress >= 1) return false;

        const eased = progress * (2 - progress);
        const distance = eased * SPARK_RADIUS;
        const lineLength = 9 * (1 - eased);
        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        context.strokeStyle = color;
        context.lineWidth = 1.8;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
        return true;
      });

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [color, disabled]);

  useEffect(() => {
    if (!sparkOnMount || disabled) return;

    const timer = window.setTimeout(() => {
      const parent = canvasRef.current?.parentElement;
      const rect = parent?.getBoundingClientRect();
      if (!rect) return;
      emitSpark(rect.width / 2, Math.min(rect.height / 2, 88));
    }, 220);

    return () => window.clearTimeout(timer);
  }, [disabled, emitSpark, sparkOnMount]);

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        emitSpark(event.clientX - rect.left, event.clientY - rect.top);
      }}
    >
      {!disabled ? (
        <canvas
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3]"
          ref={canvasRef}
        />
      ) : null}
      {children}
    </div>
  );
}
