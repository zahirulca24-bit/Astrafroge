import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const srcDir = path.resolve(__dirname, "..");

function walk(dir: string, ext: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
      files.push(...walk(fullPath, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext) && !entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("no hardcoded backend URLs", () => {
  const sourceFiles = walk(srcDir, ".ts").concat(walk(srcDir, ".tsx"));

  it("contains no localhost references", () => {
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toMatch(/localhost/);
    }
  });

  it("contains no onrender.com references", () => {
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toMatch(/onrender\.com/);
    }
  });

  it("contains no hardcoded http:// or https:// backend URLs", () => {
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const matches = content.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi);
      if (matches) {
        for (const match of matches) {
          expect(match).toBe("https://fonts.googleapis.com");
        }
      }
    }
  });
});
