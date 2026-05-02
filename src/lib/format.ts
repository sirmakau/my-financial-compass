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
