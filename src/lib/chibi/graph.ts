/**
 * Everything /chibi-agent says, in one place: the architecture as a tree. The
 * scroll story, the node graph, the detail panel and the plain-HTML deep dive
 * (no JS, crawlers) all render from this module, so they cannot drift apart.
 *
 * The tree is shaped by what really splits: a node gets children only where it
 * is genuinely made of separate parts (her two voices, the four kinds of
 * briefing); an isolated feature (hearing, memory, screen sight) is a leaf and
 * opens straight to its details.
 *
 * Sources: the Chibi-Agent repo's docs/architecture.md, docs/scope.md and
 * docs/spikes.md, plus the tool-selection measurements of 2026-10-24. Numbers
 * are from one machine and say so on the page.
 */

export type Stat = { value: string; label: string };
export type ChibiNode = {
  /** Unique among its siblings; a node's address is the path of ids from the top. */
  id: string;
  label: string;
  /** One line under the label in the graph. */
  tagline: string;
  /** Short glyph drawn inside the node. */
  glyph: string;
  /** Top level only: position on the ring, degrees clockwise from 12 o'clock. */
  angle?: number;
  summary: string;
  stats?: Stat[];
  stack?: string[];
  /** An ordered flow, drawn as numbered steps. */
  flow?: string[];
  children?: ChibiNode[];
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
  children: [
    {
      id: 'turn',
      label: 'Turn loop',
      tagline: 'From a held key to a spoken answer',
      glyph: '↻',
      summary: 'One turn, end to end. Audio starts before the answer is finished being written.',
      flow: [
        'Hold the push-to-talk key and speak; she shows her listening pose.',
        'Let go: the transcript arrives in about 0.2 s and the core starts thinking.',
        'The model streams its answer, or calls a tool: she switches to her serious form and the HUD shows each step.',
        'Anything that changes the PC waits for a click or a spoken yes.',
        'Each finished sentence goes to the voice while the next one is still being written.',
        'Her mouth follows the audio level, sixty times a second.',
        'Pressing the key again while she talks interrupts her.',
      ],
      stats: [
        { value: '0.82 s', label: 'to first audio (spike)' },
        { value: '1.1–1.6 s', label: 'in daily use' },
      ],
    },
    {
      id: 'persona',
      label: 'Persona',
      tagline: 'Calm, precise, rare dry humour',
      glyph: '❝',
      summary:
        'Every reply opens with a fixed marker ("Answer.", "Notice.", "Confirmed.", "Warning.") that plays ' +
        'from a pre-rendered clip the instant the model emits it, hiding the time the voice needs for the ' +
        'next sentence. The persona stays under 3,000 characters: longer prompts made the small model worse.',
    },
    {
      id: 'selection',
      label: 'Tool selection',
      tagline: 'Only the tools this request needs',
      glyph: '⌖',
      summary:
        'The request is embedded once; only the three closest tool families, a few always-on tools and ' +
        'whatever was used in the last two turns reach the model. Same accuracy as sending all 37 tools, ' +
        'with 47 % fewer prompt tokens. When unsure, she gets everything.',
      stats: [
        { value: '32 / 33', label: 'right tool, with or without selection' },
        { value: '−47 %', label: 'prompt tokens' },
      ],
    },
    {
      id: 'honesty',
      label: 'Honesty checks',
      tagline: 'No made-up actions',
      glyph: '✓',
      summary:
        'A small model will happily say "Music paused" without calling anything. If a reply claims an ' +
        'action no tool performed, she is nudged once to actually do it; a failed tool is reported as a ' +
        'failure, never smoothed over.',
    },
  ],
};

export const nodes: ChibiNode[] = [
  {
    id: 'hearing',
    label: 'Hearing',
    tagline: 'Push-to-talk, transcribed on the GPU',
    glyph: '◎',
    angle: 0,
    summary:
      'A global hotkey works from any window, a fullscreen game included. Voice activity detection trims ' +
      'silence, faster-whisper transcribes on the GPU, and pressing the key while she talks stops her ' +
      'mid-sentence so she can listen.',
    stats: [
      { value: '0.19 s', label: 'transcription (median)' },
      { value: '6.6 %', label: 'word error rate' },
      { value: '1.8 s', label: 'the same clip on the CPU' },
    ],
    stack: ['faster-whisper small.en', 'Silero VAD', 'int8 on CUDA'],
  },
  {
    id: 'voice',
    label: 'Voice',
    tagline: 'Her own voice, or a stock one',
    glyph: '∿',
    angle: 33,
    summary:
      'Replies are voiced sentence by sentence, so she starts talking long before the whole answer exists. ' +
      'The fixed first word of each reply is a cached clip. Two engines can speak: the voice trained for ' +
      'her, and a stock fallback.',
    stats: [{ value: '0.82 s', label: 'to first audio with cached openers' }],
    children: [
      {
        id: 'cloned',
        label: 'Cloned voice',
        tagline: 'F5-TTS, trained on her lines',
        glyph: '♪',
        summary:
          'Her main voice: F5-TTS cloned from reference lines, at 8 sampling steps, with an effects chain on ' +
          'top. It is for personal use on this machine only, so no recording of it is published here or anywhere.',
        stats: [
          { value: '~1.05 s', label: 'per sentence' },
          { value: '2.5–4.9×', label: 'faster than real time' },
          { value: '0.95 GB', label: 'peak GPU memory' },
        ],
        stack: ['F5-TTS 1.1', 'pedalboard', 'CUDA'],
      },
      {
        id: 'kokoro',
        label: 'Kokoro',
        tagline: 'Stock voice on the CPU',
        glyph: '♫',
        summary:
          'A small stock voice that runs on the CPU: the fallback when the clone can’t run. Her Customize ' +
          'window can switch to it, tune its speed or pick a different stock voice.',
        stack: ['Kokoro (ONNX)', 'CPU'],
      },
    ],
  },
  {
    id: 'body',
    label: 'Body',
    tagline: 'A character on top of every window',
    glyph: '☺',
    angle: 65,
    summary:
      'The overlay is a transparent, always-on-top window that never takes focus. Clicks pass through ' +
      'everywhere except her body. She stands on the taskbar or the focused window’s title bar and can be ' +
      'poked, dragged and thrown across both monitors.',
    stats: [
      { value: '59.9 fps', label: 'median (Live2D build)' },
      { value: '1.4 %', label: 'CPU while idle (Live2D build)' },
    ],
    stack: ['PySide6', 'Win32 layered windows'],
    children: [
      {
        id: 'forms',
        label: 'Two forms',
        tagline: 'Chibi for chat, serious for work',
        glyph: '⇋',
        summary:
          'Chibi for idle time and chat; serious for real work, alerts and briefings, with a short transform ' +
          'effect between them. She goes back to chibi ten seconds after the work is done.',
      },
      {
        id: 'moods',
        label: 'Moods',
        tagline: 'Asked for, never forced',
        glyph: '♥',
        summary:
          'Thirteen moods come from the agent (listening, thinking, talking, working, alert…) and her body ' +
          'adds its own: held, falling, dizzy, sleeping, dancing to whatever music is playing. The agent only ' +
          'asks for a mood; her body may refuse while she is being held.',
      },
      {
        id: 'presence',
        label: 'Desktop presence',
        tagline: 'There, but never in the way',
        glyph: '▭',
        summary:
          'Clicks next to her reach the app underneath (66 of 66 in testing) and she never steals keyboard ' +
          'focus. Pokes go surprise → pout → upset, throws land with a reaction, and a fullscreen game hides ' +
          'her and frees the GPU.',
      },
      {
        id: 'drawn',
        label: 'Drawn body',
        tagline: 'An image pack, animated like a puppet',
        glyph: '✎',
        summary:
          'The character on this page is the same art her overlay uses: separate drawings for each ' +
          'expression, blink and mouth shape, eight gaze directions, and walk and dance cycles. She blinks, ' +
          'follows the pointer with her eyes and talks by swapping drawings, not by a skeletal rig.',
      },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    tagline: '37 actions in 13 families',
    glyph: '⚙',
    angle: 98,
    summary:
      'Every tool is declared once in a registry, which also writes the prompt’s tool list, so the two can ' +
      'never disagree. Read-only tools run at once; anything with a side effect waits for a yes, and every ' +
      'such call goes to an audit log.',
    stats: [
      { value: '37', label: 'tools' },
      { value: '13', label: 'families' },
    ],
    stack: ['JSON-schema tool calls', 'Python'],
    children: [
      {
        id: 'apps',
        label: 'Apps & windows',
        tagline: 'Open, focus, arrange, close',
        glyph: '▣',
        summary:
          'Open an app, a file or a folder; bring a window to the front, snap or minimise it, or close it. ' +
          'Read-only lookups (running apps, the window in front, battery, CPU, GPU memory, network) answer ' +
          'questions about the PC without asking.',
      },
      {
        id: 'files',
        label: 'Files & Recycle Bin',
        tagline: 'Find, move, copy, never delete',
        glyph: '▤',
        summary:
          'Find files by name or by what is inside them, list folders, read text files, create, move, copy ' +
          'and rename, and restore from the Recycle Bin. Version 1 never deletes a file, and only touches ' +
          'folders it is allowed into.',
      },
      {
        id: 'shell',
        label: 'PowerShell',
        tagline: 'The escape hatch, shown in full',
        glyph: '›_',
        summary:
          'For anything the other tools cannot do, she can run a PowerShell command. The full command line ' +
          'is shown before it runs, destructive commands are blocked, and nothing runs elevated.',
      },
      {
        id: 'web',
        label: 'Web, media & clipboard',
        tagline: 'The small everyday ones',
        glyph: '◍',
        summary:
          'Search the web or YouTube, open a link, pause or skip music, set the volume, read or fill the ' +
          'clipboard. Media keys and volume are the only side effects that skip the yes: harmless and frequent.',
      },
    ],
  },
  {
    id: 'memory',
    label: 'Memory',
    tagline: 'Remembers facts, not transcripts',
    glyph: '❖',
    angle: 131,
    summary:
      'A local SQLite database with vector search keeps facts about me and a one-line summary of each ' +
      'conversation. The most relevant ones are recalled into every turn, so something said yesterday can ' +
      'come up today without being asked.',
    flow: [
      'Five minutes after a conversation ends, the model lists durable facts (preferences, people, projects, routines) and a summary.',
      'Each fact is embedded; one close to an older fact replaces it instead of piling up.',
      'Every turn, the request is embedded once and the five closest facts and two summaries join the prompt.',
      '"Forget that" removes facts after a confirmation, and the tray lists everything she knows.',
    ],
    stats: [
      { value: '10 / 10', label: 'recall test' },
      { value: '~20 ms', label: 'to embed a query' },
    ],
    stack: ['SQLite', 'sqlite-vec', 'nomic-embed-text'],
  },
  {
    id: 'briefings',
    label: 'Briefings',
    tagline: 'Mail, calendar and reminders in one report',
    glyph: '✉',
    angle: 164,
    summary:
      'A status report gathers everything that needs attention. The wording is composed by code and the ' +
      'model only labels and summarises single items, so a small model cannot garble it. The first start ' +
      'after six in the morning opens with "Notice." and the day ahead.',
    stats: [{ value: '07:00–23:00', label: 'urgent warnings' }],
    stack: ['Google Calendar API', 'Gmail API (read-only)', 'OAuth + Credential Manager'],
    children: [
      {
        id: 'mail',
        label: 'Mail',
        tagline: 'Three accounts, labelled for urgency',
        glyph: '✉',
        summary:
          'New mail across three Google accounts is checked every five minutes and labelled urgent, ' +
          'important, normal or promo. Urgent mail under two hours old gets a spoken warning, never during ' +
          'a game. Read-only: she cannot send.',
        stats: [{ value: '5 min', label: 'check interval' }],
      },
      {
        id: 'calendar',
        label: 'Calendar',
        tagline: '"What’s on today?"',
        glyph: '▦',
        summary: 'Events from every account, merged and de-duplicated, for today, tomorrow or the week.',
      },
      {
        id: 'reminders',
        label: 'Reminders',
        tagline: '"Remind me at six to…"',
        glyph: '⏲',
        summary:
          'Local reminders and timers, set by voice. When one is due she switches to her serious form and ' +
          'says it; one missed while the PC was off is reported as late.',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        tagline: 'Windows toasts, folded in',
        glyph: '◔',
        summary: 'Windows notifications are read through the notification listener and folded into the report.',
      },
    ],
  },
  {
    id: 'screen',
    label: 'Screen sight',
    tagline: 'Looks only when asked',
    glyph: '◉',
    angle: 196,
    summary:
      '"Look at this" or "what’s this error" takes one screenshot of the focused window and sends it to the ' +
      'same multimodal model. The image is never written to disk or memory; only her answer stays in the ' +
      'chat. Whatever the screen says is data, never instructions to her.',
    stats: [
      { value: '10 / 10', label: '"look at this" picks the tool' },
      { value: '0', label: 'screenshots stored' },
    ],
    stack: ['qwen3.5 vision', 'Win32 capture'],
  },
  {
    id: 'safety',
    label: 'Safety',
    tagline: 'Nothing changes without a yes',
    glyph: '⛨',
    angle: 229,
    summary:
      'She can read the screen, mail and files, which makes prompt injection the real threat. So the rules ' +
      'are structural rather than polite requests to the model.',
    stats: [{ value: '0 / 6', label: 'injections caused a side effect' }],
    children: [
      {
        id: 'gate',
        label: 'Confirmation gate',
        tagline: 'Shown first, then a yes',
        glyph: '⊘',
        summary:
          'Every side-effect tool shows exactly what it will do and waits for a click or a spoken yes. Sixty ' +
          'seconds without an answer counts as no, and a unit test checks that every tool in the registry ' +
          'goes through the gate.',
      },
      {
        id: 'untrusted',
        label: 'Untrusted content',
        tagline: 'Data, never instructions',
        glyph: '⚠',
        summary:
          'Screen text, mail bodies, notifications, files and web pages are marked as content in the prompt, ' +
          'and any tool proposed right after reading them needs confirmation, even a read-only one that ' +
          'would send data out.',
      },
      {
        id: 'secrets',
        label: 'Secrets & logs',
        tagline: 'Nothing sensitive on disk',
        glyph: '⚿',
        summary:
          'Google tokens live in Windows Credential Manager, never in files. Logs hold no audio, screenshots ' +
          'or mail bodies; untrusted tool results are logged as a character count only. Only the read-only ' +
          'Google APIs, searches I ask for and model downloads leave the machine.',
      },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    tagline: 'Four models in 8 GB of GPU memory',
    glyph: '▥',
    angle: 262,
    summary:
      'The language model, speech recognition, the voice and the character share one 8 GB laptop GPU that ' +
      'also drives the main monitor. A small manager loads and unloads models so she fits next to whatever ' +
      'else is running.',
    flow: [
      'Active: everything is loaded while we talk.',
      'Idle: two quiet minutes and the language model unloads.',
      'Gaming: a fullscreen app hides her and unloads everything; push-to-talk still works.',
      'Before loading, she checks free GPU memory and warns rather than spilling into system RAM.',
    ],
    stats: [
      { value: '7.4 / 8.2 GB', label: 'peak GPU memory' },
      { value: '0.3 s', label: 'to free it for a game' },
    ],
    stack: ['NVML', 'Ollama keep-alive'],
  },
  {
    id: 'processes',
    label: 'Processes',
    tagline: 'Four processes, one local socket',
    glyph: '⇄',
    angle: 295,
    summary:
      'The overlay, the agent, the voice and Ollama run as separate processes, so a crash in one never takes ' +
      'down the others; the agent restarts any that exit. They talk over a loopback WebSocket using a small ' +
      'typed JSON protocol (mood, bubble, confirm, transcript, speak, a 60 Hz lip level…). The port and a ' +
      'per-run token are written to a user-only file; a client without the token is dropped.',
    stats: [
      { value: '4', label: 'processes' },
      { value: 'v4', label: 'protocol' },
    ],
    stack: ['WebSocket', 'pydantic', 'uv workspaces'],
  },
  {
    id: 'next',
    label: 'Next',
    tagline: 'Where she goes after version 1',
    glyph: '→',
    angle: 327,
    summary:
      'Version 1 is about a companion that is fast, honest and safe. The next steps are about doing more ' +
      'per request, informed by research on where AI agents actually save time: handing off whole ' +
      'workflows, interrupting only at natural breaks, and results that are cheap to check.',
    children: [
      { id: 'workflows', label: 'Saved workflows', tagline: 'One request, many steps', glyph: '⋯', summary: '"Start my study session": open apps, arrange windows, start a timer and hold notifications, with one confirmation for the lot.' },
      { id: 'focus', label: 'Focus guardian', tagline: 'Interrupt at the breaks', glyph: '◐', summary: 'Batch non-urgent notifications during focus time and deliver them when I switch tasks.' },
      { id: 'mcp', label: 'MCP client', tagline: 'Borrow tools, don’t write them', glyph: '⧉', summary: 'Use existing Model Context Protocol servers instead of hand-writing every tool, now that tool selection keeps the prompt small.' },
      { id: 'wake', label: 'Wake word', tagline: '"Raphael"', glyph: '◌', summary: '"Raphael" instead of a hotkey: opt-in and fully local.' },
    ],
  },
];

/** The chips orbiting her in the hero; each opens its node. */
export const capabilities = [
  { id: 'hearing', label: 'Hearing', short: 'Hearing', glyph: '◎' },
  { id: 'voice', label: 'Her own voice', short: 'Voice', glyph: '∿' },
  { id: 'memory', label: 'Long-term memory', short: 'Memory', glyph: '❖' },
  { id: 'tools', label: 'Desktop tools', short: 'Tools', glyph: '⚙' },
  { id: 'briefings', label: 'Briefings', short: 'Briefings', glyph: '✉' },
  { id: 'screen', label: 'Screen sight', short: 'Screen', glyph: '◉' },
  { id: 'body', label: 'Two forms', short: 'Forms', glyph: '☺' },
] as const;

export const roots: ChibiNode[] = [core, ...nodes];

/** The node at `path` (ids from the top, e.g. ['voice', 'cloned']), or null. */
export function nodeAt(path: string[]): ChibiNode | null {
  let level = roots;
  let found: ChibiNode | null = null;
  for (const id of path) {
    found = level.find((n) => n.id === id) ?? null;
    if (!found) return null;
    level = found.children ?? [];
  }
  return found;
}

/** Every node's path, depth first: deep-link anchors and the deep dive. */
export function allPaths(): string[][] {
  const out: string[][] = [];
  const walk = (list: ChibiNode[], prefix: string[]) => {
    for (const n of list) {
      out.push([...prefix, n.id]);
      if (n.children) walk(n.children, [...prefix, n.id]);
    }
  };
  walk(roots, []);
  return out;
}

export const pathToHash = (path: string[]) => path.join('/');
export const hashToPath = (hash: string) => hash.replace(/^#/, '').split('/').filter(Boolean);
