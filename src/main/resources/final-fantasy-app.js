import { initialModel, update } from "/final-fantasy-core.js";

const games = ["Final Fantasy I", "Final Fantasy IV", "Final Fantasy VI"];
const selectedGame = document.querySelector("#selected-game");
const nextGame = document.querySelector("#next-game");

let model = initialModel;

nextGame.addEventListener("click", () => {
  model = update(model, { type: "next-game" }, games.length);
  selectedGame.textContent = games[model.selectedIndex];
});
