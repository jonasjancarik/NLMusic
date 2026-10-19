'use client';

import { AudioLines, Code2, SlidersHorizontal } from 'lucide-react';
import { TransportBar } from '@features/transport';
import { TrackZone } from '@features/sequencer';
import { StrudelCodePanel } from '@features/code-view';
import { ConfigTab } from '@features/config';
import { PromptBox } from '@features/prompt';
import { useSessionStore } from '@store/sessionStore';
import { useTranslation } from '@lib/i18n';
import { StrudelProvider, useStrudelContext } from '@features/audio';
import { LiveSongInbox } from '@features/live';

const TABS = [
  { id: 'sequencer' as const, labelKey: 'tabs.sequencer' as const, Icon: AudioLines },
  { id: 'code' as const, labelKey: 'tabs.strudel' as const, Icon: Code2 },
  { id: 'config' as const, labelKey: 'tabs.config' as const, Icon: SlidersHorizontal },
];

/**
 * Ensambla la shell principal consumiendo Strudel via Context en lugar de props.
 * Si falla la inicializacion, mantiene visible un banner persistente y bloquea acciones dependientes del motor.
 * @see EC-010
 */
function HomeContent() {
  const t = useTranslation();
  const strudel = useStrudelContext();
  const activeTab = useSessionStore((s) => s.activeTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);

  // EC-010: el banner de error ocupa ~64px adicionales sobre la TransportBar
  const contentPaddingTop = strudel.initError ? 136 : 72;

  return (
    <main className="relative min-h-screen">
      <TransportBar />

      {/* EC-010: banner persistente no cerrable — sin Strudel la app no es funcional */}
      {strudel.initError && (
        <div
          className="fixed left-0 right-0 z-[55] border-b border-[rgba(255,68,102,0.3)] bg-[rgba(255,68,102,0.08)]"
          style={{ top: 64 }}
          role="alert"
          aria-live="assertive"
        >
          <div className="mx-auto flex max-w-[1100px] items-start gap-3 px-5 py-3">
            <span className="mt-0.5 text-[16px] leading-none text-[var(--red)]">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--red)]">
                {t('page.audioErrorTitle')}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-dim)] break-words">
                {strudel.initError} — {t('page.audioErrorHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="shrink-0 rounded-[6px] border border-[rgba(255,68,102,0.5)] bg-[rgba(255,68,102,0.15)] px-3 py-1.5 text-[11px] text-[var(--red)] transition-colors hover:bg-[rgba(255,68,102,0.25)]"
            >
              {t('page.reload')}
            </button>
          </div>
        </div>
      )}

      <div
        className="mx-auto flex h-screen max-w-[1280px] flex-col pb-[118px]"
        style={{ paddingTop: contentPaddingTop }}
      >
        <div className="flex items-center px-5 pb-3 pt-2">
          {/* TASK-12: tercera pestaña de configuracion/guia comparte el mismo router de tabs del store. */}
          <div role="tablist" className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
            {TABS.map(({ id, labelKey, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={[
                  'flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-all sm:px-4',
                  activeTab === id
                    ? 'bg-[var(--surface3)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border-strong)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                <Icon size={14} strokeWidth={2} aria-hidden className={['hidden sm:block', activeTab === id ? 'text-[var(--cyan)]' : ''].join(' ')} />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        <section className="min-h-0 flex-1 overflow-hidden">
          {activeTab === 'sequencer' && <TrackZone />}
          {activeTab === 'code' && <StrudelCodePanel />}
          {activeTab === 'config' && <ConfigTab />}
        </section>
      </div>

      <PromptBox motorAvailable={!strudel.initError} />
      {/* TASK-29: canciones enviadas desde Claude (MCP) */}
      <LiveSongInbox />
    </main>
  );
}

export default function Home() {
  return (
    <StrudelProvider>
      <HomeContent />
    </StrudelProvider>
  );
}
