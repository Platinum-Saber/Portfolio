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
  email: 'sansikasuhan5@gmail.com',
  socials: {
    github: 'https://github.com/Platinum-Saber',
    // TODO(phase-1): set your LinkedIn URL. Left null so no broken link ships.
    linkedin: null as string | null,
  },
  // TODO(phase-1): drop the PDF at public/suhan-waduge-cv.pdf, then set this
  // to '/suhan-waduge-cv.pdf'. Null until then so the site has no dead link.
  cv: null as string | null,
};

export const nav = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;
