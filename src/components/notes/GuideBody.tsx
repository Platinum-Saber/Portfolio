import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { getHighlighter, rehypeShikiOptions } from '@/lib/notes/highlight';
import { guideComponents, Pre } from './mdx';

/** A guide or course part, rendered on the server (so its text stays in the gated payload). */
export async function GuideBody({ source }: { source: string }) {
  const hl = await getHighlighter();
  return (
    <MDXRemote
      source={source}
      components={guideComponents}
      options={{
        mdxOptions: {
          // GFM: tables (and strikethrough, task lists). Without it MDX prints a
          // pipe table as one paragraph of raw text.
          remarkPlugins: [remarkGfm, remarkMath],
          rehypePlugins: [
            [rehypeKatex, { output: 'html', strict: false }],
            [rehypeShikiFromHighlighter, hl, rehypeShikiOptions],
          ],
        },
      }}
    />
  );
}

/** Markdown fragments (mock-paper prompts, options, explanations): no components. */
export async function Md({ source }: { source: string }) {
  const hl = await getHighlighter();
  return (
    <MDXRemote
      source={source}
      components={{ pre: Pre }}
      options={{
        mdxOptions: {
          format: 'md',
          remarkPlugins: [remarkGfm, remarkMath],
          rehypePlugins: [
            [rehypeKatex, { output: 'html', strict: false }],
            [rehypeShikiFromHighlighter, hl, rehypeShikiOptions],
          ],
        },
      }}
    />
  );
}
