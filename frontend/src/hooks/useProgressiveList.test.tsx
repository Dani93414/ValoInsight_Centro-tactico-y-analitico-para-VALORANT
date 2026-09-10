import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useProgressiveList } from "./useProgressiveList";

// Exercise React's state transitions without requiring a browser DOM.
function ListScenario({ scenario }: { scenario: "initial" | "more" | "reveal" | "filter" | "batch" }) {
  const [step, setStep] = useState(0);
  const items = [0, 1, 2, 3, 4];
  const { visibleItems, hasMore, showMore, revealThrough } = useProgressiveList(
    items,
    scenario === "filter" && step > 0 ? "filtered" : "all",
    scenario === "batch" && step > 0 ? 3 : 2,
  );
  if (step === 0 && scenario !== "initial") {
    if (scenario === "more") {
      showMore();
      showMore();
      showMore();
    } else {
      revealThrough(4);
    }
    setStep(1);
  }
  return <output>{visibleItems.join(",")}|{hasMore ? "more" : "end"}</output>;
}

describe("Carga progresiva de catálogos", () => {
  it("muestra el bloque inicial y permite acceder a más elementos", () => {
    expect(renderToStaticMarkup(<ListScenario scenario="initial" />)).toContain("0,1|more");
  });
  it("amplía la lista sin superar su longitud al pedir varios bloques", () => {
    expect(renderToStaticMarkup(<ListScenario scenario="more" />)).toContain("0,1,2,3,4|end");
  });
  it("revela un elemento seleccionado que estaba fuera del bloque visible", () => {
    expect(renderToStaticMarkup(<ListScenario scenario="reveal" />)).toContain("0,1,2,3,4|end");
  });
  it("reinicia el bloque visible cuando cambia el filtro", () => {
    expect(renderToStaticMarkup(<ListScenario scenario="filter" />)).toContain("0,1|more");
  });
  it("reinicia la lista con el nuevo tamaño de bloque", () => {
    expect(renderToStaticMarkup(<ListScenario scenario="batch" />)).toContain("0,1,2|more");
  });
});
