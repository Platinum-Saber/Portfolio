export const site = {
  name: 'Suhan Waduge',
  fullName: 'Sansika Suhan Waduge',
  // TODO(phase-6): replace with the custom domain once purchased.
  url: 'https://portfolio-lake-delta-0qhmdtfj5a.vercel.app',
  title: 'Suhan Waduge — Robotics & Embedded Systems',
  tagline: 'Robotics and embedded systems engineer',
  description:
    'Undergraduate engineer at the University of Moratuwa building autonomous robots, multi-robot SLAM systems, and FPGA hardware. ROS 2, Jetson, Verilog/VHDL, C++ and Python.',
  location: 'Colombo, Sri Lanka',
  // Console card fields — Phase 8.2. A field with no value renders no row at
  // all, so anything unknown stays null rather than becoming a plausible guess.
  // Wording taken from the CV: 'BSc. Eng. in Computer Science and Engineering,
  // University of Moratuwa, Aug 2022 – Present'. No '(Hons)' and no expected
  // graduation year, because the CV states neither — add the year here when
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
] as const;
