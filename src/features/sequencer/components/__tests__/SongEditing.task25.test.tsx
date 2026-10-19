// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TrackZone } from '../TrackZone';
import { useSessionStore } from '@store/sessionStore';
import { selectSong } from '@store/helpers';
import { compileSong, validateSong } from '@lib/song';
import { verseChorusSong } from '@lib/song/__tests__/fixtures';

vi.mock('@features/audio', () => ({
  useStrudelContext: vi.fn(() => ({ getHapState: () => ({ getTime: () => 0 }) })),
}));

function loadFixture() {
  useSessionStore.getState().loadSong(verseChorusSong());
  useSessionStore.setState({ language: 'en', isPlaying: false, activeTab: 'sequencer' });
}

const names = () => useSessionStore.getState().sections.map((s) => s.name);

describe('TASK-25 — secciones, arreglo y velocidad', () => {
  beforeEach(loadFixture);

  it('AC-1: shows a tab per section and switches the grid with it', () => {
    render(<TrackZone />);
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Verse', 'Chorus']);
    fireEvent.click(tabs[1]);
    expect(useSessionStore.getState().activeSectionId).toBe('chorus');
    expect(useSessionStore.getState().tracks).toHaveLength(4);
  });

  it('AC-1: adds a section, selects it and keeps the song valid', () => {
    render(<TrackZone />);
    fireEvent.click(screen.getByRole('button', { name: /Add section/ }));
    const state = useSessionStore.getState();
    expect(names()).toEqual(['Verse', 'Chorus', 'Section 3']);
    expect(state.activeSectionId).toBe(state.sections[2].id);
    expect(validateSong(selectSong(state)).ok).toBe(true);
  });

  it('AC-1: renames and duplicates a section', () => {
    render(<TrackZone />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Section name');
    fireEvent.change(input, { target: { value: 'Intro' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(names()[0]).toBe('Intro');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(names()).toEqual(['Intro', 'Intro (copy)', 'Chorus']);
  });

  it('AC-1: deleting a section leaves no orphaned arrangement blocks', () => {
    render(<TrackZone />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete section' }));
    const state = useSessionStore.getState();
    expect(state.sections.map((s) => s.id)).toEqual(['chorus']);
    expect(state.arrangement).toEqual([{ sectionId: 'chorus', repeat: 4 }]);
    expect(state.activeSectionId).toBe('chorus');
    expect(screen.getByRole('button', { name: 'Delete section' })).toBeDisabled();
  });

  it('AC-2: a 2-bar section renders two bar blocks of 16 steps', () => {
    const { container } = render(<TrackZone />);
    const firstRow = container.querySelector('article');
    expect(firstRow?.querySelectorAll('[data-bar]')).toHaveLength(2);
    expect(firstRow?.querySelectorAll('button[aria-pressed]')).toHaveLength(32);
  });

  it('AC-3: Shift+click and arrow keys change an active step\'s velocity, and plain click toggles', () => {
    const { container } = render(<TrackZone />);
    const kick = container.querySelector('article')!;
    const steps = kick.querySelectorAll<HTMLButtonElement>('button[aria-pressed]');

    // kick step 0 is on without velocity => accent
    expect(steps[0]).toHaveAttribute('data-level', 'accent');
    fireEvent.click(steps[0], { shiftKey: true }); // accent → ghost (wraps)
    expect(useSessionStore.getState().tracks[0].velocity?.[0]).toBe(0.35);
    expect(useSessionStore.getState().tracks[0].steps[0]).toBe(1);

    fireEvent.keyDown(steps[0], { key: 'ArrowUp' });
    expect(useSessionStore.getState().tracks[0].velocity?.[0]).toBe(0.7);
    fireEvent.keyDown(steps[0], { key: 'ArrowUp' });
    fireEvent.keyDown(steps[0], { key: 'ArrowUp' }); // clamped at accent
    expect(useSessionStore.getState().tracks[0].velocity?.[0]).toBe(1);

    fireEvent.click(steps[1]); // plain click turns a step on
    expect(useSessionStore.getState().tracks[0].steps[1]).toBe(1);
    fireEvent.keyDown(steps[2], { key: 'ArrowUp' }); // off step: nothing changes
    expect(useSessionStore.getState().tracks[0].steps[2]).toBe(0);
  });

  it('AC-4: shows the total bars and reorders the arrangement', () => {
    render(<TrackZone />);
    expect(screen.getByTestId('arrangement-total')).toHaveTextContent('Total: 10 bars');
    fireEvent.click(screen.getByRole('button', { name: 'Move later 1' }));
    expect(useSessionStore.getState().arrangement.map((i) => i.sectionId)).toEqual(['chorus', 'verse', 'verse']);
    fireEvent.click(screen.getByRole('button', { name: /^Repeat \+, Chorus 1/ }));
    expect(useSessionStore.getState().arrangement[0].repeat).toBe(5);
    expect(screen.getByTestId('arrangement-total')).toHaveTextContent('Total: 11 bars');
  });

  it('AC-6: every edit keeps the code in sync with the song (BR-009)', () => {
    render(<TrackZone />);
    fireEvent.click(screen.getByRole('button', { name: 'Move later 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'More bars' }));
    const state = useSessionStore.getState();
    expect(state.currentCode).toBe(compileSong(selectSong(state)));
    expect(validateSong(selectSong(state)).ok).toBe(true);
  });

  it('BR-008: editing sections, arrangement and the grid never calls the LLM', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { container } = render(<TrackZone />);
    fireEvent.click(screen.getByRole('button', { name: /Add section/ }));
    fireEvent.click(container.querySelector<HTMLButtonElement>('article button[aria-pressed]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Move later 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete section' }));
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('keeps playing when editing (BR-001): the transport state is untouched', () => {
    useSessionStore.setState({ isPlaying: true, uiState: 'playing' });
    render(<TrackZone />);
    fireEvent.click(screen.getByRole('button', { name: /Add section/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Move later 1' }));
    expect(useSessionStore.getState().isPlaying).toBe(true);
    expect(useSessionStore.getState().uiState).toBe('playing');
  });
});
