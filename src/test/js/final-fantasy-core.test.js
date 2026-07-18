import assert from "node:assert/strict";
import test from "node:test";

import {
  filterPartiesByRequiredJobs,
  generateParties,
  jobClasses,
} from "../../main/resources/final-fantasy-core.js";

const parties = generateParties(4, "unique-parties");
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
      generateParties(partySize, "unique-parties").length
    ),
    [6, 21, 56, 126],
  );
});

test("all formations generates every sequence with repetition", () => {
  const formations = generateParties(4, "all-formations");

  assert.equal(formations.length, 1296);
  assert.deepEqual(formations.slice(0, 8).map(asDigits), [
    "1111",
    "1112",
    "1113",
    "1114",
    "1115",
    "1116",
    "1121",
    "1122",
  ]);
  assert.equal(new Set(formations.map(asDigits)).size, 1296);
});

test("all formations generates the expected count for every party size", () => {
  assert.deepEqual(
    [1, 2, 3, 4].map((partySize) =>
      generateParties(partySize, "all-formations").length
    ),
    [6, 36, 216, 1296],
  );
});

test("rejects unsupported party sizes", () => {
  assert.throws(() => generateParties(0, "unique-parties"), RangeError);
  assert.throws(() => generateParties(5, "unique-parties"), RangeError);
  assert.throws(() => generateParties(2.5, "unique-parties"), RangeError);
});

test("rejects unsupported party styles", () => {
  assert.throws(() => generateParties(4, "something-else"), RangeError);
});

test("has filters apply additively", () => {
  const allParties = generateParties(4, "all-formations");
  const atLeastOneWhite = filterPartiesByRequiredJobs(allParties, [4]);
  const atLeastTwoWhite = filterPartiesByRequiredJobs(allParties, [4, 4]);

  assert(atLeastOneWhite.length > atLeastTwoWhite.length);
  assert(
    atLeastTwoWhite.every(
      (party) => party.filter((member) => member === 4).length >= 2,
    ),
  );
});

test("empty has filters keep every party", () => {
  const allParties = generateParties(3, "all-formations");
  const filtered = filterPartiesByRequiredJobs(allParties, []);

  assert.equal(filtered.length, allParties.length);
});
