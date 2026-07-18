export const initialModel = Object.freeze({ selectedIndex: 0 });

export function update(model, event, gameCount) {
  if (event.type !== "next-game") return model;

  return {
    ...model,
    selectedIndex: (model.selectedIndex + 1) % gameCount,
  };
}
