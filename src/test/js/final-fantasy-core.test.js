import assert from "node:assert/strict";
import test from "node:test";

import {
  generatePartyCombinations,
  jobClasses,
} from "../../main/resources/final-fantasy-core.js";

const parties = generatePartyCombinations(4);
const asDigits = (party) => party.map((jobIndex) => jobIndex + 1).join("");

test("generates the combinations in nondecreasing order", () => {
  assert.deepEqual(parties.slice(0, 8).map(asDigits), [
    "1111",
    "1112",
    "1113",
    "1114",
    "1115",
    "1116",
    "1122",
    "1123",
  ]);
  assert.equal(asDigits(parties.at(-1)), "6666");
});

test("generates all 126 unique four-job parties", () => {
  assert.equal(jobClasses.length, 6);
  assert.equal(parties.length, 126);
  assert.equal(new Set(parties.map(asDigits)).size, parties.length);

  for (const party of parties) {
    assert.equal(party.length, 4);
    assert.deepEqual(party, party.toSorted((a, b) => a - b));
  }
});

test("generates the expected number of parties for sizes one through four", () => {
  assert.deepEqual(
    [1, 2, 3, 4].map((partySize) =>
      generatePartyCombinations(partySize).length
    ),
    [6, 21, 56, 126],
  );
});

test("rejects unsupported party sizes", () => {
  assert.throws(() => generatePartyCombinations(0), RangeError);
  assert.throws(() => generatePartyCombinations(5), RangeError);
  assert.throws(() => generatePartyCombinations(2.5), RangeError);
});
