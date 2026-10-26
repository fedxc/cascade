import type { Contraption } from '../engine/types';
import { domino } from './domino';
import { bead } from './bead';
import { pendulum } from './pendulum';
import { andGate } from './and';
import { arbiter } from './arbiter';
import { finale } from './finale';
import { organ } from './organ';
import { fan } from './fan';
import { contagion } from './contagion';
import { flip } from './flip';
import { odometer } from './odometer';
import { bloom } from './bloom';
import { stairs } from './stairs';
import { typewriter } from './typewriter';
import { feed } from './feed';
import { cradle } from './cradle';

import { marble } from './marble';
import { ripple } from './ripple';
import { life } from './life';
import { sorter } from './sorter';
import { escapement } from './escapement';
import { hourglass } from './hourglass';

import { ferris } from './ferris';
import { sequencer } from './sequencer';
import { piston } from './piston';
import { waterfall } from './waterfall';
import { tree } from './tree';
import { calendar } from './calendar';

import { roulette } from './roulette';
import { safe } from './safe';
import { reels } from './reels';
import { slinky } from './slinky';
import { fuse } from './fuse';

export const REGISTRY: Contraption[] = [domino, bead, pendulum, organ, fan, contagion, flip, odometer, bloom, stairs, typewriter, feed, cradle, marble, ripple, life, sorter, escapement, hourglass, ferris, sequencer, piston, waterfall, tree, calendar, roulette, safe, reels, slinky, fuse, andGate, arbiter, finale];
export const BY_KIND = new Map(REGISTRY.map((c) => [c.kind, c]));
