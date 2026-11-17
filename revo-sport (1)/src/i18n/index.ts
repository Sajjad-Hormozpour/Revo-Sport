import catalog from "./catalog.json";
import { toEnglish, toPersian } from "./overrides";

export type Language = "fa" | "en";
export const LANGUAGE_KEY = "revo-lang";

export function currentLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "fa";
  } catch {
    return document.documentElement.lang === "en" ? "en" : "fa";
  }
}

export function currentDirection(): "rtl" | "ltr" {
  return currentLanguage() === "fa" ? "rtl" : "ltr";
}

function toLatinDigit(digit: string): string {
  const code = digit.codePointAt(0)!;
  return String(code >= 0x06F0 ? code - 0x06F0 : code - 0x0660);
}

export function localizeDigits(value: string | number): string {
  // The Revo Sport interface keeps clean Latin digits in both languages.
  return String(value).replace(/[\u06F0-\u06F9\u0660-\u0669]/g, toLatinDigit);
}
type Pattern = { expression: RegExp; order: number[]; translation: string };

function makePatterns(entries: Record<string, string>): Pattern[] {
  const result: Array<Pattern & { specificity: number }> = [];
  for (const [source, translation] of Object.entries(entries)) {
    const tokens = [...source.matchAll(/\{(\d+)\}/g)];
    if (!tokens.length || tokens.some((token) => !translation.includes(token[0]))) continue;
    const fixed = source.replace(/\{\d+\}/g, "");
    if (fixed.trim().length < 3) continue;
    let expression = "^";
    let cursor = 0;
    for (const token of tokens) {
      expression += source.slice(cursor, token.index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([\\s\\S]*?)";
      cursor = token.index! + token[0].length;
    }
    expression += source.slice(cursor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$";
    result.push({
      expression: new RegExp(expression),
      order: tokens.map((token) => Number(token[1])),
      translation,
      specificity: fixed.length,
    });
  }
  return result.sort((a, b) => b.specificity - a.specificity);
}

const persian = { ...catalog.en, ...toPersian };
const english = { ...catalog.fa, ...toEnglish };
const persianPatterns = makePatterns(persian);
const englishPatterns = makePatterns(english);

function translateString(value: string): string {
  const key = value.trim();
  if (!key) return value;
  const language = currentLanguage();
  const entries: Record<string, string> = language === "fa" ? persian : english;
  let result = entries[key];
  if (result === undefined) {
    for (const pattern of language === "fa" ? persianPatterns : englishPatterns) {
      const match = pattern.expression.exec(key);
      if (!match) continue;
      const values = new Map(pattern.order.map((index, position) => [index, match[position + 1]]));
      result = pattern.translation.replace(/\{(\d+)\}/g, (token, index: string) => values.get(Number(index)) ?? token);
      break;
    }
  }
  if (result === undefined) result = value;
  if (language === "fa") result = result.replace(/%/g, "%").replace(/٪/g, "%");
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return `${leading}${result}${trailing}`;
}

/** Translate interface copy at render time without changing stored values. */
export function localize<T>(value: T): T {
  if (typeof value === "string") return translateString(value) as T;
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? translateString(item) : item) as T;
  return value;
}

/** Static copy may also contain abbreviated units and training terminology. */
export function localizeStatic(value: string): string {
  const translated = translateString(value);
  if (currentLanguage() !== "fa") return translated;
  return translated
    .replace(/\bRPE\b/g, "شدت تمرین")
    .replace(/\bTempo\b/g, "ریتم حرکت")
    .replace(/\bBMI\b/g, "شاخص توده بدنی")
    .replace(/\bPR\b/g, "رکورد")
    .replace(/\bAI\b/g, "هوش مصنوعی")
    .replace(/٪/g, "%");
}