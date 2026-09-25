// Build (and optionally serve) the asset lab.
//   node scripts/lab.mjs [--file src/render/x.lab.ts] [--out .lab/build] [--serve] [--port 4300]
// Without --file every *.lab.ts under src/ is bundled.
import { build } from "esbuild";
import { mkdir, readdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { existsSync } from "node:fs";
import { copyFonts } from "./fonts.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

async function findLabFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findLabFiles(p)));
    else if (entry.name.endsWith(".lab.ts")) out.push(p);
  }
  return out;
}

export async function buildLab({ file, out }) {
  const files = file ? [file] : await findLabFiles("src");
  await mkdir(out, { recursive: true });
  const entry = path.join(out, "entry.ts");
  const rel = (p) => path.relative(out, p).split(path.sep).join("/");
  await writeFile(
    entry,
    `import { runLab } from "${rel("src/render/lab/main.ts")}";\n` +
      files.map((f, i) => `import * as m${i} from "${rel(f)}";`).join("\n") +
      `\nconst all = [${files.map((_, i) => `...((m${i} as any).scenes ?? [])`).join(", ")}];\nrunLab(all);\n`,
  );
  await build({
    entryPoints: [entry],
    outfile: path.join(out, "lab.js"),
    bundle: true,
    format: "esm",
    target: ["es2022"],
    sourcemap: "inline",
    logLevel: "warning",
    loader: { ".svg": "text" },
    external: ["*.woff2"],
  });
  await copyFonts(out);
  const css = existsSync(path.join(out, "lab.css")) ? '<link rel="stylesheet" href="./lab.css">' : "";
  await writeFile(
    path.join(out, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>lab</title>
<style>html,body{margin:0;background:#fff;overflow:hidden}</style>${css}</head><body><script type="module" src="./lab.js"></script></body></html>`,
  );
  return out;
}

export function serve(root, port = 0) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
        if (p.endsWith("/")) p += "index.html";
        const file = path.join(root, p);
        if (!(await stat(file)).isFile()) throw new Error();
        res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = opt("out", ".lab/build");
  await buildLab({ file: opt("file"), out });
  console.log(`Lab built in ${out}`);
  if (has("serve")) {
    const server = await serve(out, Number(opt("port", 4300)));
    console.log(`Lab: http://127.0.0.1:${server.address().port}/`);
  }
}
