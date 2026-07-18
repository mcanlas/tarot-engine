import assert from "node:assert/strict";
import test from "node:test";

import {
  initialModel,
  update,
} from "../../main/resources/final-fantasy-core.js";

test("next-game advances and wraps the selected game", () => {
  const second = update(initialModel, { type: "next-game" }, 2);
  const wrapped = update(second, { type: "next-game" }, 2);

  assert.deepEqual(second, { selectedIndex: 1 });
  assert.deepEqual(wrapped, { selectedIndex: 0 });
});

test("unknown events leave the model unchanged", () => {
  const next = update(initialModel, { type: "unknown" }, 3);

  assert.equal(next, initialModel);
});
