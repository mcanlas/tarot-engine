export const jobClasses = Object.freeze([
  Object.freeze({ name: "Warrior", cssClass: "job-warrior" }),
  Object.freeze({ name: "Thief", cssClass: "job-thief" }),
  Object.freeze({ name: "Black Belt", cssClass: "job-black-belt" }),
  Object.freeze({ name: "Red Mage", cssClass: "job-red-mage" }),
  Object.freeze({ name: "White Mage", cssClass: "job-white-mage" }),
  Object.freeze({ name: "Black Mage", cssClass: "job-black-mage" }),
]);

export function generateParties(partySize, partyStyle) {
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 4) {
    throw new RangeError("Party size must be an integer from 1 through 4");
  }
  if (partyStyle !== "unique-parties" && partyStyle !== "all-formations") {
    throw new RangeError(
      "Party style must be unique-parties or all-formations",
    );
  }

  const parties = [];

  function appendParty(party, minimumJobIndex) {
    if (party.length === partySize) {
      parties.push(party);
      return;
    }

    const firstJobIndex =
      partyStyle === "unique-parties" ? minimumJobIndex : 0;

    for (let jobIndex = firstJobIndex; jobIndex < jobClasses.length; jobIndex += 1) {
      appendParty([...party, jobIndex], jobIndex);
    }
  }

  appendParty([], 0);
  return parties;
}
