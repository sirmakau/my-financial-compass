export const formatKES = (n: number, opts?: { signed?: boolean }) => {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(abs);
  if (opts?.signed) return `${n < 0 ? "-" : "+"}${formatted}`;
  return n < 0 ? `-${formatted}` : formatted;
};

export const formatNumber = (n: number) =>
  new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 }).format(n);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "2-digit" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

// Returns "YYYY-MM-DDTHH:mm" in the user's LOCAL timezone (Kenya = EAT, UTC+3)
// for use as the value of <input type="datetime-local">. Using toISOString()
// would yield UTC and display 3 hours behind local time.
export const toLocalInputValue = (d: Date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Convert an ISO/UTC datetime string to a local datetime-local input value.
export const isoToLocalInputValue = (iso: string) => toLocalInputValue(new Date(iso));
