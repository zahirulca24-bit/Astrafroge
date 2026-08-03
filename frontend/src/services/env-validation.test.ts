import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "..", "..");

describe("production environment validation", () => {
  it(".env.example exists and contains VITE_API_BASE_URL", () => {
    const content = fs.readFileSync(path.join(projectRoot, ".env.example"), "utf-8");
    expect(content).toMatch(/VITE_API_BASE_URL/);
  });

  it(".env.example contains VITE_SUPABASE_URL", () => {
    const content = fs.readFileSync(path.join(projectRoot, ".env.example"), "utf-8");
    expect(content).toMatch(/VITE_SUPABASE_URL/);
  });

  it(".env.example does not contain secrets", () => {
    const envExample = path.join(projectRoot, ".env.example");
    const content = fs.readFileSync(envExample, "utf-8");
    const nonCommentLines = content.split("\n").filter((line) => !line.trim().startsWith("#"));
    const nonCommentContent = nonCommentLines.join("\n");
    expect(nonCommentContent).not.toMatch(/SECRET|PRIVATE_KEY|API_SECRET/i);
  });
});

describe("render configuration", () => {
  it("render.yaml exists and uses npm ci", () => {
    const content = fs.readFileSync(path.join(projectRoot, "render.yaml"), "utf-8");
    expect(content).toMatch(/npm ci && npm run build/);
  });

  it("render.yaml publishes to dist", () => {
    const content = fs.readFileSync(path.join(projectRoot, "render.yaml"), "utf-8");
    expect(content).toMatch(/staticPublishPath: \.\/dist/);
  });

  it("render.yaml has SPA rewrite to index.html", () => {
    const content = fs.readFileSync(path.join(projectRoot, "render.yaml"), "utf-8");
    expect(content).toMatch(/destination: \/index\.html/);
  });

  it("render.yaml has security headers", () => {
    const content = fs.readFileSync(path.join(projectRoot, "render.yaml"), "utf-8");
    expect(content).toMatch(/X-Content-Type-Options/);
    expect(content).toMatch(/X-Frame-Options/);
    expect(content).toMatch(/Referrer-Policy/);
    expect(content).toMatch(/Strict-Transport-Security/);
  });
});

describe("project identity", () => {
  it("index.html has AstraForge title", () => {
    const content = fs.readFileSync(path.join(projectRoot, "index.html"), "utf-8");
    expect(content).toMatch(/AstraForge/);
  });

  it("index.html does not reference Google AI Studio", () => {
    const content = fs.readFileSync(path.join(projectRoot, "index.html"), "utf-8");
    expect(content).not.toMatch(/Google AI Studio/i);
  });

  it("metadata.json has AstraForge name", () => {
    const content = fs.readFileSync(path.join(projectRoot, "metadata.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.name).toMatch(/AstraForge/);
  });
});

describe("lazy loading", () => {
  it("App.tsx uses lazy imports for pages", () => {
    const content = fs.readFileSync(path.join(projectRoot, "src", "App.tsx"), "utf-8");
    expect(content).toMatch(/lazy\(/);
    expect(content).toMatch(/Suspense/);
  });

  it("App.tsx lazy loads at least 5 pages", () => {
    const content = fs.readFileSync(path.join(projectRoot, "src", "App.tsx"), "utf-8");
    const lazyCount = (content.match(/lazy\(/g) || []).length;
    expect(lazyCount).toBeGreaterThanOrEqual(5);
  });
});

describe("TypeScript strictness", () => {
  it("tsconfig.json has strict enabled", () => {
    const content = fs.readFileSync(path.join(projectRoot, "tsconfig.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.compilerOptions.strict).toBe(true);
  });

  it("tsconfig.json has noImplicitAny enabled", () => {
    const content = fs.readFileSync(path.join(projectRoot, "tsconfig.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.compilerOptions.noImplicitAny).toBe(true);
  });

  it("tsconfig.json has noUncheckedIndexedAccess enabled", () => {
    const content = fs.readFileSync(path.join(projectRoot, "tsconfig.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });
});
