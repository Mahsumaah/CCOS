"use client";

import type { MutableRefObject } from "react";
import { Bold, Italic, Undo2 } from "lucide-react";
import { forwardRef, useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MinutesHtmlEditorToolbar({
  editorRef,
  disabled,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean;
}) {
  const t = useTranslations("minutes");

  const run = (command: "bold" | "italic" | "undo") => {
    const el = editorRef.current;
    if (!el || disabled) return;
    el.focus();
    try {
      document.execCommand(command, false);
    } catch {
      /* execCommand may throw in strict environments */
    }
  };

  return (
    <div
      className="border-input bg-muted/40 flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 px-2 py-1.5"
      onMouseDown={(e) => {
        e.preventDefault();
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        disabled={disabled}
        aria-label={t("editorBold")}
        onClick={() => run("bold")}
      >
        <Bold className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        disabled={disabled}
        aria-label={t("editorItalic")}
        onClick={() => run("italic")}
      >
        <Italic className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        disabled={disabled}
        aria-label={t("editorUndo")}
        onClick={() => run("undo")}
      >
        <Undo2 className="size-4" />
      </Button>
    </div>
  );
}

export const MinutesHtmlEditor = forwardRef<
  HTMLDivElement,
  {
    initialHtml: string;
    dir: "ltr" | "rtl";
    disabled?: boolean;
    onHtmlChange: (html: string) => void;
    className?: string;
  }
>(function MinutesHtmlEditor(
  { initialHtml, dir, disabled, onHtmlChange, className },
  forwardedRef,
) {
  const innerRef = useRef<HTMLDivElement | null>(null);

  const setHostRef = (el: HTMLDivElement | null) => {
    innerRef.current = el;
    if (typeof forwardedRef === "function") {
      forwardedRef(el);
    } else if (forwardedRef) {
      (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = el;
    }
  };

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.innerHTML = initialHtml;
  }, [initialHtml]);

  return (
    <div
      ref={setHostRef}
      role="textbox"
      aria-multiline
      contentEditable={!disabled}
      spellCheck
      dir={dir}
      className={cn(
        "minutes-html-editor border-input max-h-[70vh] min-h-[420px] overflow-auto rounded-b-md border bg-white p-4 text-sm leading-relaxed shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "dark:bg-card",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
      onInput={() => {
        const el = innerRef.current;
        if (el) onHtmlChange(el.innerHTML);
      }}
    />
  );
});

MinutesHtmlEditor.displayName = "MinutesHtmlEditor";
