'use client';

import { useLiveSongs } from '../hooks/useLiveSongs';
import { LiveSongPrompt } from './LiveSongPrompt';

/** Conecta la app con las canciones enviadas desde el MCP y muestra el aviso (TASK-29). */
export function LiveSongInbox() {
  useLiveSongs();
  return <LiveSongPrompt />;
}
