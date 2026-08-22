/**
 * The component data behind the /lab airframe explorer.
 *
 * This is the single source of truth for both the 3D scene and the static
 * HTML fallback. The fallback renders every field below as real text, so the
 * page is complete and indexable with WebGL disabled — the canvas is an
 * enhancement, never the content.
 *
 * `position` is in scene units (metres, roughly to scale).
 */

export type BuildStatus = 'on-hand' | 'designed' | 'sourcing' | 'undecided';

export type Spec = { label: string; value: string };

export type DroneComponent = {
  id: string;
  name: string;
  short: string;
  category: string;
  /** The component's actual location in the scene. */
  position: [number, number, number];
  /**
   * Where the numbered marker sits — pushed clear of the airframe so markers
   * don't pile on top of each other, with a leader line back to `position`.
   */
  marker: [number, number, number];
  specs: Spec[];
  /** Plain-language data/power links to other component ids or external things. */
  connections: string[];
  status: BuildStatus;
  statusNote: string;
};

export const STATUS_LABEL: Record<BuildStatus, string> = {
  'on-hand': 'On hand',
  designed: 'Designed',
  sourcing: 'Sourcing',
  undecided: 'Undecided',
};

export const DRONE_COMPONENTS: DroneComponent[] = [
  {
    id: 'compute',
    name: 'NVIDIA Jetson Orin Nano 8GB',
    short: 'Onboard compute',
    category: 'Compute',
    position: [0, 0.055, -0.02],
    marker: [0.0, 0.2, -0.16],
    specs: [
      { label: 'AI performance', value: 'Up to 67 TOPS' },
      { label: 'GPU', value: '1024-core Ampere, 32 Tensor Cores' },
      { label: 'CPU', value: '6-core Arm Cortex-A78AE' },
      { label: 'Memory', value: '8 GB 128-bit LPDDR5' },
      { label: 'Power', value: '7–25 W configurable' },
    ],
    connections: [
      'Depth camera over USB 3.0 — the perception loop closes here, onboard',
      'Flight controller over UART, publishing setpoints',
      'Powered from the 5 V regulated rail, not the raw battery',
    ],
    status: 'on-hand',
    statusNote:
      'Already owned. This is the pivot point of the whole design — enough compute to run depth processing and navigation onboard, which means the aircraft does not depend on a radio link to stay alive.',
  },
  {
    id: 'depth-camera',
    name: 'Orbbec Gemini 336',
    short: 'Stereo depth camera',
    category: 'Perception',
    position: [0, 0.02, 0.115],
    marker: [0.0, 0.1, 0.32],
    specs: [
      { label: 'Depth range', value: '0.10–20 m (optimal 0.26–3 m)' },
      { label: 'Depth stream', value: 'Up to 1280×800 @ 30 fps' },
      { label: 'RGB stream', value: 'Up to 1920×1080 @ 30 fps' },
      { label: 'Depth FOV', value: 'H 90° × V 65°' },
      { label: 'Interface', value: 'USB 3.0 Type-C' },
      { label: 'Mass', value: '99 g' },
    ],
    connections: [
      'USB 3.0 to the Orin Nano — depth and RGB both land on the compute module',
      'Rigidly mounted to the forward frame so the camera-to-body transform stays fixed',
    ],
    status: 'on-hand',
    statusNote:
      'Already owned. Stereo rather than structured light, which is what makes it usable outdoors as well as indoors.',
  },
  {
    id: 'frame',
    name: 'Laser-cut carbon fibre airframe',
    short: 'Primary structure',
    category: 'Structure',
    position: [0.09, 0.0, -0.09],
    marker: [0.26, -0.1, -0.26],
    specs: [
      { label: 'Material', value: 'Carbon fibre sheet, laser cut' },
      { label: 'Configuration', value: 'X quadrotor' },
      {
        label: 'Non-structural parts',
        value: '3D printed mounts and brackets',
      },
    ],
    connections: [
      'Carries every other component — the mass budget here arbitrates the whole design',
      'Stiffness directly sets the vibration floor the state estimator has to live with',
    ],
    status: 'designed',
    statusNote:
      'Design settled, not yet cut. A 3D-printed frame was the original plan and was rejected: for the stiffness required it came out both too heavy and too weak against carbon fibre. 3D printing kept only for non-structural mounts, where its geometric freedom actually pays.',
  },
  {
    id: 'motors',
    name: 'AIR 2216 / KV920 × 4',
    short: 'Propulsion',
    category: 'Propulsion',
    position: [0.155, 0.015, 0.155],
    marker: [0.3, 0.14, 0.3],
    specs: [
      { label: 'KV rating', value: '920 KV' },
      { label: 'Stator', value: '2216' },
      { label: 'Quantity', value: '4' },
    ],
    connections: [
      'Each motor driven by its own ESC from the raw battery rail',
      'ESC signal lines run back to the flight controller',
    ],
    status: 'sourcing',
    statusNote:
      'One motor on hand; the remaining three still to source. Sizing is being worked against the mass budget the carbon frame and the Orin Nano impose — this is the current open work.',
  },
  {
    id: 'power',
    name: 'Battery and power distribution',
    short: 'Power',
    category: 'Power',
    position: [0, -0.035, 0.0],
    marker: [-0.3, -0.17, -0.04],
    specs: [
      { label: 'Chemistry', value: 'LiPo' },
      { label: 'Capacity', value: 'To be set by the flight-time target' },
      { label: 'Rails', value: 'Raw pack to ESCs, regulated 5 V to compute' },
    ],
    connections: [
      'Raw pack voltage to the four ESCs',
      'Regulated 5 V rail to the Orin Nano and flight controller',
      'Pack mass is the largest single line in the mass budget after the frame',
    ],
    status: 'undecided',
    statusNote:
      'Not yet specified. Capacity is a direct trade against endurance and all-up mass, and it cannot be settled until propulsion sizing lands.',
  },
  {
    id: 'flight-controller',
    name: 'Flight controller',
    short: 'Low-level control',
    category: 'Control',
    position: [0, 0.012, -0.075],
    marker: [-0.24, 0.16, -0.26],
    specs: [
      { label: 'Firmware', value: 'PX4 (planned)' },
      { label: 'Role', value: 'Attitude and rate control' },
      { label: 'Sensors', value: 'IMU, barometer' },
    ],
    connections: [
      'Receives setpoints from the Orin Nano over UART',
      'Drives the four ESCs directly',
      'Runs the fast inner loop the companion computer deliberately stays out of',
    ],
    status: 'undecided',
    statusNote:
      'Board not yet chosen. PX4 is the intended firmware, which keeps the ROS 2 bridging path standard.',
  },
];

export function getComponent(id: string): DroneComponent | undefined {
  return DRONE_COMPONENTS.find((c) => c.id === id);
}
