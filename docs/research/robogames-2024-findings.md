# IESL RoboGames 2024 — Team Sentinels (findings)

Research notes behind the portfolio's Kobuki & Webots project page. Compiled 2026-09-26.

## The competition

- **Name:** IESL RoboGames 2024 (the "2024" edition ran from January to about April 2025).
- **Organisers:** Institution of Engineers Sri Lanka (IESL), with the Department of Computer Science & Engineering, University of Moratuwa; sponsored by SLT-MOBITEL.
- **Categories:** School, University, Open. Sentinels competed in **University**.
- **Workshops run for participants:** "Mastering Webots", "Kobuki Robots In Motion", plus testing and troubleshooting sessions.
- **Overall winners (from press coverage):** University — AutoNova (University of Moratuwa); School — GOAT 12000 (Elizabeth Moir Senior School); Open — OG Nemesis.

## Rounds (University category)

| # | Official name | Platform | Task | Submission window |
|---|---|---|---|---|
| 1 | Completion round | Webots, **e-puck** | Build a 2.5 m × 2.5 m maze to spec (0.25 m wall pitch, 0.1 m walls) and have the robot visit coloured walls in order **Red → Yellow → Pink → Brown → Green** from any start position, then stop. Any team that completed it advanced. | 6–18 Jan 2025 |
| 2 | Elimination round | Webots, **robot built from scratch** (no pre-built robots; ≤ 0.25 m cube) | "The faculty is on fire": a 5 m × 5 m maze with three fire pits (red / orange / yellow zones, 40 / 10 / 0 damage) and three survivors (green squares, +20 each). A dry run was allowed for mapping; the robot then had to rescue each survivor by sitting in its cell for 3 s and return to the entrance. Start at 100 marks; ties broken on time, then code review. No seeing over walls. | 6–14 Feb 2025 |
| 3 | Final | Real hardware: **Kobuki** base, **Kinect** camera, **Raspberry Pi 5** | Physical task on the arena (see below). | Final held around early April 2025 |

## Sentinels' results

- **Round 1:** passed — Sentinels (University of Moratuwa) is on the official list of 29 university teams that completed the preliminary/completion round.
- **Round 2:** passed — Sentinels is one of the **12 university teams** on the official "Winners in University Category of Elimination Round" list, i.e. the finalists.
- **Final:** competed in the hardware final as a **finalist**. No placing is recorded publicly; the category was won by AutoNova.

The 12 university finalists: MetaMind (Peradeniya), Botzilla, RoboCrew, Quanta, BB-Alr-8, Team JASPREN, Starscream (all Moratuwa), NET (Kelaniya), AutoNova, ElectroBots (Moratuwa), Psyco Seekers (Peradeniya), **Sentinels (Moratuwa)**.

## What our final-round code does (from `Platinum-Saber/robo_games`, `kobuki/`)

*The official final-round brief was not found online, so this part is read from the team's own code rather than from the rules.*

- **Task, as the code implements it:** find coloured cubes (red, yellow, green, blue), capture each between flaps on the front of the robot, find the floor tile of the matching colour, push the cube onto it, back off and go for the next colour.
- **Perception:** OpenCV on the Kinect's RGB stream — HSV thresholds per colour (red uses two hue bands because it wraps around 0°), contours over 500 px², and a shape rule to tell objects apart: roughly square bounding box = cube, wide rectangle in the lower part of the frame = tile. `colour_calib.py` tunes the HSV ranges on site.
- **Control:** a five-state machine — search box → approach → search tile → push → retreat. Centre the target within ±50 px by turning in small steps, creep forward until its pixel width says it is within the flaps. A colour not found within 20 s is deferred and retried after the others; pushes are capped at 10 steps so the robot cannot push forever.
- **Driving the Kobuki:** no ROS — the Pi writes raw Kobuki serial packets (`0xAA 0x55` header, base-control payload) straight to `/dev/ttyUSB0` at 115200 baud.
- **Webots side of the repo:** `WeBots_02/` holds a sandbox world with a custom robot (Jan 2025) and a small script that generates maze walls from a 4-bit-per-cell wall matrix. The round 1 and round 2 controllers are not in the repo.
- **Commit dates:** Webots, 16 Jan 2025; Kobuki code, 4 Apr 2025.

## Team

- Sentinels: Suhan Waduge, Himeth Walgampaya, Pulasthi Udugamasooriya. All three contributed equally, so the page doesn't split out who did what.

## Media on the page

- `public/video/robogames-round1.mp4`: round 1 e-puck run, 13 min 02 s sped up 9× to 87 s, 0.76 MB, no audio.
- `public/video/robogames-round2.mp4`: round 2 burning-maze run, 72 s sped up 2× to 36 s, 0.69 MB, no audio.
- Photos by Gamith Chanuka Photography, from the organisers' **"Kobuki Robots in Motion" workshop, 1 March 2025**, not the final. The robot base is a **Quanser QBot 2**, which is built on the Kobuki.

## Still unconfirmed

- The exact final-round rules, date and venue.

## Sources

- Official lists and round 1 / round 2 task PDFs, from a fellow finalist's repo: [Nishitha0730/IESL-RoboGames-2024](https://github.com/Nishitha0730/IESL-RoboGames-2024) — the files `Winners in University Category of Elimination Round.pdf`, `SemiFinalists List.pdf`, `First Round/University Category Task - Round 1.pdf` and `Semi Final/University Category Task - round 2.pdf`.
- The team's own code: [Platinum-Saber/robo_games](https://github.com/Platinum-Saber/robo_games)
- [Sunday Times — SLT-MOBITEL drives innovation at IESL RoboGames 2024](https://www.sundaytimes.lk/250518/education/slt-mobitel-drives-innovation-at-iesl-robogames-2024-showcasing-sri-lankas-robotics-revolution-597969.html) (organisers, workshops, category winners)
- [The Island — SLT-MOBITEL drives innovation at IESL RoboGames 2024](https://island.lk/slt-mobitel-drives-innovation-at-iesl-robogames-2024/)
- [IESL RoboGames on Facebook](https://www.facebook.com/ieslrobogame/) and [SLT-MOBITEL's winners post](https://www.facebook.com/SLTMobitel/posts/congratulations-to-the-winners-of-iesl-robogames-20242025-your-innovation-and-de/1096649222504815/). These showed up in search, but Facebook blocks automated reading, so nothing here comes from them. No public LinkedIn posts about Sentinels turned up.
