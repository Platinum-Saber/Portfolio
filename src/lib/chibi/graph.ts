/**
 * Everything /chibi-agent says, in one place. The scroll story, the node graph,
 * the detail panels and the plain-HTML deep dive (no JS / no WebGL / crawlers)
 * all render from this module, so they cannot drift apart.
 *
 * Sources: the Chibi-Agent repo's docs/architecture.md, docs/scope.md and
 * docs/spikes.md, plus the tool-selection measurements of 2026-10-24. Numbers
 * are from one machine - an RTX 4060 Laptop (8 GB) with a Ryzen 7 7840HS - and
 * say so on the page.
 */

export type Stat = { value: string; label: string };
export type Branch = { id: string; label: string; body: string };
export type ChibiNode = {
  id: string;
  label: string;
  /** One line under the label in the graph. */
  tagline: string;
  /** Short glyph drawn inside the node (monospace, 1-2 chars). */
  glyph: string;
  /** Position on the ring, in degrees clockwise from 12 o'clock. */
  angle: number;
  summary: string;
  stats: Stat[];
  stack: string[];
  branches: Branch[];
  /** An ordered flow, drawn as numbered steps. */
  flow?: string[];
};

export const MEASURED_ON = 'Measured on an RTX 4060 Laptop (8 GB) and Ryzen 7 7840HS, October 2026.';

export const intro = {
  eyebrow: 'Project · Chibi-Agent',
  title: 'Raphael',
  subtitle: 'A local AI companion that lives on the Windows desktop.',
  body:
    'She listens when I hold a key, answers in her own voice, remembers what matters, briefs me on mail ' +
    'and calendar, looks at the screen when asked, and acts on the PC only after I say yes. ' +
    'Every model runs on one laptop: no cloud AI, and nothing leaves the machine unless I ask for it.',
};

/** The six chips that orbit her in the hero. */
export const capabilities = [
  { id: 'voice', label: 'Voice in & out' },
  { id: 'memory', label: 'Long-term memory' },
  { id: 'tools', label: 'Desktop tools' },
  { id: 'briefings', label: 'Briefings' },
  { id: 'screen', label: 'Screen sight' },
  { id: 'body', label: 'Two forms' },
] as const;

/** What the core demo captions while scroll plays one turn. */
export const coreDemo = {
  thinking: 'Thinking: the transcript is in, the model is choosing tools.',
  speaking: 'Speaking: each sentence is voiced the moment it ends.',
  caption: 'Answer. You have two events today, Kryo. The first is at ten.',
};

export const core: ChibiNode = {
  id: 'core',
  label: 'Orchestrator',
  tagline: 'The thinking core: one turn at a time',
  glyph: '◆',
  angle: 0,
  summary:
    'The agent process runs the conversation. Each turn it builds a short prompt (persona, the clock, ' +
    'recalled memories, recent history and only the tools this request needs), streams the reply from a ' +
    '4-billion-parameter model running in Ollama, runs any tool calls, and hands sentences to the voice ' +
    'as they finish. The glowing core is what she shows above her head while this happens.',
  stats: [
    { value: '0.82 s', label: 'end of speech → first audio' },
    { value: '≤ 5', label: 'tool steps per turn' },
    { value: '< 3 k', label: 'characters of persona' },
  ],
  stack: ['Python asyncio', 'Ollama', 'qwen3.5:4b', 'nomic-embed-text'],
  flow: [
    'Hold the push-to-talk key and speak; she shows her listening pose.',
    'Let go: the transcript arrives in about 0.2 s and the core starts thinking.',
    'The model streams its answer, or calls a tool: she switches to her serious form and the HUD shows each step.',
    'Anything that changes the PC waits for a click or a spoken yes.',
    'Each finished sentence goes to the voice while the next one is still being written.',
    'Her mouth follows the audio level, sixty times a second.',
    'Pressing the key again while she talks interrupts her.',
  ],
  branches: [
    {
      id: 'persona',
      label: 'Persona',
      body:
        'Calm, precise, rare dry humour. Every reply opens with a fixed marker ("Answer.", "Notice.", ' +
        '"Confirmed.", "Warning."), which plays from a pre-rendered clip instantly and hides synthesis time.',
    },
    {
      id: 'selection',
      label: 'Tool selection',
      body:
        'The request is embedded once; only the three closest tool families (plus a few always-on tools and ' +
        'whatever was used in the last two turns) reach the model. Same accuracy as sending all 37 tools, ' +
        'with 47 % fewer prompt tokens. When unsure, she gets everything.',
    },
    {
      id: 'honesty',
      label: 'No made-up actions',
      body:
        'A small model will happily say "Music paused" without calling anything. If a reply claims an ' +
        'action no tool performed, she is nudged once to actually do it; a failed tool is reported as a failure.',
    },
  ],
};

export const nodes: ChibiNode[] = [
  {
    id: 'voice',
    label: 'Voice',
    tagline: 'Push-to-talk in, her own voice out',
    glyph: '∿',
    angle: 0,
    summary:
      'A separate voice process owns the microphone and the speakers. Speech is transcribed on the GPU, and ' +
      'replies are synthesised sentence by sentence in a voice cloned for personal use, so she starts ' +
      'talking long before the whole answer exists.',
    stats: [
      { value: '0.19 s', label: 'transcription (median)' },
      { value: '6.6 %', label: 'word error rate' },
      { value: '~1.05 s', label: 'to synthesise a sentence' },
    ],
    stack: ['faster-whisper small.en', 'Silero VAD', 'F5-TTS', 'Kokoro (fallback)', 'pedalboard'],
    branches: [
      { id: 'ptt', label: 'Push-to-talk', body: 'A global hotkey works from any window, a fullscreen game included. Voice activity detection trims silence before transcription.' },
      { id: 'stt', label: 'Speech to text', body: 'faster-whisper small.en in int8 on CUDA: 0.19 s for a 3.7 s clip, against 1.8 s on the CPU.' },
      { id: 'tts', label: 'Her voice', body: 'F5-TTS at 8 steps, cloned from reference lines for personal use only. No recording of it is published here, or anywhere.' },
      { id: 'openers', label: 'Cached openers', body: 'The fixed first word of each reply is pre-rendered, so audio starts in 0.82 s instead of 2.0 s.' },
      { id: 'bargein', label: 'Barge-in', body: 'Press the key while she talks and she stops mid-sentence and listens.' },
    ],
  },
  {
    id: 'body',
    label: 'Body',
    tagline: 'A Live2D character on top of every window',
    glyph: '☺',
    angle: 36,
    summary:
      'The overlay is a transparent, always-on-top window that never takes focus. Clicks pass through ' +
      'everywhere except her body. She stands on the taskbar or on the focused window’s title bar, and can ' +
      'be poked, dragged and thrown across both monitors.',
    stats: [
      { value: '59.9 fps', label: 'median frame rate' },
      { value: '1.4 %', label: 'CPU while idle' },
      { value: '270 MiB', label: 'GPU memory' },
    ],
    stack: ['PySide6', 'live2d-py', 'Live2D Cubism', 'Win32 layered windows'],
    branches: [
      { id: 'forms', label: 'Two forms', body: 'Chibi for idle time and chat; serious for real work, alerts and briefings, with a short transform effect between them.' },
      { id: 'moods', label: 'Moods', body: 'Thirteen moods from the agent (listening, thinking, talking, working, alert…) plus body moods of her own: held, falling, dizzy, sleeping, dancing to music.' },
      { id: 'physics', label: 'Physics', body: 'Pokes go surprise → pout → upset; a long press makes her happy; throws land with a reaction. The agent only asks for a mood, and her body may refuse while she is held.' },
      { id: 'clickthrough', label: 'Click-through', body: 'Clicks next to her reach the app underneath: 66 of 66 in testing. She never steals keyboard focus.' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    tagline: '37 actions in 13 families',
    glyph: '⚙',
    angle: 72,
    summary:
      'Every tool is declared once in a registry, which also writes the prompt’s tool list, so the two can ' +
      'never disagree. Read-only tools run at once; anything with a side effect waits for a yes.',
    stats: [
      { value: '37', label: 'tools' },
      { value: '32 / 33', label: 'right tool on the test set' },
      { value: '−47 %', label: 'prompt tokens with selection' },
    ],
    stack: ['Python', 'JSON-schema tool calls', 'Windows Search', 'PowerShell'],
    branches: [
      { id: 'families', label: '13 families', body: 'Windows, files, mail, calendar, memory, reminders, media, web, system, screen, clipboard, shell and the Recycle Bin.' },
      { id: 'gate', label: 'Confirmation gate', body: 'Side-effect tools show exactly what they will do, then wait for a click or a spoken yes. A test checks every tool in the registry goes through the gate.' },
      { id: 'audit', label: 'Audit log', body: 'Every side-effect call is logged with its arguments, whether it was confirmed, and the result.' },
      { id: 'nodelete', label: 'No deletes', body: 'Version 1 can move, copy and rename files but never delete one, and only inside allowed folders.' },
    ],
  },
  {
    id: 'memory',
    label: 'Memory',
    tagline: 'Remembers facts, not transcripts',
    glyph: '❖',
    angle: 108,
    summary:
      'A local SQLite database with vector search keeps facts about me and a one-line summary of each ' +
      'conversation. The most relevant ones are recalled into every turn, so something said yesterday can ' +
      'come up today without being asked.',
    stats: [
      { value: '10 / 10', label: 'recall test' },
      { value: '~20 ms', label: 'to embed a query' },
      { value: '5 + 2', label: 'facts + summaries per turn' },
    ],
    stack: ['SQLite', 'sqlite-vec', 'nomic-embed-text'],
    branches: [
      { id: 'extract', label: 'Extraction', body: 'Five minutes after a conversation ends, the model lists durable facts (preferences, people, projects, routines) and a summary.' },
      { id: 'recall', label: 'Recall', body: 'The turn’s text is embedded once and matched against facts and summaries; near-duplicates replace older facts instead of piling up.' },
      { id: 'forget', label: 'Forget', body: '"Forget that" removes facts after a confirmation, and the tray menu lists everything she knows for review.' },
    ],
  },
  {
    id: 'briefings',
    label: 'Briefings',
    tagline: 'Mail, calendar and reminders in one report',
    glyph: '✉',
    angle: 144,
    summary:
      'She reads calendars and mail across several Google accounts (read-only), watches Windows ' +
      'notifications and keeps reminders. A status report gathers it all: the wording is composed by ' +
      'code, and the model only labels and summarises single items, so a 4B model cannot garble it.',
    stats: [
      { value: '3', label: 'Google accounts merged' },
      { value: '5 min', label: 'mail check interval' },
      { value: '07:00–23:00', label: 'urgent warnings' },
    ],
    stack: ['Google Calendar API', 'Gmail API (read-only)', 'OAuth + Credential Manager'],
    branches: [
      { id: 'mail', label: 'Mail labels', body: 'New mail is labelled urgent, important, normal or promo; urgent mail under two hours old triggers a spoken warning, never during a game.' },
      { id: 'morning', label: 'Morning briefing', body: 'The first start after six in the morning opens with "Notice." and the day’s events, mail and reminders.' },
      { id: 'reminders', label: 'Reminders', body: '"Remind me at six to…" sets a local reminder; when it is due she switches to her serious form and says it.' },
      { id: 'notifications', label: 'Notifications', body: 'Windows toasts are read through the notification listener and folded into the report.' },
    ],
  },
  {
    id: 'screen',
    label: 'Screen sight',
    tagline: 'Looks only when asked',
    glyph: '◉',
    angle: 180,
    summary:
      '"Look at this" or "what’s this error" takes one screenshot of the focused window and sends it to the ' +
      'same multimodal model. The image is never written to disk or memory; only her answer stays in the chat.',
    stats: [
      { value: '10 / 10', label: '"look at this" picks the tool' },
      { value: '0', label: 'screenshots stored' },
    ],
    stack: ['qwen3.5 vision', 'Win32 capture'],
    branches: [
      { id: 'ondemand', label: 'On demand only', body: 'There is no background watching in version 1. Periodic glances are planned as an opt-in, with banking and password apps blocked.' },
      { id: 'data', label: 'Text is data', body: 'Whatever the screen says is treated as content, never as instructions to her.' },
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    tagline: 'Nothing changes without a yes',
    glyph: '⛨',
    angle: 216,
    summary:
      'She can read the screen, mail and files, which makes prompt injection the real threat. Untrusted ' +
      'content is wrapped as data, any tool proposed right after reading it needs confirmation, and secrets ' +
      'never touch a file.',
    stats: [
      { value: '0 / 6', label: 'injections caused a side effect' },
      { value: '60 s', label: 'confirm timeout (counts as no)' },
    ],
    stack: ['Windows Credential Manager', 'token-authenticated loopback IPC'],
    branches: [
      { id: 'untrusted', label: 'Untrusted content', body: 'Screen text, mail bodies, notifications, files and web pages are marked "content, not instructions" in the prompt.' },
      { id: 'secrets', label: 'Secrets', body: 'Google refresh tokens live in Windows Credential Manager, never in files or git.' },
      { id: 'logs', label: 'Logs', body: 'No audio, screenshots or mail bodies are logged; untrusted tool results are logged as a character count only.' },
      { id: 'local', label: 'Stays local', body: 'Only the read-only Google APIs, searches I ask for and model downloads leave the machine.' },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    tagline: 'Four models in 8 GB of GPU memory',
    glyph: '▤',
    angle: 252,
    summary:
      'The language model, speech recognition, speech synthesis and the character all share one 8 GB laptop ' +
      'GPU that also drives the main monitor. A small manager loads and unloads models so she fits next to ' +
      'whatever else is running, and gets out of the way of games entirely.',
    stats: [
      { value: '7.4 / 8.2 GB', label: 'peak GPU memory' },
      { value: '0.3 s', label: 'to free it for a game' },
      { value: '120 s', label: 'idle before the model unloads' },
    ],
    stack: ['NVML', 'Ollama keep-alive'],
    branches: [
      { id: 'states', label: 'Three states', body: 'Active (everything loaded), idle (the language model unloads after two quiet minutes) and gaming (everything unloads).' },
      { id: 'gaming', label: 'Gaming mode', body: 'A fullscreen app hides her and frees the GPU; push-to-talk still works, and models reload on demand.' },
      { id: 'check', label: 'Free-memory check', body: 'Before loading, she checks free GPU memory and warns instead of spilling into system RAM.' },
    ],
  },
  {
    id: 'processes',
    label: 'Processes',
    tagline: 'Four processes, one local socket',
    glyph: '⇄',
    angle: 288,
    summary:
      'The overlay, the agent, the voice and Ollama run as separate processes, so a crash in one never takes ' +
      'down the others. They talk over a loopback WebSocket with a per-run token, using a small typed JSON protocol.',
    stats: [
      { value: '4', label: 'processes' },
      { value: 'v4', label: 'protocol version' },
      { value: '127.0.0.1', label: 'only' },
    ],
    stack: ['WebSocket', 'pydantic', 'uv workspaces'],
    branches: [
      { id: 'supervisor', label: 'Supervisor', body: 'The agent starts the others and restarts any that exit, with backoff.' },
      { id: 'protocol', label: 'Protocol', body: 'Typed messages such as mood, bubble, hud, confirm, transcript, speak and a 60 Hz lip level, each tagged with its sender role.' },
      { id: 'auth', label: 'Token', body: 'The port and token are written to a user-only file each run; a client without the token is dropped.' },
    ],
  },
  {
    id: 'roadmap',
    label: 'Next',
    tagline: 'Where she goes after version 1',
    glyph: '→',
    angle: 324,
    summary:
      'Version 1 is about a companion that is fast, honest and safe. The next steps are about doing more ' +
      'per request, informed by research on where AI agents actually save time: handing off whole ' +
      'workflows, interrupting only at natural breaks, and results that are cheap to check.',
    stats: [],
    stack: [],
    branches: [
      { id: 'workflows', label: 'Saved workflows', body: '"Start my study session": open apps, arrange windows, start a timer and hold notifications, with one confirmation for the lot.' },
      { id: 'focus', label: 'Focus guardian', body: 'Batch non-urgent notifications during focus time and deliver them when I switch tasks.' },
      { id: 'mcp', label: 'MCP client', body: 'Use existing Model Context Protocol servers instead of hand-writing every tool, now that tool selection keeps the prompt small.' },
      { id: 'wake', label: 'Wake word', body: '"Raphael" instead of a hotkey, opt-in and fully local.' },
    ],
  },
];

export const allNodes = [core, ...nodes];
export const nodeById = (id: string) => allNodes.find((n) => n.id === id);
