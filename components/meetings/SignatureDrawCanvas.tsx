"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export type SignatureDrawCanvasRef = {
  clear: () => void;
  getPngDataUrl: () => string | null;
  hasInk: () => boolean;
};

type Props = {
  className?: string;
  width?: number;
  height?: number;
  onInkChange?: (hasInk: boolean) => void;
};

export const SignatureDrawCanvas = forwardRef<SignatureDrawCanvasRef, Props>(
  function SignatureDrawCanvas(
    { className, width = 560, height = 200, onInkChange }: Props,
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    const hasInkRef = useRef(false);

    const markInk = useCallback(() => {
      if (!hasInkRef.current) {
        hasInkRef.current = true;
        onInkChange?.(true);
      }
    }, [onInkChange]);

    const getCtx = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return null;
      return c.getContext("2d");
    }, []);

    const syncSize = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      c.width = Math.floor(width * dpr);
      c.height = Math.floor(height * dpr);
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, [height, width]);

    useEffect(() => {
      syncSize();
    }, [syncSize]);

    const lineTo = useCallback(
      (x: number, y: number) => {
        const ctx = getCtx();
        const last = lastRef.current;
        if (!ctx || last == null) return;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        lastRef.current = { x, y };
        markInk();
      },
      [getCtx, markInk],
    );

    const posFromEvent = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    ): { x: number; y: number } | null => {
      const c = canvasRef.current;
      if (!c) return null;
      const rect = c.getBoundingClientRect();
      if ("touches" in e && e.touches.length > 0) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }
      if ("clientX" in e) {
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
      return null;
    };

    const clear = useCallback(() => {
      syncSize();
      lastRef.current = null;
      drawingRef.current = false;
      hasInkRef.current = false;
      onInkChange?.(false);
    }, [onInkChange, syncSize]);

    useImperativeHandle(
      ref,
      () => ({
        clear,
        getPngDataUrl: () => {
          if (!hasInkRef.current || !canvasRef.current) return null;
          try {
            return canvasRef.current.toDataURL("image/png");
          } catch {
            return null;
          }
        },
        hasInk: () => hasInkRef.current,
      }),
      [clear],
    );

    const onDown = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      if ("touches" in e) e.preventDefault();
      const p = posFromEvent(e);
      if (!p) return;
      const ctx = getCtx();
      if (ctx) {
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000000";
        markInk();
      }
      drawingRef.current = true;
      lastRef.current = p;
    };

    const onMove = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      if ("touches" in e) e.preventDefault();
      if (!drawingRef.current) return;
      const p = posFromEvent(e);
      if (!p || lastRef.current == null) return;
      lineTo(p.x, p.y);
    };

    const onUp = () => {
      drawingRef.current = false;
      lastRef.current = null;
    };

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{ touchAction: "none", cursor: "crosshair" }}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
      />
    );
  },
);
