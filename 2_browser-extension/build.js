// esbuild build script for the X-Check MV3 extension.
//
// Why this file exists: Chrome can only load .js. Our logic is written in .ts under src/.
// esbuild takes each entry point in src/entry/, follows every `import` (including the whole
// pipeline + scoring + profile + intervention modules), and bundles each into ONE plain .js
// file under dist/ that manifest.json / the HTML pages point at. `format: "iife"` is required
// because Chrome content scripts cannot be ES modules.
const esbuild = require("esbuild");

const ENTRIES = [
  { in: "src/entry/background.ts", out: "dist/background.js" },
  { in: "src/entry/content-script.ts", out: "dist/content-script.js" },
  { in: "src/entry/popup.ts", out: "dist/popup.js" },
  { in: "src/entry/onboarding.ts", out: "dist/onboarding.js" },
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
