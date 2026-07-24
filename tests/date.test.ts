import { describe, expect, it } from "vitest";
import {
  automaticSyncPhase,
  daysInMonth,
  isAutomaticSyncWindow,
  liveMonthRangeUtc,
  monthRangeUtc,
  parseMonthKey,
  parseTrayDate,
  todayRangeUtc,
  trayLiveMonthRange,
  trayMonthRange,
  trayTodayRange
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


  it("limita o período ao vivo do primeiro dia até o dia atual", () => {
    const now = new Date("2026-07-24T13:00:00.000Z");
    expect(trayLiveMonthRange("America/Sao_Paulo", now)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-24 23:59:59"
    });

    const range = liveMonthRangeUtc("America/Sao_Paulo", now);
    expect(range.start.toISOString()).toBe("2026-07-01T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-25T03:00:00.000Z");
    expect(range.monthEnd.toISOString()).toBe("2026-08-01T03:00:00.000Z");
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

  it("gera o intervalo rápido somente para o dia atual", () => {
    const now = new Date("2026-07-24T13:00:00.000Z");
    expect(trayTodayRange("America/Sao_Paulo", now)).toEqual({
      startDate: "2026-07-24",
      endDate: "2026-07-24 23:59:59"
    });
    const range = todayRangeUtc("America/Sao_Paulo", now);
    expect(range.start.toISOString()).toBe("2026-07-24T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-25T03:00:00.000Z");
  });

  it("limita a agenda automática ao expediente de segunda a sexta", () => {
    expect(automaticSyncPhase("America/Sao_Paulo", new Date("2026-07-24T10:42:00.000Z"))).toBe("opening");
    expect(automaticSyncPhase("America/Sao_Paulo", new Date("2026-07-24T10:45:00.000Z"))).toBe("intraday");
    expect(automaticSyncPhase("America/Sao_Paulo", new Date("2026-07-24T21:00:00.000Z"))).toBe("closing");
    expect(automaticSyncPhase("America/Sao_Paulo", new Date("2026-07-25T13:00:00.000Z"))).toBe("closed");
    expect(isAutomaticSyncWindow("America/Sao_Paulo", new Date("2026-07-24T13:00:00.000Z"))).toBe(true);
    expect(isAutomaticSyncWindow("America/Sao_Paulo", new Date("2026-07-24T21:01:00.000Z"))).toBe(false);
  });

});
