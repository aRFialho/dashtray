import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  monthRangeUtc,
  parseMonthKey,
  parseTrayDate,
  trayMonthRange
} from "../server/utils/date";

describe("month helpers", () => {
  it("valida o formato YYYY-MM", () => {
    expect(parseMonthKey("2026-07")).toEqual({ year: 2026, month: 7 });
    expect(() => parseMonthKey("07/2026")).toThrow();
  });

  it("calcula fevereiro bissexto", () => {
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29);
  });

  it("gera o intervalo da Tray", () => {
    expect(trayMonthRange({ year: 2026, month: 7 })).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-31"
    });
  });

  it("converte o mês de São Paulo para intervalo UTC exclusivo", () => {
    const range = monthRangeUtc({ year: 2026, month: 12 }, "America/Sao_Paulo");
    expect(range.start.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("interpreta a hora do pedido no fuso da loja", () => {
    expect(parseTrayDate("2026-07-24", "08:30:00", "America/Sao_Paulo").toISOString())
      .toBe("2026-07-24T11:30:00.000Z");
  });
});
