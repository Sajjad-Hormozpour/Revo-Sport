/** شماره موبایل ایران را به قالب 09xxxxxxxxx تبدیل می‌کند. */
export function normalizePhone(value: string): string {
  const digits = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\d+]/g, "");
  if (digits.startsWith("+98")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0098")) return `0${digits.slice(4)}`;
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}

export function isValidPhone(value: string): boolean {
  return /^09\d{9}$/.test(normalizePhone(value));
}

export function maskPhone(value: string): string {
  const phone = normalizePhone(value);
  return phone.length === 11 ? `${phone.slice(0, 4)}***${phone.slice(-4)}` : phone;
}