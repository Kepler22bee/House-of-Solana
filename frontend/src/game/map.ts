import { TileType as T, TILE_SIZE } from "./tiles";

const G = T.GRASS;
const P = T.PATH;
const W = T.WATER;
const t = T.TREE_TRUNK;
const TT = T.TREE_TOP;
const w = T.WALL;
const D = T.DOOR;
const F = T.FENCE;
const f = T.FLOWER_RED;
const b = T.FLOWER_BLUE;
const C = T.CROP;
const R = T.ROCK;
const B = T.BRIDGE;
const d = T.DARK_GRASS;
const S = T.SAND;
const rr = T.ROOF_RED;
const wi = T.WINDOW;
const st = T.STALL;
const ch = T.CHEST;
const si = T.SIGN;
const tg = T.TALL_GRASS;
const we = T.WATER_EDGE;
const mu = T.MUSHROOM;
const be = T.BENCH;
const la = T.LAMP;
const cw = T.CASINO_WALL;
const cr = T.CASINO_ROOF;
const cd = T.CASINO_DOOR;
const np = T.NEON_PINK;
const nb = T.NEON_BLUE;
const cf = T.CASINO_FLOOR;
const to = T.TORII;
const ln = T.LANTERN;
const ba = T.BAMBOO;
const xw = T.CASINO_WINDOW;
const cu = T.CASINO_UPPER;
const cm = T.CASINO_MARQUEE;
const cp = T.CASINO_PILLAR;
const ca = T.CASINO_AWNING;
const cx = T.CASINO_DISPLAY;
const cb = T.CASINO_BRICK;
const sl = T.STREET_LAMP;
const sw = T.SIDEWALK;

// 50 wide x 50 tall map (matches Tiled overworld.json)
export const MAP_WIDTH = 50;
export const MAP_HEIGHT = 50;

export const gameMap: number[][] = [
// 0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24  25  26  27  28  29  30  31  32  33  34  35  36  37  38  39  40  41  42  43  44  45  46  47  48  49  50  51  52  53  54  55  56  57  58  59
[ TT, TT, TT, TT, TT, TT, d,  d,  TT, TT, TT, d,  d,  d,  rr, rr, rr, rr, rr, rr, d,  d,  rr, rr, rr, rr, d,  d,  TT, TT, d,  d,  d,  R,  S,  S,  we, W,  W,  W,  W,  W,  W,  W,  W,  we, S,  S,  d,  d,  TT, TT, TT, TT, TT, TT, TT, TT, TT, TT ],
[ TT, TT, TT, TT, TT, d,  d,  d,  TT, TT, d,  d,  d,  d,  rr, rr, rr, rr, rr, rr, d,  d,  rr, rr, rr, rr, d,  d,  TT, d,  d,  d,  d,  S,  S,  S,  we, W,  W,  W,  W,  W,  W,  W,  W,  we, S,  S,  d,  d,  d,  TT, TT, TT, TT, TT, TT, TT, TT, TT ],
[ TT, TT, TT, t,  TT, d,  R,  d,  d,  TT, d,  st, st, d,  w,  w,  wi, w,  wi, w,  P,  P,  w,  wi, w,  w,  d,  d,  d,  d,  d,  d,  S,  S,  S,  S,  we, W,  W,  W,  W,  W,  W,  W,  W,  we, S,  d,  d,  d,  d,  d,  TT, TT, t,  TT, TT, TT, TT, TT ],
[ TT, t,  TT, TT, d,  d,  d,  d,  d,  d,  d,  st, st, d,  w,  w,  w,  w,  w,  w,  P,  P,  w,  w,  w,  w,  d,  d,  d,  f,  b,  d,  S,  S,  d,  d,  we, W,  W,  W,  W,  W,  W,  W,  we, S,  S,  d,  d,  f,  d,  d,  d,  TT, TT, TT, TT, TT, TT, TT ],
[ t,  TT, TT, d,  d,  d,  la, d,  d,  d,  d,  P,  P,  P,  w,  D,  w,  w,  w,  D,  P,  P,  w,  D,  w,  w,  P,  P,  P,  P,  d,  d,  d,  d,  d,  d,  S,  we, W,  W,  W,  W,  W,  we, S,  S,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT, t,  TT, TT, TT ],
[ TT, TT, d,  d,  d,  d,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  d,  d,  d,  d,  S,  we, we, we, we, we, S,  S,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT, TT, TT, TT ],
[ TT, d,  d,  f,  d,  d,  P,  d,  d,  d,  d,  d,  si, P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  f,  d,  b,  d,  P,  d,  d,  d,  d,  d,  S,  S,  S,  S,  S,  d,  d,  d,  d,  la, d,  d,  d,  d,  d,  d,  d,  d,  TT, TT, TT, TT ],
[ d,  d,  d,  d,  d,  d,  P,  d,  d,  be, d,  d,  d,  d,  P,  d,  R,  la, d,  f,  b,  d,  la, d,  R,  P,  d,  mu, d,  d,  f,  d,  P,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  R,  d,  d,  d,  d,  d,  TT, TT, TT ],
[ d,  d,  mu, d,  d,  d,  P,  d,  d,  d,  tg, d,  d,  d,  P,  d,  b,  d,  d,  tg, d,  mu, d,  d,  b,  P,  d,  d,  la, d,  d,  d,  P,  d,  d,  TT, TT, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT ],
[ d,  d,  d,  d,  d,  d,  P,  d,  R,  d,  d,  d,  d,  d,  P,  d,  f,  d,  tg, d,  R,  d,  d,  f,  d,  P,  d,  d,  d,  tg, tg, d,  P,  P,  TT, TT, t,  TT, d,  d,  d,  rr, rr, rr, rr, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT ],
[ F,  F,  F,  F,  F,  F,  P,  F,  F,  F,  d,  d,  be, d,  P,  d,  mu, d,  b,  d,  d,  d,  f,  d,  d,  P,  d,  d,  tg, tg, tg, d,  d,  TT, TT, TT, TT, d,  d,  d,  d,  rr, rr, rr, rr, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, d,  d,  d  ],
[ G,  G,  G,  G,  f,  G,  P,  G,  G,  G,  d,  d,  d,  d,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  d,  d,  d,  tg, d,  d,  d,  d,  TT, d,  d,  d,  d,  d,  d,  w,  w,  wi, w,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d  ],
[ G,  G,  b,  G,  G,  G,  P,  G,  G,  G,  d,  d,  f,  d,  d,  d,  la, d,  P,  d,  d,  be, d,  d,  d,  d,  d,  R,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  P,  P,  w,  D,  w,  w,  P,  P,  P,  P,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d  ],
[ G,  G,  G,  G,  G,  G,  P,  G,  G,  G,  la, d,  d,  b,  d,  mu, d,  d,  P,  d,  tg, d,  d,  d,  d,  d,  d,  d,  d,  tg, d,  d,  d,  d,  d,  d,  d,  d,  P,  d,  d,  w,  w,  w,  w,  d,  d,  d,  P,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d  ],
[ G,  f,  G,  G,  G,  G,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d  ],
[ G,  G,  G,  G,  G,  G,  P,  G,  G,  G,  d,  f,  d,  d,  d,  d,  b,  d,  P,  d,  d,  d,  R,  d,  d,  d,  P,  d,  f,  d,  d,  P,  d,  d,  mu, d,  d,  d,  P,  d,  d,  d,  d,  be, d,  d,  d,  d,  P,  d,  d,  d,  d,  TT, TT, d,  d,  d,  d,  d  ],
[ G,  G,  G,  G,  G,  G,  P,  G,  G,  G,  G,  d,  ch, d,  d,  tg, d,  d,  P,  d,  d,  f,  d,  b,  d,  d,  P,  d,  d,  la, d,  P,  d,  tg, d,  d,  d,  d,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  d,  d,  d,  TT, TT, t,  TT, d,  d,  d,  d  ],
[ G,  G,  G,  G,  G,  G,  P,  P,  P,  P,  G,  d,  d,  d,  d,  rr, rr, rr, rr, rr, d,  d,  F,  F,  F,  F,  P,  F,  F,  F,  F,  P,  d,  d,  d,  d,  TT, TT, TT, d,  d,  R,  d,  f,  d,  b,  d,  d,  d,  d,  d,  TT, TT, TT, TT, TT, d,  d,  d,  d  ],
[ TT, TT, d,  G,  G,  G,  G,  G,  G,  P,  G,  d,  d,  d,  d,  rr, rr, rr, rr, rr, d,  d,  F,  C,  C,  C,  P,  C,  C,  C,  F,  d,  d,  d,  TT, TT, t,  TT, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT, TT, d,  d,  d,  d,  d  ],
[ TT, TT, TT, d,  G,  G,  G,  G,  G,  P,  G,  G,  d,  d,  d,  w,  w,  wi, w,  w,  d,  d,  F,  C,  C,  C,  P,  C,  C,  C,  F,  d,  d,  d,  d,  TT, TT, TT, d,  d,  d,  d,  f,  b,  f,  d,  d,  d,  d,  d,  d,  d,  d,  TT, d,  d,  d,  d,  d,  d  ],
[ TT, t,  TT, TT, d,  G,  G,  G,  G,  P,  P,  P,  P,  P,  P,  w,  D,  w,  D,  w,  P,  P,  F,  C,  C,  C,  P,  C,  C,  C,  F,  P,  P,  P,  d,  d,  TT, d,  d,  d,  d,  d,  b,  f,  b,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d  ],
[ TT, TT, TT, d,  d,  G,  G,  G,  G,  G,  G,  d,  d,  d,  d,  w,  w,  w,  w,  w,  d,  d,  F,  C,  C,  C,  P,  C,  C,  C,  F,  d,  d,  P,  d,  d,  d,  d,  d,  d,  d,  d,  f,  b,  f,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d  ],
[ TT, TT, d,  d,  d,  b,  G,  G,  G,  G,  G,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  F,  F,  F,  F,  F,  F,  F,  F,  F,  d,  d,  P,  d,  d,  d,  R,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  R,  d,  d,  d,  d  ],
// Row 23 — path leading south + sidewalk area
[ d,  d,  d,  d,  d,  d,  G,  f,  G,  d,  d,  d,  b,  d,  d,  la, d,  d,  P,  d,  d,  R,  d,  d,  f,  d,  d,  d,  mu, d,  d,  d,  d,  P,  d,  d,  tg, d,  d,  d,  d,  d,  b,  d,  f,  d,  d,  d,  d,  la, d,  d,  d,  d,  d,  d,  d,  d,  d,  d  ],
// Row 24 — sidewalk begins around casino
[ d,  d,  d,  d,  R,  d,  d,  d,  d,  d,  d,  sw, sw, sw, sw, sw, sw, sw, P,  sw, sw, sw, sw, sw, sw, sw, d,  d,  d,  d,  d,  d,  d,  P,  P,  P,  P,  P,  P,  P,  d,  d,  d,  f,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT ],
// Row 25 — casino roof row 1 (top edge)
[ d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  sw, sl, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, sl, sw, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  d,  d,  d,  si, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT, TT ],
// Row 26 — casino upper facade (dark grid windows)
[ TT, d,  d,  d,  d,  d,  d,  d,  d,  d,  sw, sw, cp, cu, cu, cu, cu, cu, cu, cu, cu, cu, cu, cu, cp, sw, sw, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT, t,  TT ],
// Row 27 — casino brick wall + arch area
[ TT, TT, d,  d,  d,  d,  d,  d,  d,  d,  sw, sw, cp, cb, cu, cb, cu, cu, cu, cu, cu, cb, cu, cb, cp, sw, sw, d,  d,  d,  d,  d,  d,  R,  d,  d,  d,  d,  d,  P,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  R,  d,  TT, TT, TT, TT, TT ],
// Row 28 — MARQUEE sign band (the big neon sign)
[ TT, TT, TT, d,  d,  d,  d,  d,  d,  d,  sw, sw, np, cm, cm, cm, cm, cm, cm, cm, cm, cm, cm, cm, np, sw, sw, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT, TT, TT, TT, TT ],
// Row 29 — awning strip
[ TT, TT, TT, TT, d,  d,  d,  d,  d,  d,  sw, sw, nb, ca, ca, ca, ca, ca, ca, ca, ca, ca, ca, ca, nb, sw, sw, d,  d,  d,  d,  d,  d,  d,  d,  d,  mu, d,  d,  P,  P,  P,  P,  P,  P,  P,  P,  d,  d,  d,  d,  d,  d,  TT, TT, TT, TT, TT, TT, TT ],
// Row 30 — storefront: display windows + entrance door
[ TT, TT, TT, TT, TT, d,  d,  d,  d,  d,  sw, sl, cp, cx, cx, cb, cb, cb, cd, cb, cb, cb, cx, cx, cp, sl, sw, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  d,  d,  d,  d,  d,  TT, TT, TT, TT, TT, TT, TT, TT ],
// Row 31 — entrance sidewalk
[ TT, TT, TT, TT, TT, TT, d,  d,  d,  d,  sw, sw, sw, sw, sw, sw, sw, sw, P,  sw, sw, sw, sw, sw, sw, sw, sw, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  d,  d,  d,  d,  TT, TT, TT, TT, TT, TT, TT, TT, TT ],
// Row 32 — path out + lanterns
[ TT, TT, TT, TT, TT, TT, TT, d,  d,  d,  d,  d,  ln, d,  d,  d,  d,  d,  P,  d,  d,  d,  d,  d,  ln, d,  d,  d,  d,  d,  d,  d,  d,  R,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  d,  d,  d,  TT, TT, TT, TT, TT, TT, TT, TT, TT, TT ],
// Row 33 — bamboo + path continues
[ TT, TT, TT, TT, TT, TT, TT, TT, d,  d,  d,  d,  ba, d,  d,  d,  d,  d,  P,  d,  d,  d,  d,  d,  ba, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  ch, d,  d,  d,  d,  P,  d,  d,  TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT ],
// Row 34 — path fades into forest
[ TT, TT, TT, TT, TT, TT, TT, TT, TT, d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  d,  d,  f,  d,  d,  b,  d,  d,  d,  d,  d,  d,  R,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  P,  d,  TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT ],
// Row 35
[ TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, d,  d,  d,  R,  d,  d,  d,  d,  P,  P,  P,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  d,  TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT ],
// Row 36
[ TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, d,  d,  d,  d,  d,  d,  d,  d,  d,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  P,  TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT ],
// Row 37
[ TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  R,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT ],
// Row 38
[ TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT ],
// Row 39
[ TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  d,  TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT, TT ],
];

export interface NPC {
  x: number;
  y: number;
  name: string;
  dialogue: string[];
  color: string;
  hairColor: string;
  icon?: string;
}

export const npcs: NPC[] = [
  {
    x: 20 * TILE_SIZE + 8,
    y: 8 * TILE_SIZE + 8,
    name: "Elder Sage",
    dialogue: [
      "Welcome to Pixel Village, young adventurer!",
      "This land was once threatened by dark forces...",
      "But brave heroes like you kept us safe.",
      "Speak to the villagers - they may need your help!",
    ],
    color: "#9b59b6",
    hairColor: "#bdc3c7",
    icon: "⭐",
  },
  {
    x: 25 * TILE_SIZE + 8,
    y: 8 * TILE_SIZE + 8,
    name: "Merchant Kai",
    dialogue: [
      "Welcome to Fortune Falls, newcomer!",
      "Looking to make some coin? Head SOUTH.",
      "There's a casino down the main path — can't miss the neon lights.",
      "Start at the Coin Toss tables. Learn the odds.",
      "Win enough and you might unlock something... special.",
    ],
    color: "#2471a3",
    hairColor: "#2c3e50",
    icon: "🛒",
  },
  {
    x: 30 * TILE_SIZE + 8,
    y: 8 * TILE_SIZE + 8,
    name: "Healer Mira",
    dialogue: [
      "Oh, you look weary from your travels!",
      "Let me restore your health... There, all better!",
      "Be careful out there in the tall grass!",
    ],
    color: "#27ae60",
    hairColor: "#e74c3c",
    icon: "💚",
  },
  {
    x: 22 * TILE_SIZE + 8,
    y: 12 * TILE_SIZE + 8,
    name: "Clanker Workshop",
    dialogue: [
      "*bzzt* Welcome to the Clanker House!",
      "This is where AI companions are built and upgraded.",
      "Press B anytime to talk to your Wall-E companion.",
      "Win coins at the casino to buy upgrades for Clanker!",
      "Neural Boost, Memory Bank, Turbo Core... new upgrades dropping SOON!",
      "Stay tuned, big things are coming to the workshop...",
    ],
    color: "#d4a030",
    hairColor: "#6a6a6a",
    icon: "🤖",
  },
  {
    x: 35 * TILE_SIZE + 8,
    y: 11 * TILE_SIZE + 8,
    name: "Guard Rex",
    dialogue: [
      "Halt! Oh, you're a friendly face.",
      "I keep watch over the eastern path.",
      "Strange creatures have been spotted near the river...",
      "Stay vigilant, adventurer!",
    ],
    color: "#7f8c8d",
    hairColor: "#2c3e50",
    icon: "⚔️",
  },
  {
    x: 28 * TILE_SIZE + 8,
    y: 12 * TILE_SIZE + 8,
    name: "Little Pip",
    dialogue: [
      "Hi hi! I'm Pip! I wanna be an adventurer too!",
      "Did you know there's a treasure chest nearby?",
      "I think it's hidden somewhere to the south...",
    ],
    color: "#f39c12",
    hairColor: "#f1c40f",
    icon: "💬",
  },
  {
    x: 42 * TILE_SIZE + 8,
    y: 34 * TILE_SIZE + 8,
    name: "Dealer Yuki",
    dialogue: [
      "いらっしゃいませ! Welcome, traveler!",
      "The Golden Dragon Casino awaits you inside.",
      "Fortune favors the bold... step through the doors!",
    ],
    color: "#e94560",
    hairColor: "#1a1a2e",
    icon: "🎰",
  },
  {
    x: 40 * TILE_SIZE + 8,
    y: 11 * TILE_SIZE + 8,
    name: "Hermit Oden",
    dialogue: [
      "You found my cabin in the woods!",
      "Not many venture this far east...",
      "There's a hidden chest deep in the southern forest.",
      "Follow the winding path if you dare!",
    ],
    color: "#6d4c41",
    hairColor: "#9e9e9e",
    icon: "🏠",
  },
  {
    x: 40 * TILE_SIZE + 8,
    y: 35 * TILE_SIZE + 8,
    name: "Wanderer Sol",
    dialogue: [
      "The path south leads deep into the forest...",
      "I've been mapping these trails for years.",
      "Be careful - the trees grow thick down there.",
    ],
    color: "#00695c",
    hairColor: "#4caf50",
    icon: "🗺️",
  },
];

export const tileInteractions: Record<number, string[]> = {
  [T.CHEST]: ["You found a mysterious chest!", "It contains 50 gold coins!", "Lucky find, adventurer!"],
  [T.SIGN]: ["Welcome to Fortune Falls", "Casino District: Head South", "Beware of wild creatures beyond the forest!"],
  [T.DOOR]: ["Clanker House — AI Workshop", "New upgrades dropping SOON!", "Talk to the workshop keeper outside."],
  [T.CASINO_DOOR]: ["The Golden Dragon Casino", "Coin Toss & Price Prediction tables await inside.", "Step in to test your luck... or your skill."],
};
