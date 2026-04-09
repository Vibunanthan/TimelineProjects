import { format, parse, differenceInDays, addDays, startOfMonth, endOfMonth, startOfWeek, eachMonthOfInterval, eachWeekOfInterval, isWeekend } from 'date-fns';

export function parseDate(dateStr: string): Date {
  return parse(dateStr, 'yyyy-MM-dd', new Date());
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDisplay(dateStr: string): string {
  const d = parseDate(dateStr);
  return format(d, 'MMM d, yyyy');
}

export function daysBetween(start: string, end: string): number {
  return differenceInDays(parseDate(end), parseDate(start));
}

export function addDaysToDate(dateStr: string, days: number): string {
  return formatDate(addDays(parseDate(dateStr), days));
}

export function todayStr(): string {
  return formatDate(new Date());
}

export function getMonthsInRange(start: Date, end: Date) {
  return eachMonthOfInterval({ start, end });
}

export function getWeeksInRange(start: Date, end: Date) {
  return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
}

export function getStartOfMonth(date: Date): Date {
  return startOfMonth(date);
}

export function getEndOfMonth(date: Date): Date {
  return endOfMonth(date);
}

export function getStartOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function isWeekendDay(date: Date): boolean {
  return isWeekend(date);
}

export function generateId(): string {
  return crypto.randomUUID();
}
