import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";

describe("buildCsv", () => {
  it("escapes commas, quotes, and line breaks", () => {
    const csv = buildCsv([
      ["Name", "Note"],
      ["BTC,USDT", 'He said "ready"\nnext line'],
    ]);

    expect(csv).toBe('Name,Note\r\n"BTC,USDT","He said ""ready""\nnext line"');
  });

  it("serializes nullish and object values safely", () => {
    const csv = buildCsv([[undefined, null, { status: "ok" }]]);
    expect(csv).toBe(',,"{""status"":""ok""}"');
  });
});
