const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export const money = (n: number) => usd0.format(Math.round(n));
export const moneyK = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${n < 0 ? "−" : ""}$${dec1.format(a / 1_000_000)}M`;
  if (a >= 10_000) return `${n < 0 ? "−" : ""}$${int.format(a / 1000)}k`;
  return money(n);
};
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Per-session amounts: $75.50, or $76 when there are no cents */
export const cents = (n: number) => (Math.round(n * 100) % 100 === 0 ? money(n) : usd2.format(n));
export const count = (n: number) => int.format(Math.round(n));
export const pct = (n: number) => `${dec1.format(n * 100)}%`;
export const signed = (n: number, f: (x: number) => string) => (n > 0 ? "+" : n < 0 ? "−" : "±") + f(Math.abs(n));
