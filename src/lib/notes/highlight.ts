import { createHighlighterCore, type HighlighterCore, type ShikiTransformer } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

/**
 * VS Code syntax highlighting for the guides (Dark+ / Light+, the same
 * TextMate grammars VS Code uses). Runs on the server at build time - the
 * notes pages are prerendered, so no highlighter ships to the browser.
 *
 * Fine-grained imports (shiki/core + the JS regex engine + only the grammars
 * we use) keep the Worker bundle small: no WASM, no 200-language bundle.
 */

let instance: Promise<HighlighterCore> | null = null;

export function getHighlighter(): Promise<HighlighterCore> {
  instance ??= createHighlighterCore({
    themes: [import('@shikijs/themes/dark-plus'), import('@shikijs/themes/light-plus')],
    langs: [
      import('@shikijs/langs/c'),
      import('@shikijs/langs/shellscript'),
    ],
    engine: createJavaScriptRegexEngine(),
  });
  return instance;
}

export const THEMES = { light: 'light-plus', dark: 'dark-plus' } as const;
// Add a grammar here (and to KNOWN) only when a guide needs it: each one ships in the Worker.
const KNOWN = new Set(['c', 'shellscript', 'bash', 'sh']);

/** Tag the <pre> with its language, for the editor tab label. */
export const langTag: ShikiTransformer = {
  pre(node) {
    node.properties['data-lang'] = this.options.lang;
  },
};

export function langOf(lang: string | undefined): string {
  const l = (lang ?? '').toLowerCase();
  if (l === 'h') return 'c';
  return KNOWN.has(l) ? l : 'text';
}

export async function highlight(code: string, lang = 'c'): Promise<string> {
  const hl = await getHighlighter();
  return hl.codeToHtml(code, {
    lang: langOf(lang),
    themes: THEMES,
    defaultColor: false,
    transformers: [langTag],
  });
}

/** Options for @shikijs/rehype in the MDX pipeline (fenced code blocks). */
export const rehypeShikiOptions = {
  themes: THEMES,
  defaultColor: false as const,
  defaultLanguage: 'text',
  fallbackLanguage: 'text',
  transformers: [langTag],
};
