// esbuild build script for the X-Check MV3 extension.
// Chrome can only load .js; our logic is .ts under src/. esbuild bundles each entry point in
// src/entry/ (following every import) into one plain .js under dist/ that manifest.json /
// popup.html point at. format "iife" is required because content scripts cannot be ES modules.
const esbuild = require("esbuild");

const ENTRIES = [
  { in: "src/entry/background.ts", out: "dist/background.js" },
  { in: "src/entry/content-script.ts", out: "dist/content-script.js" },
  { in: "src/entry/popup.ts", out: "dist/popup.js" },
];

const SHARED = {
  bundle: true,
  target: "chrome120",
  platform: "browser",
  format: "iife",
  logLevel: "info",
};

const watch = process.argv.includes("--watch");

async function run() {
  for (const entry of ENTRIES) {
    const ctx = await esbuild.context({
      ...SHARED,
      entryPoints: [entry.in],
      outfile: entry.out,
    });
    if (watch) {
      await ctx.watch();
    } else {
      await ctx.rebuild();
      await ctx.dispose();
    }
  }
  console.log(watch ? "[esbuild] watching for changes…" : "[esbuild] build complete → dist/");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
