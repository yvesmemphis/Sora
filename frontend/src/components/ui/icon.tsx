/**
 * Jeu d'icônes Maison Sora (repris de `sora-icons.js` des maquettes).
 * Tracés 24×24, trait 1,75, couleur héritée de `currentColor`.
 *
 * Notation compacte : « c:cx,cy,r » = cercle, « r:x,y,w,h,rx » = rectangle,
 * sinon chemin SVG.
 */
const TRACES = {
  search: ["c:11,11,7", "M20 20l-3.5-3.5"],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  bag: ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
  clock: ["c:12,12,9", "M12 7v5l3 2"],
  table: [
    "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",
    "M7 2v20",
    "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",
  ],
  bed: ["M2 4v16", "M2 8h18a2 2 0 0 1 2 2v10", "M2 17h20", "M6 8v9"],
  takeaway: [
    "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
    "M3.3 7 12 12l8.7-5",
    "M12 22V12",
  ],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  check: ["M20 6 9 17l-5-5"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  left: ["m15 18-6-6 6-6"],
  right: ["m9 18 6-6-6-6"],
  down: ["m6 9 6 6 6-6"],
  arrow: ["M5 12h14", "m12 5 7 7-7 7"],
  alert: [
    "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
    "M12 9v4",
    "M12 17h.01",
  ],
  info: ["c:12,12,9", "M12 16v-4", "M12 8h.01"],
  qr: ["r:3,3,7,7,1", "r:14,3,7,7,1", "r:3,14,7,7,1", "M14 14h3v3h-3z", "M20 14v.01", "M14 20h.01", "M17 20h4v-3"],
  grid: ["r:3,3,7,9,1.5", "r:14,3,7,5,1.5", "r:14,12,7,9,1.5", "r:3,16,7,5,1.5"],
  book: ["M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"],
  box: [
    "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
    "M3.3 7 12 12l8.7-5",
    "M12 22V12",
    "M7.5 4.2l9 5.2",
  ],
  flame: [
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  ],
  trend: ["M22 7 13.5 15.5 8.5 10.5 2 17", "M16 7h6v6"],
  spark: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z", "M19 17v4", "M17 19h4"],
  wallet: [
    "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
    "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
  ],
  card: ["r:2,5,20,14,2", "M2 10h20", "M6 15h4"],
  cash: ["r:2,6,20,12,2", "c:12,12,2.5", "M6 12h.01", "M18 12h.01"],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "c:9,7,4",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  user: ["c:12,8,4", "M20 21a8 8 0 0 0-16 0"],
  shield: [
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  ],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  sliders: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  wifiOff: [
    "M12 20h.01",
    "M8.5 16.4a5 5 0 0 1 7 0",
    "M2 2l20 20",
    "M5 12.9a10 10 0 0 1 5.2-2.8",
    "M19 12.9a10 10 0 0 0-2.2-1.6",
    "M2 8.8a15 15 0 0 1 4.2-2.6",
    "M22 8.8A15 15 0 0 0 10.7 5",
  ],
  wifi: ["M12 20h.01", "M2 8.8a15 15 0 0 1 20 0", "M5 12.9a10 10 0 0 1 14 0", "M8.5 16.4a5 5 0 0 1 7 0"],
  filter: ["M22 3H2l8 9.46V19l4 2v-8.54L22 3z"],
  printer: [
    "M6 9V2h12v7",
    "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",
    "r:6,14,12,8,0",
  ],
  truck: [
    "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",
    "M15 18H9",
    "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14",
    "c:17,18,2",
    "c:7,18,2",
  ],
  edit: ["M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"],
  calendar: ["r:3,4,18,18,2", "M16 2v4", "M8 2v4", "M3 10h18"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
  note: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  trash: [
    "M3 6h18",
    "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  ],
  ban: ["c:12,12,9", "m5.6 5.6 12.8 12.8"],
  play: ["M7 4l13 8-13 8V4z"],
  lock: ["r:4,11,16,10,2", "M8 11V7a4 4 0 0 1 8 0v4"],
  refresh: [
    "M3 12a9 9 0 0 1 15-6.7L21 8",
    "M21 3v5h-5",
    "M21 12a9 9 0 0 1-15 6.7L3 16",
    "M8 16H3v5",
  ],
  eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z", "c:12,12,3"],
  more: ["c:12,5,1", "c:12,12,1", "c:12,19,1"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
} as const;

export type NomIcone = keyof typeof TRACES;

interface IconProps {
  name: NomIcone;
  className?: string;
  /** Texte lu par les lecteurs d'écran. Sans titre, l'icône est décorative. */
  title?: string;
}

export function Icon({ name, className = "size-5", title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block shrink-0 ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {TRACES[name].map((trace, i) => {
        if (trace.startsWith("c:")) {
          const [cx, cy, r] = trace.slice(2).split(",");
          return <circle key={i} cx={cx} cy={cy} r={r} />;
        }
        if (trace.startsWith("r:")) {
          const [x, y, w, h, rx] = trace.slice(2).split(",");
          return <rect key={i} x={x} y={y} width={w} height={h} rx={rx} />;
        }
        return <path key={i} d={trace} />;
      })}
    </svg>
  );
}
