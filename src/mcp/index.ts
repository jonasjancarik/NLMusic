import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server';
import { defaultSongsDir } from './songsDir';

// Entrada de `npm run mcp`. stdout es el canal del protocolo: los logs van a stderr.
async function main(): Promise<void> {
  const songsDir = defaultSongsDir();
  const server = createMcpServer({ songsDir });
  await server.connect(new StdioServerTransport());
  console.error(`nlmusic MCP server ready (songs: ${songsDir})`);
}

main().catch((error) => {
  console.error('nlmusic MCP server failed to start:', error);
  process.exit(1);
});
