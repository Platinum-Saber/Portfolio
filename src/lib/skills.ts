/**
 * The skills list, extracted from the About page so that page and the explore
 * world read from one array. Two copies of this would have diverged the first
 * time a tool was added.
 */
export const SKILL_GROUPS = [
  {
    group: 'Robotics',
    items: [
      'ROS 2',
      'SLAM (Cartographer, GMapping)',
      'EKF sensor fusion',
      'RPLiDAR',
      'RGB-D perception',
      'Webots',
    ],
  },
  {
    group: 'Embedded & hardware',
    items: [
      'Verilog',
      'VHDL',
      'Vivado',
      'Basys 3 / Artix-7',
      'Raspberry Pi',
      'Jetson Orin Nano',
      'ESP32',
      'Arduino',
    ],
  },
  {
    group: 'Software',
    items: [
      'C++',
      'Python',
      'Java / Spring Boot',
      'OpenCV',
      'Redis / Lua',
      'Apache Kafka',
      'Linux',
    ],
  },
] as const;
