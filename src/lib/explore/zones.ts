/**
 * The content of the explorable world.
 *
 * Zones are derived from the same MDX frontmatter the ordinary project pages
 * read, so the game cannot drift out of sync with the site. Add a project and a
 * zone appears; edit a summary and the world updates. There is deliberately no
 * second copy of this text anywhere.
 *
 * Positions are hand-placed rather than generated. A ring of evenly spaced
 * markers reads as a menu laid out in a circle; varying the distance and the
 * altitude makes it feel like somewhere rather than something.
 */

export type Zone = {
  id: string;
  kind: 'about' | 'skills' | 'contact' | 'project';
  title: string;
  /** Category line on the panel - a domain, so several zones may share one. */
  short: string;
  /** Unique, short, for the jump list. Three projects share the domain
   *  "Robotics", so the list cannot be built from `short`. */
  label: string;
  /** Paragraphs revealed on arrival. */
  body: string[];
  /** Small facts rendered as a monospace list - stack, year, that sort of thing. */
  tags?: string[];
  href?: string;
  /** World position. y is the altitude the marker floats at. */
  position: [number, number, number];
};

export const WORLD_HALF = 60;
/** Fly within this of a marker's centre and it opens. */
export const ZONE_RADIUS = 7;

type ProjectSeed = {
  slug: string;
  title: string;
  summary: string;
  year: string;
  stack: string[];
  domain: string;
};

/**
 * Where each project's marker sits. Keyed by slug so the arrangement is stable
 * as projects are reordered, and so a new project fails visibly - it lands at
 * the fallback position rather than silently overlapping an existing marker.
 */
const PROJECT_SITES: Record<string, [number, number, number]> = {
  'autonomous-drone-platform': [0, 11, -46],
  'ascilam-collaborative-slam': [-40, 6, -24],
  'fpga-sobel-edge-detection': [40, 8, -24],
  'nano-processor-vhdl': [44, 4, 20],
  'market-data-backend': [-44, 9, 20],
  'kobuki-webots-robotics': [0, 5, 44],
  'robokeeper-goalkeeper-robot': [-24, 7, -44],
  'nutri-mithu': [26, 12, -42],
  'medibox-smart-pill-box': [20, 5, 40],
  'acl-procurement-intelligence': [-24, 10, 40],
  'core-banking-database': [-46, 6, -2],
};

const FALLBACK_SITE: [number, number, number] = [18, 14, 34];

/**
 * Short names for the jump list. Full titles are too long for a row of
 * buttons, and domains are not unique. Kept beside the positions because both
 * are hand-maintained facts about the world rather than content.
 */
const PROJECT_LABELS: Record<string, string> = {
  'autonomous-drone-platform': 'Drone platform',
  'ascilam-collaborative-slam': 'ASCILAM',
  'fpga-sobel-edge-detection': 'FPGA Sobel',
  'nano-processor-vhdl': 'Nano processor',
  'market-data-backend': 'Market data',
  'kobuki-webots-robotics': 'RoboGames',
  'robokeeper-goalkeeper-robot': 'RoboKeeper',
  'nutri-mithu': 'Nutri-Mithu',
  'medibox-smart-pill-box': 'MediBox',
  'acl-procurement-intelligence': 'ACL dashboard',
  'core-banking-database': 'Banking DB',
};

export function buildZones(
  projects: ProjectSeed[],
  personal: {
    fullName: string;
    location: string;
    email: string;
    tagline: string;
  },
  skills: ReadonlyArray<{ group: string; items: readonly string[] }>,
): Zone[] {
  const zones: Zone[] = [
    {
      id: 'about',
      kind: 'about',
      title: 'Who this is',
      short: 'About',
      label: 'About',
      body: [
        `${personal.fullName} - ${personal.tagline.toLowerCase()}, based in ${personal.location}.`,
        'Engineering undergraduate at the University of Moratuwa. I start at the hardware - Verilog and VHDL on FPGAs, firmware on ESP32s - and build robots and software on top of it.',
        'Working both sides has made me suspicious of abstractions I have not looked underneath at least once.',
      ],
      href: '/about',
      position: [0, 6, -14],
    },
    {
      id: 'skills',
      kind: 'skills',
      title: 'Tools I reach for',
      short: 'Skills',
      label: 'Skills',
      body: skills.map((group) => `${group.group}: ${group.items.join(', ')}.`),
      tags: skills.flatMap((group) => group.items).slice(0, 12),
      href: '/about',
      position: [22, 9, 16],
    },
    {
      id: 'contact',
      kind: 'contact',
      title: 'Get in touch',
      short: 'Contact',
      label: 'Contact',
      body: [
        'Open to graduate roles, internships and research collaborations in embedded systems and robotics.',
        `Email reaches me fastest: ${personal.email}.`,
      ],
      href: '/contact',
      position: [-22, 4, 16],
    },
  ];

  for (const project of projects) {
    zones.push({
      id: project.slug,
      kind: 'project',
      title: project.title,
      short: project.domain,
      label: PROJECT_LABELS[project.slug] ?? project.title,
      body: [project.summary],
      tags: [project.year, ...project.stack.slice(0, 5)],
      href: `/projects/${project.slug}`,
      position: PROJECT_SITES[project.slug] ?? FALLBACK_SITE,
    });
  }

  return zones;
}
