/**
 * Work experience — one source for `/about` and anything else that lists it.
 *
 * Written for a reader who has never worked in finance. Company-internal
 * system names, topic names and architecture specifics are deliberately left
 * out: the internship's work belongs to the company, and a portfolio only
 * needs to show what kind of problem was solved and with which tools. Every
 * line here is checkable against the CS3993 industrial training report.
 */
export type WorkItem = { title: string; body: string };

export type Experience = {
  role: string;
  company: string;
  team: string;
  location: string;
  period: string;
  summary: string;
  work: WorkItem[];
  stack: string[];
  /** Case study with more detail, if one exists. */
  caseStudy?: string;
};

export const EXPERIENCE: Experience[] = [
  {
    role: 'Intern Software Engineer',
    company: 'GTN Technologies',
    team: 'Market Backend team',
    location: 'Colombo, Sri Lanka',
    period: 'Nov 2025 – May 2026',
    summary:
      'Six months on the backend team behind a global trading and investment platform — the systems that take live prices from stock exchanges around the world and deliver them to trading apps.',
    work: [
      {
        title: 'Testing tool for live price feeds',
        body: 'A full-stack web app that lets QA engineers and developers run scripted checks against the real-time price connection client apps use — logging in, subscribing, and confirming each kind of message arrives correctly. Test runs are queued per user, configured from YAML profiles and archived to cloud storage for later review.',
      },
      {
        title: 'Shared data-quality library and monitoring dashboards',
        body: 'A reusable Java library that decides whether market data is healthy — which exchanges should be open right now, and which prices have gone stale — packaged so several monitoring tools could share one set of rules instead of each keeping its own. Integrated it into two dashboards, adding live market status, secured login and a history of past checks.',
      },
      {
        title: 'Real-time trading statistics service',
        body: 'A backend service that keeps a running average trade price for thousands of stocks, updated the moment each trade happens. Benchmarked competing designs on the most-traded symbols before choosing one, connected it to the existing data platform over a message queue, and built the tooling that checked its output figure-for-figure against the system it was replacing.',
      },
    ],
    stack: [
      'Java',
      'Spring Boot',
      'Apache Kafka',
      'Redis / Lua',
      'PostgreSQL',
      'WebSocket / STOMP',
      'React',
      'Spring Security / JWT',
      'AWS S3',
      'Docker',
      'JUnit',
      'Python · pandas',
    ],
    caseStudy: '/projects/market-data-backend',
  },
];
