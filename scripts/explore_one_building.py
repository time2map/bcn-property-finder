#!/usr/bin/env python3
"""
Exploration for TODO-076 ("find your one building"): if a person ranks what matters by importance, how many
different buildings come out first, where are they, how many ties, how big is the Pareto front?

Not the app's scoring (which checks thresholds): each criterion is a continuous "goodness" of a building, turned into
its percentile among the buildings of Barcelona city (so criteria in minutes, dB and euros are comparable), and the
score is the weighted mean of percentiles with weights from importance levels. The winner is the argmax.

  python3 scripts/explore_one_building.py [--runs 5000] [--seed 1]            weighted sum of importance levels
  python3 scripts/explore_one_building.py --funnel [--exclude locals] [--runs 2000]   the 5-step funnel

Reads the shipped blob (frontend/public/data). Prints a report; changes nothing.
"""

import argparse
import collections
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import building_blob as bb  # noqa: E402

LEVELS = {"very": 3, "important": 2, "nice": 1}  # "don't care" = 0, the criterion is left out


def load():
    meta = json.loads((bb.PUBLIC / "buildings-meta.json").read_text())
    cols = {}
    for name, kind, scale, arr in bb.read_columns(bb.PUBLIC, meta):
        if kind == "f32":
            cols[name] = arr.astype(float)
            continue
        sentinel = bb.U8 if kind == "u8" else bb.U16
        v = arr.astype(float)
        v[arr == sentinel] = np.nan
        cols[name] = v / scale
    vibe = json.loads((bb.PUBLIC / "barri-vibe.json").read_text())["barris"]
    return meta, cols, vibe


def criteria(meta, cols, vibe):
    """Barcelona-city residential buildings → (mask, {criterion: goodness, higher is better, NaN = no data})."""
    areas = meta["areas"]
    area = cols["area"]
    is_barri = np.array([not np.isnan(a) and areas[int(a)]["kind"] == "barri" for a in area])
    mask = is_barri & (np.nan_to_num(cols["dwellings"]) > 0)
    price = np.array([areas[int(a)]["price"] if not np.isnan(a) and areas[int(a)]["price"] is not None else np.nan
                      for a in area], dtype=float)
    satisf = np.array([vibe.get(areas[int(a)]["code"], {}).get("satisfAdj", np.nan) if not np.isnan(a) and
                       areas[int(a)]["kind"] == "barri" else np.nan for a in area])
    noise = np.where(np.isnan(cols["lden_street"]), cols["lden_avg"], cols["lden_street"])
    cc = np.vstack([cols[f"cc_{l}"] for l in ("placa_cat", "barri_gotic", "pg_gracia")])
    # a wish of several services counts the farthest; one out of reach makes the wish missing (TODO-076)
    m = lambda *names: np.max(np.vstack([cols[f"min_{n}"] for n in names]), axis=0)  # noqa: E731
    crit = {
        "cheap": -price,
        "quiet": -noise,
        "centre": -np.nanmin(cc, axis=0),
        "metro": -cols["min_metro"],
        "park": -cols["min_park"],
        "shops": -m("supermarket", "pharmacy"),
        "schools": -m("school", "kindergarten"),
        "bars": -m("cafe", "restaurant"),
        "sea": -cols["min_beach"],
        "health": -cols["min_clinic"],
        "new": cols["year_built"],
        "locals": satisf,
    }
    return mask, {k: v[mask] for k, v in crit.items()}, {k: v[mask] for k, v in
                                                         {"area": area, "lng": cols["lng"], "lat": cols["lat"],
                                                          "dwellings": cols["dwellings"], "noise": noise,
                                                          "year": cols["year_built"], "price": price}.items()}


def percentile(v):
    """0..1, ties share their mean rank, NaN (no data / out of reach) → 0."""
    out = np.zeros(len(v))
    ok = ~np.isnan(v)
    order = v[ok].argsort(kind="stable")
    ranks = np.empty(ok.sum())
    ranks[order] = np.arange(ok.sum())
    # mean rank of ties
    vals = v[ok]
    uniq, inv = np.unique(vals, return_inverse=True)
    sums = np.bincount(inv, ranks)
    cnt = np.bincount(inv)
    ranks = (sums / cnt)[inv]
    out[ok] = ranks / max(ok.sum() - 1, 1)
    return out


def pareto_size(mat, cap=200_000):
    """Number of non-dominated rows of mat (n × k, higher is better). Simple block filter."""
    idx = np.lexsort(-mat.T[::-1])  # sort desc by first column, then the next
    front = []
    for i in idx:
        r = mat[i]
        if front:
            F = mat[front]
            if np.any(np.all(F >= r, axis=1) & np.any(F > r, axis=1)):
                continue
        front.append(i)
        if len(front) > cap:
            break
    return len(front)


FUNNEL_STEPS = 5
FUNNEL_TARGET = 2.0  # buildings left after the last step (aim)
FUNNEL_STRICTNESS = (3, 2.5, 2, 1.5, 1)  # share of the remaining narrowing taken by each step: the first is strictest
MIN_DWELLINGS = 4


def funnel_step_share(alive, step):
    """Share of the buildings still in play that this step keeps, so that the last step ends near the target."""
    rest = FUNNEL_STRICTNESS[step:]
    k = (FUNNEL_TARGET / alive) ** (rest[0] / sum(rest))
    return min(max(k, 1 / alive), 1.0)


def run_funnel(args, rng):
    meta, cols, vibe = load()
    mask, crit, info = criteria(meta, cols, vibe)
    names = [c for c in crit if c != "sea" and c not in args.exclude]
    V = {k: np.where(np.isnan(v), -np.inf, v) for k, v in crit.items()}
    P = {k: percentile(v) for k, v in crit.items()}
    base = np.flatnonzero(info["dwellings"] >= MIN_DWELLINGS)
    sea_ok = ~np.isnan(crit["sea"])
    barri_of = np.array([meta["areas"][int(a)]["name"] for a in info["area"]])
    finals, wins, barris, firsts = [], collections.Counter(), collections.Counter(), []
    for _ in range(args.runs):
        alive = base[sea_ok[base]] if rng.random() < 0.15 else base  # the sea is a yes / no gate
        pool, used, step = list(rng.permutation(names)), [], 0
        while step < FUNNEL_STEPS and pool and len(alive) > 1:
            c = pool.pop(0)
            k = funnel_step_share(len(alive), step)
            v = V[c][alive]
            nxt = alive[v >= np.quantile(v, 1 - k, method="higher")]
            if len(nxt) > 0.9 * len(alive):
                continue  # cannot cut the buildings left: not offered
            if step == 0:
                firsts.append(k)
            alive, step = nxt, step + 1
            used.append(c)
        s = sum((FUNNEL_STEPS - j) * P[c][alive] for j, c in enumerate(used))
        win = alive[np.argmax(s)]
        finals.append(len(alive))
        wins[win] += 1
        barris[barri_of[win]] += 1
    f = np.array(finals)
    print(f"Funnel, {FUNNEL_STEPS} steps, strictness {FUNNEL_STRICTNESS}, excluded {args.exclude or '-'}, "
          f"buildings with ≥ {MIN_DWELLINGS} dwellings: {len(base)}")
    print(f"left after the last step: 1: {np.mean(f == 1):.0%}, 2–3: {np.mean((f > 1) & (f <= 3)):.0%}, "
          f"4–5: {np.mean((f > 3) & (f <= 5)):.0%}, more: {np.mean(f > 5):.0%}; first step keeps {np.median(firsts):.1%}")
    print(f"distinct winners {len(wins)} in {len(barris)} barris; top building {wins.most_common(1)[0][1] / args.runs:.1%}")
    print("barris: " + ", ".join(f"{b} {c / args.runs:.0%}" for b, c in barris.most_common(6)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=5000)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--funnel", action="store_true")
    ap.add_argument("--exclude", nargs="*", default=[])
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    if args.funnel:
        run_funnel(args, rng)
        return

    meta, cols, vibe = load()
    mask, crit, info = criteria(meta, cols, vibe)
    names = list(crit)
    P = np.vstack([percentile(crit[k]) for k in names]).T  # n × k
    n = len(P)
    areas = meta["areas"]
    barri_of = np.array([areas[int(a)]["name"] for a in info["area"]])
    print(f"Barcelona-city residential buildings: {n}")
    for k in names:
        v = crit[k]
        print(f"  {k:8s} no data {np.isnan(v).mean() * 100:5.1f}%  distinct values {len(np.unique(v[~np.isnan(v)]))}")

    def run(weights):
        s = P @ weights / weights.sum()
        best = s.max()
        winners = np.flatnonzero(s >= best - 1e-9)
        near = np.flatnonzero(s >= best - 0.01)
        return s, best, winners, near

    def experiment(label, pool, k_range, force=None):
        win_count = collections.Counter()
        barri_count = collections.Counter()
        ties, near_sizes, near_barris, bests = [], [], [], []
        for _ in range(args.runs):
            k = rng.integers(k_range[0], k_range[1] + 1)
            chosen = list(rng.choice(pool, size=k, replace=False))
            w = np.zeros(len(names))
            for c in chosen:
                w[names.index(c)] = rng.choice([1, 2, 3])
            if force:
                for c, lvl in force.items():
                    w[names.index(c)] = lvl
            s, best, winners, near = run(w)
            # tie-break: the most dwellings, then the lowest row (deterministic)
            win = winners[np.argmax(info["dwellings"][winners])]
            win_count[win] += 1
            barri_count[barri_of[win]] += 1
            ties.append(len(winners))
            near_sizes.append(len(near))
            near_barris.append(len(set(barri_of[near])))
            bests.append(best)
        top = win_count.most_common(10)
        print(f"\n## {label}  ({args.runs} runs)")
        print(f"distinct winning buildings: {len(win_count)}; in {len(barri_count)} barris")
        print(f"share of runs won by the top 1 / top 10 buildings: {top[0][1] / args.runs * 100:.1f}% / "
              f"{sum(c for _, c in top) / args.runs * 100:.1f}%")
        print(f"exact ties at the top: median {np.median(ties):.0f}, p90 {np.percentile(ties, 90):.0f}, "
              f"max {max(ties)}; runs with a tie: {np.mean(np.array(ties) > 1) * 100:.0f}%")
        print(f"buildings within 1 point of the best: median {np.median(near_sizes):.0f}, "
              f"p90 {np.percentile(near_sizes, 90):.0f}; in median {np.median(near_barris):.0f} barris")
        print(f"best score (0–100): median {np.median(bests) * 100:.1f}, min {min(bests) * 100:.1f}")
        print("top barris of the winner: " + ", ".join(f"{b} {c / args.runs * 100:.0f}%"
                                                        for b, c in barri_count.most_common(8)))
        print("most frequent winners:")
        for i, c in top[:5]:
            print(f"  {c / args.runs * 100:4.1f}%  {barri_of[i]:32s} {info['lat'][i]:.5f},{info['lng'][i]:.5f}  "
                  f"dwellings {info['dwellings'][i]:.0f}  noise {info['noise'][i]:.1f} dB  year {info['year'][i]:.0f}")
        return win_count

    all_c = names
    no_price = [c for c in names if c != "cheap"]
    experiment("All criteria, 3–6 chosen, levels 1–3", all_c, (3, 6))
    experiment("Without price, 3–6 chosen", no_price, (3, 6))
    experiment("Price 'very important' + 2–5 others", no_price, (2, 5), force={"cheap": 3})
    experiment("Everything chosen (12 criteria), random levels", all_c, (12, 12))

    # Barri price ranks for the price experiment
    cheapest = sorted((a for a in areas if a["kind"] == "barri"), key=lambda a: a["price"])[:10]
    print("\n10 cheapest barris: " + ", ".join(a["name"] for a in cheapest))

    # Sensitivity: change one level by one step, does the winner change?
    changed = 0
    for _ in range(1000):
        k = rng.integers(3, 7)
        chosen = rng.choice(len(names), size=k, replace=False)
        w = np.zeros(len(names))
        w[chosen] = rng.choice([1, 2, 3], size=k)
        _, _, w1, _ = run(w)
        j = rng.choice(chosen)
        w2 = w.copy()
        w2[j] = max(1, min(3, w[j] + rng.choice([-1, 1]))) if w[j] in (1, 3) else w[j] + rng.choice([-1, 1])
        _, _, v1, _ = run(w2)
        changed += set(w1) != set(v1)
    print(f"\nSensitivity: one level moved by one step changes the winner in {changed / 10:.0f}% of 1000 runs")

    # Pareto front size for a few typical sets
    for combo in (["quiet", "centre", "metro"], ["quiet", "centre", "metro", "park", "shops"],
                  ["cheap", "quiet", "centre", "metro", "park", "shops", "bars", "locals"]):
        sub = P[:, [names.index(c) for c in combo]]
        print(f"Pareto front, {len(combo)} criteria ({', '.join(combo)}): {pareto_size(sub)} buildings")


if __name__ == "__main__":
    main()
