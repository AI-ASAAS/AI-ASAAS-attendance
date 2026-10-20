const pad = (n: number) => String(n).padStart(2, '0');

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const currentPeriod = () => today().slice(0, 7);

export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number) as [number, number];
  const index = year * 12 + month - 1 + months;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

export function periodBounds(period: string): { from: string; to: string } {
  const [year, month] = period.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${pad(lastDay)}` };
}
