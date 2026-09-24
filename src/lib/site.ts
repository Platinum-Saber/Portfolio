export const site = {
  name: 'Sansika Waduge',
  fullName: 'Sansika Suhan Waduge',
  // The canonical origin: sitemap, robots.txt, canonical links and the
  // absolute OpenGraph image URLs are all built from this. Bought 2026-09-24,
  // on Cloudflare (docs/DEPLOY-CLOUDFLARE.md). It used to be a pinned Vercel
  // deployment URL, which kept pointing previews at Vercel after the move.
  url: 'https://sansikawaduge.dev',
  title: 'Sansika Waduge',
  tagline: 'Robotics and embedded systems engineer',
  description:
    'Undergraduate engineer at the University of Moratuwa building autonomous robots, multi-robot SLAM systems, and FPGA hardware. ROS 2, Jetson, Verilog/VHDL, C++ and Python.',
  location: 'Colombo, Sri Lanka',
  // Console card fields - Phase 8.2. A field with no value renders no row at
  // all, so anything unknown stays null rather than becoming a plausible guess.
  // Wording taken from the CV: 'BSc. Eng. in Computer Science and Engineering,
  // University of Moratuwa, Aug 2022 – Present'. No '(Hons)' and no expected
  // graduation year, because the CV states neither - add the year here when
  // it is certain.
  education: 'BSc Eng, Computer Science & Engineering · Univ. of Moratuwa',
  // Delete this the day it stops being true. A stale availability line is
  // worse than none.
  availability: 'Open to graduate roles and internships',
  // The professional address, and the one printed on the CV. The personal
  // address (sansikasuhan5@) is deliberately not on the site: one public
  // contact point, and it matches the document a recruiter is holding.
  email: 'sansikawaduge@gmail.com',
  socials: {
    github: 'https://github.com/Platinum-Saber',
    linkedin: 'https://www.linkedin.com/in/sansika-waduge/',
  },
  cv: '/suhan-waduge-cv.pdf',
};

export const nav = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  // The simulation is one of the site's two views, so it is reachable from
  // every page rather than only from the end of the home sequence.
  // `heavy: true` turns OFF Next's link prefetch for it - see Nav.tsx.
  { href: '/explore', label: 'Explore', heavy: true },
] as const;
