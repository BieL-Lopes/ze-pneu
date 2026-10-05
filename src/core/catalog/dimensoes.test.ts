import { describe, it, expect } from "vitest";
import { dimensoesDaCaixa } from "./dimensoes";

describe("dimensoesDaCaixa", () => {
  it("usa o diâmetro externo como lado e a largura como altura, com folga", () => {
    // 205/55 R16: aro 406,4 mm + 2 × 112,75 mm de flanco = 631,9 mm.
    expect(dimensoesDaCaixa({ width: 205, profile: 55, rim: 16 })).toEqual({
      lengthMm: 652,
      widthMm: 652,
      heightMm: 225,
    });
  });

  it("separa um aro 13 de um aro 24", () => {
    const pequeno = dimensoesDaCaixa({ width: 175, profile: 75, rim: 13 });
    const grande = dimensoesDaCaixa({ width: 305, profile: 35, rim: 24 });
    expect(pequeno.lengthMm).toBe(613);
    expect(grande.lengthMm).toBe(843);
    expect(grande.heightMm).toBe(325);
  });
});
