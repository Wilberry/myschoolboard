import { describe, it, expect } from "vitest";
import {
  formatMinorAmount,
  safeCsvCell,
  parseMoneyAmount,
} from "./money-display";
describe("exact financial presentation", () => {
  it("preserves integers above JS floating precision and ISO currency precision", () => {
    expect(formatMinorAmount("9007199254740993", "NGN")).toBe(
      "NGN 90,071,992,547,409.93",
    );
    expect(formatMinorAmount("123", "JPY")).toBe("JPY 123");
    expect(formatMinorAmount("1234", "KWD")).toBe("KWD 1.234");
    expect(formatMinorAmount("1", "NGN")).toBe("NGN 0.01");
    expect(formatMinorAmount("-1", "NGN")).toBe("NGN -0.01");
    for (const bad of ["1.5", "NaN", "1e6", ""])
      expect(() => formatMinorAmount(bad, "NGN")).toThrow();
  });
  it("quotes CSV and neutralizes formula-leading cells", () => {
    for (const value of [
      '=HYPERLINK("https://example.test")',
      "+1",
      "-1",
      "@SUM(1)",
      "\t=1",
      "\r=1",
      "  =SUM(1)",
    ])
      expect(safeCsvCell(value)).toContain("'");
    expect(safeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(safeCsvCell("12345")).toBe('"12345"');
  });
  it("parses decimal user amounts exactly and rejects excess currency precision", () => {
    expect(parseMoneyAmount("123.45", "NGN")).toBe("12345");
    expect(parseMoneyAmount("123", "JPY")).toBe("123");
    expect(parseMoneyAmount("1.234", "KWD")).toBe("1234");
    for (const value of ["0", "-1", "1e5", "1.001", "1,000.00"])
      expect(() => parseMoneyAmount(value, "NGN")).toThrow();
  });
});
