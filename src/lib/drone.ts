/**
 * The component data behind the /lab airframe explorer.
 *
 * This is the single source of truth for both the 3D scene and the static
 * HTML fallback. The fallback renders every field below as real text, so the
 * page is complete and indexable with WebGL disabled - the canvas is an
 * enhancement, never the content.
 *
 * `position` is in metres, measured from the CAD (fyp-drone.glb at scale 1,
 * nose on +Z, centred on its bounding box - see AirframeModel.tsx). Each is
 * the centre of the named part's geometry, so the anchor dot sits on the real
 * component. Re-measure if the CAD changes.
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
   * Where the numbered marker sits - pushed clear of the airframe so markers
   * don't pile on top of each other, with a leader line back to `position`.
   */
  marker: [number, number, number];
  /**
   * Where the camera goes when this is selected, for a component that is not
   * one compact thing - the frame and the four motors span the whole craft,
   * so flying in to one arm or one motor would show a fragment. Without it,
   * the camera closes on `position`.
   */
  focus?: { target: [number, number, number]; distance: number };
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
    position: [0, 0.0256, 0.019],
    marker: [0.0, 0.17, 0.04],
    specs: [
      { label: 'AI performance', value: 'Up to 67 TOPS' },
      { label: 'GPU', value: '1024-core Ampere, 32 Tensor Cores' },
      { label: 'CPU', value: '6-core Arm Cortex-A78AE' },
      { label: 'Memory', value: '8 GB 128-bit LPDDR5' },
      { label: 'Power', value: '7–25 W configurable' },
    ],
    connections: [
      'Depth camera over USB 3.0 - the perception loop closes here, onboard',
      'Flight controller over UART, publishing setpoints',
      'Powered from the 5 V regulated rail, not the raw battery',
    ],
    status: 'on-hand',
    statusNote:
      'Already owned. This is the pivot point of the whole design - enough compute to run depth processing and navigation onboard, which means the aircraft does not depend on a radio link to stay alive.',
  },
  {
    id: 'depth-camera',
    name: 'Orbbec Gemini 336',
    short: 'Stereo depth camera',
    category: 'Perception',
    position: [0, 0.0056, 0.0915],
    marker: [0.0, 0.09, 0.26],
    specs: [
      { label: 'Depth range', value: '0.10–20 m (optimal 0.26–3 m)' },
      { label: 'Depth stream', value: 'Up to 1280×800 @ 30 fps' },
      { label: 'RGB stream', value: 'Up to 1920×1080 @ 30 fps' },
      { label: 'Depth FOV', value: 'H 90° × V 65°' },
      { label: 'Interface', value: 'USB 3.0 Type-C' },
      { label: 'Mass', value: '99 g' },
    ],
    connections: [
      'USB 3.0 to the Orin Nano - depth and RGB both land on the compute module',
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
    position: [0.055, 0.0086, -0.0535],
    marker: [0.22, -0.09, -0.2],
    focus: { target: [0, -0.01, 0], distance: 0.62 },
    specs: [
      { label: 'Material', value: 'Carbon fibre sheet, laser cut' },
      { label: 'Configuration', value: 'X quadrotor, ducted' },
      { label: 'Motor spacing', value: '172 × 141 mm (222 mm diagonal)' },
      { label: 'Overall', value: '331 × 289 mm across the ducts' },
      {
        label: 'Non-structural parts',
        value: '3D-printed Nylon 12 prop ducts, mounts and brackets',
      },
    ],
    connections: [
      'Carries every other component - the mass budget here arbitrates the whole design',
      'Stiffness directly sets the vibration floor the state estimator has to live with',
    ],
    status: 'designed',
    statusNote:
      'Design settled, not yet cut. A 3D-printed frame was the original plan and was rejected: for the stiffness required it came out both too heavy and too weak against carbon fibre. 3D printing kept only for non-structural parts - the prop ducts, mounts and brackets - where its geometric freedom actually pays.',
  },
  {
    id: 'motors',
    name: '2205 motors × 4',
    short: 'Propulsion',
    category: 'Propulsion',
    position: [0.086, -0.0114, 0.0705],
    marker: [0.22, 0.11, 0.2],
    focus: { target: [0, -0.015, 0], distance: 0.55 },
    specs: [
      { label: 'Stator', value: '2205' },
      { label: 'Shortlisted', value: 'Readytosky RS2205 2300 KV' },
      { label: 'Props', value: '5 in (127 mm), three-blade, in ducts' },
      { label: 'Quantity', value: '4' },
    ],
    connections: [
      'Each motor driven by its own ESC from the raw battery rail',
      'ESC signal lines run back to the flight controller',
    ],
    status: 'sourcing',
    statusNote:
      'Sized in the CAD: 2205 motors on 5 in props, inside printed ducts, against the mass budget the carbon frame and the Orin Nano impose. Still to source.',
  },
  {
    id: 'power',
    name: 'Battery and power distribution',
    short: 'Power',
    category: 'Power',
    position: [-0.0025, 0.0336, -0.0765],
    marker: [-0.2, 0.14, -0.2],
    specs: [
      { label: 'Chemistry', value: 'LiPo' },
      { label: 'Pack envelope', value: '102 × 34 × 33 mm, top-mounted, aft' },
      { label: 'Capacity', value: 'To be set by the flight-time target' },
      { label: 'Rails', value: 'Raw pack to ESCs, regulated 5 V to compute' },
    ],
    connections: [
      'Raw pack voltage to the four ESCs',
      'Regulated 5 V rail to the Orin Nano and flight controller',
      'Pack mass is the largest single line in the mass budget after the frame',
    ],
    status: 'designed',
    statusNote:
      'Pack size and placement are fixed in the CAD. Capacity is still open - a direct trade against endurance and all-up mass.',
  },
  {
    id: 'flight-controller',
    name: 'Flight controller',
    short: 'Low-level control',
    category: 'Control',
    position: [0, -0.0244, -0.0015],
    marker: [-0.22, -0.11, 0.08],
    specs: [
      { label: 'Firmware', value: 'PX4 (planned)' },
      { label: 'Role', value: 'Attitude and rate control' },
      { label: 'Sensors', value: 'IMU, barometer' },
      { label: 'Footprint', value: '30 × 30 mm, under the bottom plate' },
    ],
    connections: [
      'Receives setpoints from the Orin Nano over UART',
      'Drives the four ESCs directly',
      'Runs the fast inner loop the companion computer deliberately stays out of',
    ],
    status: 'undecided',
    statusNote:
      'Board not yet chosen; the CAD reserves a 30 × 30 mm stack for it. PX4 is the intended firmware, which keeps the ROS 2 bridging path standard.',
  },
];

export function getComponent(id: string): DroneComponent | undefined {
  return DRONE_COMPONENTS.find((c) => c.id === id);
}
