export function aed(n: number): string {
  return `AED ${Math.round(n).toLocaleString("en-US")}`;
}
export function aedPerYear(n: number): string {
  return `${aed(n)}/year`;
}
