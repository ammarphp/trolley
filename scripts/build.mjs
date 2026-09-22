import { mkdir, rm, cp, readFile, writeFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'src', 'public']) {
  await cp(file, file === 'public' ? 'dist' : `dist/${file}`, { recursive: true });
}
for (const file of ['README.md', 'LICENSE', 'docs']) {
  try { await cp(file, `dist/${file}`, { recursive: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const config = JSON.parse(await readFile('dist/config.json', 'utf8'));
if (process.env.COLLECTOR_URL) config.collectorUrl = process.env.COLLECTOR_URL;
if (process.env.REPOSITORY_URL) config.repositoryUrl = process.env.REPOSITORY_URL;
if (process.env.OPERATOR_NAME) config.operatorName = process.env.OPERATOR_NAME;
if (process.env.CONTACT_URL) config.contactUrl = process.env.CONTACT_URL;
await writeFile('dist/config.json', JSON.stringify(config, null, 2) + '\n');
await writeFile('dist/.nojekyll', '');
console.log('Built dist/ — static, relative paths, no frontend runtime dependencies.');
