/** Format integer minor units without ever rounding through a JS Number. */
export function formatMinorAmount(value: string, currency: string) {
  if (!/^-?[0-9]+$/.test(value) || !/^[A-Z]{3}$/.test(currency))
    throw new Error("Invalid money");
  const digits =
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  const negative = value.startsWith("-");
  const amount = BigInt(value);
  const absolute = negative ? -amount : amount;
  const unit = BigInt(10) ** BigInt(digits);
  const whole = (absolute / unit).toLocaleString("en-NG");
  return `${currency} ${negative ? "-" : ""}${whole}${digits ? "." + (absolute % unit).toString().padStart(digits, "0") : ""}`;
}
export function safeCsvCell(value: string) {
  const safe = /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(value)
    ? "'" + value
    : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

/** Parse user-entered decimal currency without Number/parseFloat. */
export function parseMoneyAmount(value: string, currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) throw Error("Choose a valid currency.");
  const digits =
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  const pattern = digits
    ? new RegExp(`^[0-9]+(?:\\.[0-9]{1,${digits}})?$`)
    : /^[0-9]+$/;
  if (!pattern.test(value) || value.length > 20)
    throw Error("Enter an amount with the correct currency precision.");
  const [whole, fraction = ""] = value.split(".");
  const result =
    BigInt(whole) * BigInt(10) ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, "0") || "0");
  if (result <= BigInt(0) || result > BigInt("1000000000000"))
    throw Error("Enter a positive amount within the supported limit.");
  return result.toString();
}
