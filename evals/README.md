# Song evals

`npm run eval:songs` runs about ten song requests against the Claude API and writes one folder per run here (`evals/<date>/`), with a subfolder per case:

- `song.json`: the validated song
- `song.strudel.js`: the compiled code, ready to paste into the Strudel editor
- `song.mid`: MIDI export (once `src/lib/midi` from TASK-26 is available)
- `attempts.json`: every raw model output, including the errors sent back on a retry

`summary.json` lists each case as PASS or FAIL. The automatic checks are structural: the song is valid, every section is in the arrangement, every section has a kick and a snare (or clap/rim), and each section starts with a crash (a warning only). Musical quality is judged by listening.

Run folders are git-ignored. To keep a run for comparing prompt versions, add it with `git add -f evals/<date>`.

Options: `npm run eval:songs -- --list` lists the cases; `npm run eval:songs -- rock shuffle` runs only those. The script needs `ANTHROPIC_API_KEY` (environment or `.env.local`) and skips with a message without it. It is not part of `npm test`.
