#!/usr/bin/env python3
"""
Simulation of the TODO-076 funnel ("find your one building") on a population of simulated users.

Interest itself cannot be simulated. What is measured are the properties that made comparable results spread
(docs/media/VIRAL_CASES.md): the result is personal (people rarely get the same building), comparable (friends get
different places, in different parts of the city), arguable but not arbitrary (one changed answer moves it somewhat;
measurement noise in the data does not), and good (the building really is high on every wish picked).

Users pick their 5 wishes in order by a Plackett-Luce draw from popularity scores per persona (popular wishes come
first more often); the sea is a yes / no gate drawn separately. Funnel: adaptive ladder of explore_one_building.py.

  python3 scripts/simulate_one_building.py [--users 20000] [--with-locals] [--seed 1] [--skip-exhaustive]
  python3 scripts/simulate_one_building.py --order quiet,metro,park,shops,cheap [--sea] [--with-locals]
      one funnel: the path and the winner (building row), to check the app against

Reads the shipped blob; changes nothing. Takes a few minutes.
"""

import argparse
import collections
import itertools
import math
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import explore_one_building as e  # noqa: E402

# Popularity of each wish per persona (Plackett-Luce scores) and the chance of asking for the sea.
PERSONAS = {
    "general": ({"quiet": 3, "metro": 3, "cheap": 3, "shops": 2.5, "park": 2, "centre": 2, "bars": 1.5,
                 "health": 1.5, "locals": 1.5, "new": 1, "schools": 0.8}, 0.20, 0.35),
    "family": ({"schools": 4, "cheap": 3.5, "park": 3.5, "quiet": 3, "shops": 2.5, "health": 2, "metro": 1.5,
                "new": 1.5, "locals": 1.5, "centre": 0.7, "bars": 0.3}, 0.10, 0.20),
    "young": ({"bars": 3.5, "metro": 3, "centre": 3, "cheap": 2.5, "quiet": 2, "shops": 2, "park": 1.5,
               "locals": 1, "new": 1, "health": 0.5, "schools": 0.2}, 0.30, 0.25),
    "retiree": ({"health": 4, "quiet": 3.5, "shops": 3, "park": 2.5, "metro": 2, "cheap": 2, "locals": 1.5,
                 "centre": 1, "bars": 1, "new": 0.5, "schools": 0.2}, 0.15, 0.15),
    "uniform": (None, 0.15, 0.05),
}
# Barcelona barri codes → district (official numbering 1–73)
DISTRICTS = [(4, "Ciutat Vella"), (10, "Eixample"), (18, "Sants-Montjuïc"), (21, "les Corts"),
             (27, "Sarrià-Sant Gervasi"), (32, "Gràcia"), (43, "Horta-Guinardó"), (56, "Nou Barris"),
             (63, "Sant Andreu"), (73, "Sant Martí")]


def district_of(code):
    n = int(code)
    return next(name for top, name in DISTRICTS if n <= top)


class World:
    def __init__(self, with_locals, rng, perturb=False):
        meta, cols, vibe = e.load()
        mask, crit, info = e.criteria(meta, cols, vibe)
        base = np.flatnonzero(info["dwellings"] >= e.MIN_DWELLINGS)
        self.rows = np.flatnonzero(mask)[base]  # building row (feature id) of each building that takes part
        self.names = [c for c in crit if c != "sea" and (with_locals or c != "locals")]
        crit = {k: v[base].copy() for k, v in crit.items()}
        if perturb:  # measurement noise: ±1.5 dB, ±1 walking minute
            crit["quiet"] += rng.normal(0, 1.5, len(base))
            for k in ("metro", "park", "shops", "schools", "bars", "health", "centre"):
                crit[k] += rng.integers(-1, 2, len(base))
        self.V = {k: np.where(np.isnan(v), -np.inf, v) for k, v in crit.items()}
        self.P = {k: e.percentile(v) for k, v in crit.items()}
        self.sea_ok = ~np.isnan(crit["sea"])
        self.lng, self.lat = info["lng"][base], info["lat"][base]
        areas = meta["areas"]
        self.barri = np.array([areas[int(a)]["name"] for a in info["area"][base]])
        self.district = np.array([district_of(areas[int(a)]["code"]) for a in info["area"][base]])
        self.n = len(base)

    def funnel(self, order, sea=False):
        """Order of wishes (more than 5 allowed: a wish that cannot cut is skipped) → (winner, left, used)."""
        alive = np.flatnonzero(self.sea_ok) if sea else np.arange(self.n)
        used, step = [], 0
        for c in order:
            if step == e.FUNNEL_STEPS or len(alive) <= 1:
                break
            k = e.funnel_step_share(len(alive), step)
            v = self.V[c][alive]
            nxt = alive[v >= np.quantile(v, 1 - k, method="higher")]
            if len(nxt) > 0.9 * len(alive):
                continue
            alive, step = nxt, step + 1
            used.append(c)
        s = sum((e.FUNNEL_STEPS - j) * self.P[c][alive] for j, c in enumerate(used))
        return int(alive[np.argmax(s)]), len(alive), used

    def path(self, order, sea=False):
        """The counts after each step of one funnel (for --order)."""
        alive = np.flatnonzero(self.sea_ok) if sea else np.arange(self.n)
        counts, step = [len(alive)], 0
        for c in order:
            if step == e.FUNNEL_STEPS or len(alive) <= 1:
                break
            k = e.funnel_step_share(len(alive), step)
            v = self.V[c][alive]
            nxt = alive[v >= np.quantile(v, 1 - k, method="higher")]
            if len(nxt) > 0.9 * len(alive):
                continue
            alive, step = nxt, step + 1
            counts.append(len(alive))
        return counts

    def dist(self, a, b):
        dx = (self.lng[a] - self.lng[b]) * 111320 * math.cos(math.radians(41.4))
        dy = (self.lat[a] - self.lat[b]) * 110540
        return math.hypot(dx, dy)


def draw_user(world, rng):
    names = list(PERSONAS)
    persona = rng.choice(names, p=[PERSONAS[p][2] for p in names])
    scores, sea_p, _ = PERSONAS[persona]
    if scores is None:
        order = list(rng.permutation(world.names))
    else:
        w = np.array([scores.get(c, 1.0) for c in world.names])
        keys = np.log(w) + rng.gumbel(size=len(w))  # Plackett-Luce via Gumbel
        order = [world.names[i] for i in np.argsort(-keys)]
    return persona, order, rng.random() < sea_p


def concentration(counter, total):
    p = np.array(list(counter.values()), float) / total
    return {"distinct": len(counter), "effective": float(np.exp(-(p * np.log(p)).sum())),
            "same_pair": float((p ** 2).sum()), "top1": float(p.max()),
            "top10": float(np.sort(p)[::-1][:10].sum())}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=20000)
    ap.add_argument("--with-locals", action="store_true")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--skip-exhaustive", action="store_true")
    ap.add_argument("--order", help="comma-separated wishes: run one funnel and print its winner")
    ap.add_argument("--sea", action="store_true")
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    t0 = time.time()
    W = World(args.with_locals, rng)
    if args.order:
        order = args.order.split(",")
        win, left, used = W.funnel(order, args.sea)
        print(f"path {' → '.join(str(c) for c in W.path(order, args.sea))}; steps {', '.join(used)}")
        print(f"winner: building row {W.rows[win]}, {W.barri[win]}, {W.lat[win]:.5f},{W.lng[win]:.5f}; left {left}")
        return
    print(f"# Funnel simulation ({'with' if args.with_locals else 'without'} 'locals'), {W.n} buildings, "
          f"wishes: {', '.join(W.names)}\n")

    # 1. Population
    users = []
    for _ in range(args.users):
        persona, order, sea = draw_user(W, rng)
        win, left, used = W.funnel(order, sea)
        users.append((persona, order, sea, win, left, used))
    wins = collections.Counter(u[3] for u in users)
    barris = collections.Counter(W.barri[u[3]] for u in users)
    dists = collections.Counter(W.district[u[3]] for u in users)
    cb, cbar = concentration(wins, len(users)), concentration(barris, len(users))
    print(f"## 1. Population of {len(users)} users (general 35%, family 20%, young 25%, retiree 15%, uniform 5%)")
    print(f"- distinct buildings: {cb['distinct']}; effective number (exp entropy): {cb['effective']:.0f}")
    print(f"- most frequent building: {cb['top1']:.1%} of users; top 10 buildings: {cb['top10']:.1%}")
    print(f"- two random users get the same building: {cb['same_pair']:.2%}; the same barri: {cbar['same_pair']:.1%}")
    print(f"- barris that ever win: {cbar['distinct']} of 73; effective number: {cbar['effective']:.0f}")
    print("- barris: " + ", ".join(f"{b} {c / len(users):.0%}" for b, c in barris.most_common(8)))
    share_d = collections.Counter(W.district)
    print("- district of the winner vs its share of buildings:")
    for d, c in sorted(dists.items(), key=lambda x: -x[1]):
        print(f"    {d:22s} winners {c / len(users):5.1%}   buildings {share_d[d] / W.n:5.1%}")
    left = np.array([u[4] for u in users])
    steps = np.array([len(u[5]) for u in users])
    print(f"- all 5 steps used: {np.mean(steps == 5):.0%}; left after the last step: 1–3 {np.mean(left <= 3):.0%}, "
          f"4–10 {np.mean((left > 3) & (left <= 10)):.0%}, more {np.mean(left > 10):.0%}")
    skipped = [o.index(us[-1]) + 1 - len(us) for _, o, _, _, _, us in users if us]
    print(f"- users who met a wish that could not cut (not offered): {np.mean(np.array(skipped) > 0):.0%}")

    print("\n### By persona")
    for p in PERSONAS:
        sub = [u for u in users if u[0] == p]
        if not sub:
            continue
        c = concentration(collections.Counter(u[3] for u in sub), len(sub))
        b = collections.Counter(W.barri[u[3]] for u in sub)
        print(f"- {p:8s} n={len(sub):5d}  distinct {c['distinct']:5d}  top building {c['top1']:5.1%}  same building "
              f"{c['same_pair']:.2%}  barris {len(b):2d}: " + ", ".join(f"{x} {n / len(sub):.0%}" for x, n in b.most_common(3)))

    # 2. Quality: how high is the winner on each wish picked
    mins, means = [], []
    for _, _, _, win, _, used in users:
        if used:
            ps = [W.P[c][win] for c in used]
            mins.append(min(ps))
            means.append(np.mean(ps))
    mins, means = np.array(mins), np.array(means)
    print("\n## 2. Quality of the result (percentile of the winner among the city's buildings, per wish picked)")
    print(f"- the weakest of the 5 wishes: median top {100 - np.median(mins) * 100:.0f}%, "
          f"p10 user top {100 - np.percentile(mins, 10) * 100:.0f}%")
    print(f"- mean over the 5 wishes: median top {100 - np.median(means) * 100:.0f}%")
    print(f"- users whose building is in the top 25% on every wish: {np.mean(mins >= 0.75):.0%}; "
          f"top 10% on every wish: {np.mean(mins >= 0.90):.0%}")

    # 3. Sensitivity to one answer
    print("\n## 3. One answer changed (3,000 users each)")
    for label, change in [
        ("swap wishes 1 and 2", lambda o: [o[1], o[0]] + o[2:]),
        ("swap wishes 4 and 5", lambda o: o[:3] + [o[4], o[3]] + o[5:]),
        ("replace wish 5 by the 6th", lambda o: o[:4] + o[5:]),
        ("replace wish 1 by the 6th", lambda o: o[1:5] + [o[0]] + o[5:]),
    ]:
        changed, d, same_barri = 0, [], 0
        for persona, order, sea, win, _, _ in users[:3000]:
            w2, _, _ = W.funnel(change(order), sea)
            if w2 != win:
                changed += 1
                d.append(W.dist(win, w2))
                same_barri += W.barri[w2] == W.barri[win]
        print(f"- {label:26s} other building {changed / 30:3.0f}%; when it moves: median {np.median(d):5.0f} m, "
              f"same barri {same_barri / max(changed, 1):.0%}")

    # 4. Robustness to measurement noise in the data
    print("\n## 4. Measurement noise (±1.5 dB, ±1 minute), 5 noisy copies of the data, 1,500 users")
    sample = users[:1500]
    same, near, sbarri = [], [], []
    for k in range(5):
        Wn = World(args.with_locals, np.random.default_rng(100 + k), perturb=True)
        for _, order, sea, win, _, _ in sample:
            w2, _, _ = Wn.funnel(order, sea)
            same.append(w2 == win)
            near.append(W.dist(win, w2) <= 300)
            sbarri.append(W.barri[w2] == W.barri[win])
    print(f"- the same building: {np.mean(same):.0%}; within 300 m: {np.mean(near):.0%}; "
          f"the same barri: {np.mean(sbarri):.0%}")

    # 5. Friends and couples
    print("\n## 5. Two people (3,000 pairs)")
    d_pair, same_b, joint_is_one, d_joint = [], 0, 0, []
    for _ in range(3000):
        a, b = users[rng.integers(len(users))], users[rng.integers(len(users))]
        d_pair.append(W.dist(a[3], b[3]))
        same_b += W.barri[a[3]] == W.barri[b[3]]
        joint = list(dict.fromkeys(itertools.chain.from_iterable(zip(a[1], b[1]))))
        wj, _, _ = W.funnel(joint, a[2] and b[2])
        joint_is_one += wj in (a[3], b[3])
        d_joint.append((W.dist(wj, a[3]) + W.dist(wj, b[3])) / 2)
    d_pair = np.array(d_pair)
    print(f"- two friends: median {np.median(d_pair) / 1000:.1f} km apart; same barri {same_b / 30:.0f}%; "
          f"under 1 km {np.mean(d_pair < 1000):.0%}")
    print(f"- a couple (wishes taken in turns): the joint building is one of their own {joint_is_one / 30:.0f}%; "
          f"median {np.median(d_joint) / 1000:.1f} km from each partner's own")

    # 6. The whole space: every ordered set of 5 wishes, without and with the sea
    if not args.skip_exhaustive:
        allw = collections.Counter()
        for sea in (False, True):
            for order in itertools.permutations(W.names, 5):
                rest = [c for c in W.names if c not in order]
                allw[W.funnel(list(order) + rest, sea)[0]] += 1
        tot = sum(allw.values())
        c = concentration(allw, tot)
        b = collections.Counter()
        for i, n in allw.items():
            b[W.barri[i]] += n
        print(f"\n## 6. The whole space: {tot} ordered sets of 5 wishes (± sea)")
        print(f"- distinct buildings: {c['distinct']}; effective {c['effective']:.0f}; most frequent {c['top1']:.2%}; "
              f"barris {len(b)}")

    print(f"\n({time.time() - t0:.0f} s)")


if __name__ == "__main__":
    main()
