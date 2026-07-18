import {
  generatePartyCombinations,
  jobClasses,
} from "/final-fantasy-core.js";

const partyCount = document.querySelector("#party-count");
const partyRows = document.querySelector("#party-combinations");
const parties = generatePartyCombinations();
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

partyCount.textContent = `${parties.length} unique parties`;
partyRows.replaceChildren(rows);
