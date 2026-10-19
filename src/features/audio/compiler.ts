// TASK-24: the compiler moved to src/lib/strudel so the CLI/MCP (TASK-28) can import it
// without pulling in React. This re-export keeps existing imports working.
export * from '@lib/strudel/compiler';
