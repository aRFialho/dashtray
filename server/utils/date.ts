export type MonthParts = { year: number; month: number };

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

type DateTimeParts = MonthParts & {
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function numericParts(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
}

/** Converte uma data/hora sem offset, interpretada no fuso informado, para UTC. */
export function zonedDateTimeToUtc(input: DateTimeParts, timeZone = DEFAULT_TIMEZONE): Date {
  const desiredUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second
  );

  let candidate = new Date(desiredUtc);

  // Duas passagens resolvem diferenças de offset e transições de horário de verão.
  for (let pass = 0; pass < 2; pass += 1) {
    const shown = numericParts(candidate, timeZone);
    const shownAsUtc = Date.UTC(
      shown.year ?? input.year,
      (shown.month ?? input.month) - 1,
      shown.day ?? input.day,
      shown.hour ?? input.hour,
      shown.minute ?? input.minute,
      shown.second ?? input.second
    );
    candidate = new Date(candidate.getTime() + (desiredUtc - shownAsUtc));
  }

  return candidate;
}

export function currentMonth(
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  now = new Date()
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) throw new Error("Não foi possível determinar o mês atual.");
  return `${year}-${month}`;
}

export function currentDay(
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  now = new Date()
): number {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, day: "2-digit" }).format(now);
  return Number(day);
}

export function currentDateParts(
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  now = new Date()
): MonthParts & { day: number } {
  const parts = numericParts(now, timeZone);
  return {
    year: parts.year ?? now.getUTCFullYear(),
    month: parts.month ?? now.getUTCMonth() + 1,
    day: parts.day ?? now.getUTCDate()
  };
}

export function dayInTimeZone(date: Date, timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE): number {
  return numericParts(date, timeZone).day ?? date.getUTCDate();
}

export function parseMonthKey(value: string): MonthParts {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error("Mês inválido. Use YYYY-MM.");
  }

  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (month < 1 || month > 12) throw new Error("Mês inválido.");
  return { year, month };
}

export function monthKey({ year, month }: MonthParts): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthRangeUtc(
  { year, month }: MonthParts,
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE
): { start: Date; end: Date } {
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    start: zonedDateTimeToUtc({ year, month, day: 1, hour: 0, minute: 0, second: 0 }, timeZone),
    end: zonedDateTimeToUtc({ ...next, day: 1, hour: 0, minute: 0, second: 0 }, timeZone)
  };
}

export function trayMonthRange({ year, month }: MonthParts): { startDate: string; endDate: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  };
}



export function todayRangeUtc(
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  now = new Date()
): { start: Date; end: Date } {
  const today = currentDateParts(timeZone, now);
  const totalDays = daysInMonth(today);
  const nextDay = today.day < totalDays
    ? { year: today.year, month: today.month, day: today.day + 1 }
    : today.month === 12
      ? { year: today.year + 1, month: 1, day: 1 }
      : { year: today.year, month: today.month + 1, day: 1 };

  return {
    start: zonedDateTimeToUtc({ ...today, hour: 0, minute: 0, second: 0 }, timeZone),
    end: zonedDateTimeToUtc({ ...nextDay, hour: 0, minute: 0, second: 0 }, timeZone)
  };
}

export function trayTodayRange(
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  now = new Date()
): { startDate: string; endDate: string } {
  const today = currentDateParts(timeZone, now);
  const date = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
  return { startDate: date, endDate: `${date} 23:59:59` };
}

export type AutomaticSyncPhase = "closed" | "opening" | "intraday" | "closing";

export function automaticSyncPhase(
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  now = new Date()
): AutomaticSyncPhase {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
  if (weekday === "Sat" || weekday === "Sun") return "closed";

  const parts = numericParts(now, timeZone);
  const minutes = (parts.hour ?? 0) * 60 + (parts.minute ?? 0);
  const opening = 7 * 60 + 42;
  const closing = 18 * 60;

  if (minutes === opening) return "opening";
  if (minutes === closing) return "closing";
  if (minutes > opening && minutes < closing && (minutes - opening) % 3 === 0) return "intraday";
  return "closed";
}

export function isAutomaticSyncWindow(
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  now = new Date()
): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const parts = numericParts(now, timeZone);
  const minutes = (parts.hour ?? 0) * 60 + (parts.minute ?? 0);
  return minutes >= 7 * 60 + 42 && minutes < 18 * 60;
}

export function liveMonthRangeUtc(
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  now = new Date()
): { start: Date; end: Date; monthEnd: Date } {
  const today = currentDateParts(timeZone, now);
  const totalDays = daysInMonth(today);
  const nextDay = today.day < totalDays
    ? { year: today.year, month: today.month, day: today.day + 1 }
    : today.month === 12
      ? { year: today.year + 1, month: 1, day: 1 }
      : { year: today.year, month: today.month + 1, day: 1 };
  const nextMonth = today.month === 12
    ? { year: today.year + 1, month: 1 }
    : { year: today.year, month: today.month + 1 };

  return {
    start: zonedDateTimeToUtc({ ...today, day: 1, hour: 0, minute: 0, second: 0 }, timeZone),
    end: zonedDateTimeToUtc({ ...nextDay, hour: 0, minute: 0, second: 0 }, timeZone),
    monthEnd: zonedDateTimeToUtc({ ...nextMonth, day: 1, hour: 0, minute: 0, second: 0 }, timeZone)
  };
}

export function trayLiveMonthRange(
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  now = new Date()
): { startDate: string; endDate: string } {
  const today = currentDateParts(timeZone, now);
  const month = String(today.month).padStart(2, "0");
  const day = String(today.day).padStart(2, "0");
  return {
    startDate: `${today.year}-${month}-01`,
    endDate: `${today.year}-${month}-${day} 23:59:59`
  };
}

export function daysInMonth({ year, month }: MonthParts): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseTrayDate(
  date: string | undefined,
  hour?: string | undefined,
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE
): Date {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Data de pedido inválida recebida da Tray: ${date ?? "vazia"}`);
  }

  const [yearText, monthText, dayText] = date.split("-");
  const safeHour = hour && /^\d{2}:\d{2}:\d{2}$/.test(hour) ? hour : "12:00:00";
  const [hourText, minuteText, secondText] = safeHour.split(":");

  return zonedDateTimeToUtc(
    {
      year: Number(yearText),
      month: Number(monthText),
      day: Number(dayText),
      hour: Number(hourText),
      minute: Number(minuteText),
      second: Number(secondText)
    },
    timeZone
  );
}

export function parseTrayDateTime(
  value: string | undefined,
  timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE
): Date | null {
  if (!value || value.startsWith("0000-00-00")) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return zonedDateTimeToUtc(
    {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
      second: Number(match[6])
    },
    timeZone
  );
}
