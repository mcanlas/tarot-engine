import {
  generateParties,
  jobClasses,
} from "/final-fantasy-core.js";

const partyCount = document.querySelector("#party-count");
const partyRows = document.querySelector("#party-combinations");
const partyControls = document.querySelector("#party-controls");

function renderParties() {
  const formValues = new FormData(partyControls);
  const selectedPartySize = Number.parseInt(formValues.get("party-size"), 10);
  const partyStyle = formValues.get("party-style");
  const parties = generateParties(selectedPartySize, partyStyle);
  const rows = document.createDocumentFragment();

  parties.forEach((party, index) => {
    const row = document.createElement("tr");
    row.setAttribute("aria-label", `Party ${index + 1}`);

    party.forEach((jobIndex) => {
      const job = jobClasses[jobIndex];
      const cell = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = `job-pill ${job.cssClass}`;
      pill.textContent = job.name;
      cell.append(pill);
      row.append(cell);
    });

    rows.append(row);
  });

  partyCount.textContent =
    partyStyle === "unique-parties"
      ? `${parties.length} unique ${selectedPartySize}-member parties`
      : `${parties.length} ${selectedPartySize}-member formations`;
  partyRows.replaceChildren(rows);
}

partyControls.addEventListener("change", renderParties);
renderParties();
