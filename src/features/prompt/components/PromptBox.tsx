"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, TriangleAlert, RotateCcw, LoaderCircle } from "lucide-react";
import { usePatternGen } from "../hooks/usePatternGen";
import { useSessionStore } from "@store/sessionStore";
import { useTranslation } from "@lib/i18n";

interface PromptBoxProps {
  motorAvailable?: boolean;
}

/**
 * Entrada principal de prompts con soporte de error no bloqueante y reintento.
 * Conserva el texto del usuario cuando la generación falla y solo limpia en éxito.
 *
 * @param motorAvailable - Indica si el motor Strudel está disponible para aceptar input.
 * @see BR-003 Error uniforme con opción de reintento y estado previo intacto
 * @see EC-001 Error de respuesta inválida mantiene prompt para corregir/reintentar
 */
// BR-010: Enter envía, Shift+Enter nueva línea — prompt vacío no llama al LLM
// EC-010: motor no disponible → toda la entrada deshabilitada
// BR-003: estado ERROR → banner no bloqueante + botón Reintentar
export function PromptBox({ motorAvailable = true }: PromptBoxProps) {
  const t = useTranslation();
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { generate, retry, isLoading, error, info } = usePatternGen();
  const uiState = useSessionStore((s) => s.uiState);
  const promptDraft = useSessionStore((s) => s.promptDraft);
  const setPromptDraft = useSessionStore((s) => s.setPromptDraft);

  // TASK-12/BR-010: inserta ejemplos desde ConfigTab sin auto-submit al LLM.
  useEffect(() => {
    if (promptDraft !== null) {
      setPrompt(promptDraft);
      setPromptDraft(null);
      textareaRef.current?.focus();
    }
  }, [promptDraft, setPromptDraft]);

  const isError = uiState === "error";
  const inputDisabled = isLoading || !motorAvailable;
  const disabledReason = !motorAvailable ? t('transport.audioError') : undefined;

  const resize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "20px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 80)}px`;
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || inputDisabled) return;
    const ok = await generate(prompt);
    // BR-003: el prompt solo se limpia cuando la operación termina correctamente.
    if (ok) {
      setPrompt("");
      const textarea = textareaRef.current;
      if (textarea) textarea.style.height = "20px";
    }
  };

  return (
    <div
      className="pointer-events-none"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        background: "linear-gradient(180deg, transparent 0%, rgba(8,8,11,0.92) 38%, var(--bg) 100%)",
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-[1280px] px-5 pb-4 pt-6">
        {/* BR-003: banner de error no bloqueante con opción de reintento */}
        {isError && error ? (
          <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-[rgba(255,68,102,0.3)] bg-[rgba(30,10,14,0.92)] px-3 py-2 backdrop-blur">
            <TriangleAlert size={14} className="shrink-0 text-[var(--red)]" />
            <span className="flex-1 text-[12px] text-[var(--text-dim)]">
              {error}
            </span>
            <button
              type="button"
              onClick={retry}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-[7px] border border-[rgba(255,68,102,0.4)] bg-[rgba(255,68,102,0.12)] px-2.5 py-1 text-[11px] text-[var(--red)] transition-colors hover:bg-[rgba(255,68,102,0.2)] disabled:opacity-40"
            >
              <RotateCcw size={11} strokeWidth={2} />
              {t('prompt.retry')}
            </button>
          </div>
        ) : null}

        <div
          title={disabledReason}
          className={[
            "prompt-wrap flex items-end gap-3 rounded-[16px] border bg-[rgba(23,23,29,0.92)] py-2.5 pl-4 pr-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-md transition-[border-color,box-shadow]",
            !motorAvailable
              ? "border-[rgba(255,68,102,0.3)] opacity-50 cursor-not-allowed"
              : isError
                ? "border-[rgba(255,68,102,0.3)] focus-within:border-[rgba(255,68,102,0.5)]"
                : "border-[var(--border-strong)] focus-within:border-[var(--border-active)] focus-within:shadow-[0_0_0_4px_rgba(0,255,200,0.07),0_18px_50px_rgba(0,0,0,0.55)]",
          ].join(" ")}
        >
          <Sparkles
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className={["mb-[9px] shrink-0", isLoading ? "animate-pulse text-[var(--cyan)]" : "text-[var(--text-muted)]"].join(" ")}
          />
          <textarea
            disabled={inputDisabled}
            title={disabledReason}
            ref={textareaRef}
            rows={1}
            className="prompt-input mb-[7px] max-h-[80px] [scrollbar-width:none] min-h-[20px] flex-1 resize-none bg-transparent text-[14px] leading-[1.45] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none disabled:cursor-not-allowed"
            placeholder={motorAvailable ? t('prompt.placeholder') : t('prompt.audioDisabled')}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onInput={resize}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />

          <span className="mb-[9px] hidden shrink-0 text-[11px] text-[var(--text-muted)] md:inline">
            <kbd className="font-sans text-[var(--text-dim)]">Enter</kbd> · <kbd className="font-sans text-[var(--text-dim)]">Shift+Enter</kbd>{" "}
            {t('prompt.newLine')}
          </span>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={inputDisabled || !prompt.trim()}
            title={disabledReason}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--cyan)] text-[#06221b] transition-all hover:shadow-[0_0_14px_rgba(0,255,200,0.45)] disabled:bg-[var(--surface3)] disabled:text-[var(--text-muted)] disabled:shadow-none"
            aria-label={t('prompt.submit')}
          >
            {isLoading ? (
              <LoaderCircle size={17} strokeWidth={2.25} className="animate-spin text-current" />
            ) : (
              <ArrowUp size={17} strokeWidth={2.25} className="text-current" />
            )}
          </button>
        </div>

        {!isError && info ? (
          <p className="mt-1.5 px-1 text-[11px] text-[var(--amber)]">{info}</p>
        ) : null}
      </div>
    </div>
  );
}
