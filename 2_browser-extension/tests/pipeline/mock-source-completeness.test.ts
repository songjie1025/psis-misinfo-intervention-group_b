// The application tsconfig intentionally includes Chrome types only. Keep this Node-only test
// self-contained instead of widening the browser build's type environment.
declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("fs") as {
  readFileSync(path: string, encoding: string): string;
};
const { join } = require("path") as {
  join(...parts: string[]): string;
};

interface MockSource {
  publisher_name?: string;
  url?: string;
}

interface MockPost {
  id: number | string;
  verdicts?: {
    label?: string;
    sources?: MockSource[];
  };
}

const ACTIONABLE_LABELS = new Set(["FALSE", "MISLEADING", "DISPUTED"]);
const DATA_FILES = [
  "posts.json",
  "../3_mockup-website/mock-data/posts.json",
];

describe("mock fact-check source completeness", () => {
  it.each(DATA_FILES)("gives every actionable post in %s a named HTTPS source", (file) => {
    const posts = JSON.parse(
      readFileSync(join(process.cwd(), file), "utf8"),
    ) as MockPost[];

    const incomplete = posts
      .filter((post) => ACTIONABLE_LABELS.has(post.verdicts?.label ?? ""))
      .filter(
        (post) =>
          !(post.verdicts?.sources ?? []).some(
            (source) =>
              source.url?.startsWith("https://") &&
              Boolean(source.publisher_name?.trim()),
          ),
      )
      .map((post) => post.id);

    expect(incomplete).toEqual([]);
  });
});
