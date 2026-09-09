import assert from "node:assert/strict";
import { create, act } from "react-test-renderer";
import { CollectionGame } from "../src/games/collection";
import { COLLECTION } from "../src/data/collection";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const realInterval = globalThis.setInterval,
  realClear = globalThis.clearInterval;
const intervals = new Map<number, () => void>();
let id = 0;
globalThis.setInterval = ((fn: () => void) => {
  intervals.set(++id, fn);
  return id;
}) as any;
globalThis.clearInterval = ((n: number) => intervals.delete(n)) as any;
const events = new Map<string, Set<Function>>();
globalThis.window = {
  addEventListener: (name: string, fn: Function) => {
    if (!events.has(name)) events.set(name, new Set());
    events.get(name)!.add(fn);
  },
  removeEventListener: (name: string, fn: Function) =>
    events.get(name)?.delete(fn),
} as any;
const store = new Map();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) || null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
} as any;
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
const mock = (element: any) =>
  element.type === "canvas"
    ? {
        getContext: () => ctx,
        width: element.props.width,
        height: element.props.height,
      }
    : null;
const text = (node: any): string =>
  typeof node === "string"
    ? node
    : Array.isArray(node)
      ? node.map(text).join("")
      : node?.children
        ? text(node.children)
        : "";
const rooms = [
  "draw-guess",
  "multiplayer-ludo",
  "live-trivia",
  "trivia-battle",
];
const originalError = console.error;
console.error = (...args) => {
  if (String(args[0]).includes("react-test-renderer is deprecated")) return;
  originalError(...args);
};
try {
  for (const g of COLLECTION.filter((g) => !rooms.includes(g.slug))) {
    const results: any[] = [];
    const api = {
      slug: g.slug,
      muted: true,
      reduced: true,
      continues: 0,
      onContinue: () => false,
      onFinish: (r: any) => results.push(r),
    };
    let tree: any;
    await act(() => {
      tree = create(<CollectionGame api={api} paused={false} />, {
        createNodeMock: mock,
      });
    });
    const button = (label: string) =>
      tree.root
        .findAllByType("button")
        .find((b: any) => text(b).includes(label));
    const click = async (b: any) => {
      assert.ok(b, `Missing button for ${g.slug}`);
      await act(() => b.props.onClick());
    };
    if (g.slug === "solitaire") {
      await click(button("✦"));
      assert.match(text(tree.toJSON()), /1 moves/);
      await click(button("Undo"));
      assert.match(text(tree.toJSON()), /0 moves/);
    }
    if (g.slug === "spider-solitaire") {
      await click(button("✦"));
      assert.match(text(tree.toJSON()), /1 moves/);
    }
    if (g.slug === "rummy") {
      await click(button("Draw"));
      assert.equal(
        tree.root
          .findAllByType("button")
          .filter((b: any) => b.props["aria-label"]?.match(/^[A2-9JQK1]/))
          .length,
        12,
      );
      await click(
        tree.root
          .findAllByType("button")
          .find((b: any) => b.props["aria-label"]),
      );
    }
    if (g.slug === "chess") {
      await click(
        tree.root
          .findAllByType("button")
          .find((b: any) => b.props["aria-label"] === "e2 White p"),
      );
      await click(
        tree.root
          .findAllByType("button")
          .find((b: any) => b.props["aria-label"] === "e4 empty"),
      );
      assert.match(text(tree.toJSON()), /Black to move/);
    }
    if (g.slug === "ludo") {
      await click(button("Roll"));
      assert.match(text(tree.toJSON()), /rolled/);
    }
    if (g.slug === "sudoku") {
      const empty = tree.root
        .findAllByType("button")
        .find((b: any) => b.props["aria-label"]?.includes("empty"));
      await click(empty);
      const one = tree.root
        .findAllByType("button")
        .find(
          (b: any) =>
            text(b) === "1" && b.props.className === "btn btn-secondary",
        );
      await click(one);
    }
    if (g.slug === "crossword") {
      const answers = ["PLANET", "PLAY", "GAME", "NEON", "TIDE"];
      for (let i = 0; i < 5; i++) {
        await click(
          tree.root
            .findAllByType("button")
            .filter((b: any) => b.props.className === "clue-button")[i],
        );
        await act(() =>
          tree.root
            .findByType("input")
            .props.onChange({ target: { value: answers[i] } }),
        );
      }
      await click(button("Check puzzle"));
      assert.equal(results.at(-1)?.metric, "Crossword solved");
    }
    if (g.slug === "word-guess") {
      assert.equal(tree.root.findAllByProps({ role: "gridcell" }).length, 100);
      assert.equal(tree.root.findAllByType("input").length, 0);
      assert.match(text(tree.toJSON()), /Find all the words/);
    }
    if (g.slug === "memory-match") {
      await click(tree.root.findAllByType("button")[0]);
      await click(tree.root.findAllByType("button")[1]);
      assert.match(text(tree.toJSON()), /1 guesses/);
    }
    if (g.slug === "jigsaw") {
      const pieces = tree.root.findAllByType("button").filter((button: any) => button.props.className?.includes("jigsaw-piece"));
      await click(pieces[0]);
      await click(pieces[1]);
      assert.match(text(tree.toJSON()), /1 swaps/);
    }
    if (g.slug === "aim-trainer") {
      await click(button("◎"));
      assert.match(text(tree.toJSON()), /Hits 1/);
    }
    if (g.slug === "tower-defense") {
      await click(button("Pad 1"));
      await click(button("Start wave"));
    }
    if (
      ["general-knowledge", "sports-trivia", "movie-trivia"].includes(g.slug)
    ) {
      for (let i = 0; i < 10; i++) {
        await click(
          tree.root
            .findAllByType("button")
            .find((b: any) => b.props.className?.startsWith("quiz-option")),
        );
        await click(button(i === 9 ? "See results" : "Next question"));
      }
      assert.equal(results.length, 1);
    }
    if (g.slug === "idle-city") {
      await click(
        tree.root
          .findAllByType("button")
          .find((b: any) => b.props["aria-label"] === "Plot 1: Empty"),
      );
      assert.match(text(tree.toJSON()), /Residents 5/);
      assert.ok(store.has("bullwave-city-v1"));
    }
    if (g.slug === "tycoon") {
      await click(button("Open for the day"));
      assert.match(text(tree.toJSON()), /Day 2/);
    }
    if (g.slug === "territory-strategy") {
      await click(tree.root.findAllByType("button")[0]);
      assert.match(text(tree.toJSON()), /Reinforcements 2/);
      await click(button("End turn"));
      assert.match(text(tree.toJSON()), /Turn 2/);
    }
    // Exercise first-frame canvas drawing and timed state updates, then confirm pause removes timers.
    await act(() => {
      for (const fn of [...intervals.values()]) fn();
    });
    await act(() => tree.update(<CollectionGame api={api} paused={true} />));
    assert.equal(intervals.size, 0, `${g.slug} timer should stop on pause`);
    await act(() => tree.unmount());
    assert.equal(intervals.size, 0);
  }
  console.log(
    "PASS: 26 solo games mount, control actions, canvas first frames, quiz completion, crossword completion, local saves, and pause timer cleanup.",
  );
} finally {
  globalThis.setInterval = realInterval;
  globalThis.clearInterval = realClear;
  console.error = originalError;
}
