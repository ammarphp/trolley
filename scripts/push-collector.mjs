// Credential is read from stdin and stays in memory. Never put it in a URL or Git config file.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.stdout.write('Ready for source credential on stdin (hidden).\n');
if (process.stdin.isTTY) spawnSync('stty', ['-echo'], { stdio: ['inherit', 'ignore', 'ignore'] });
let input='';
for await (const chunk of process.stdin) { input+=chunk; if(input.includes('\n'))break; }
const credential=JSON.parse(input.trim());
const root=fileURLToPath(new URL('../.collector-site/',import.meta.url));
const env={...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'credential.helper',GIT_CONFIG_VALUE_0:'',GIT_CONFIG_KEY_1:`http.${credential.remote_url}.extraHeader`,GIT_CONFIG_VALUE_1:`Authorization: Bearer ${credential.token}`};
function git(args,auth=false){const r=spawnSync(process.env.GIT_EXECUTABLE||'git',args,{cwd:root,env:auth?env:process.env,encoding:'utf8'});if(r.status!==0)throw new Error(`Git ${args[0]} failed (${r.status}).`);return r.stdout.trim();}
git(['init']);git(['symbolic-ref','HEAD','refs/heads/main']);git(['add','.']);
if(git(['status','--porcelain']))git(['-c','user.name=Trolley Department','-c','user.email=bot@users.noreply.github.com','commit','-m','Publish anonymous run collector']);
const sha=git(['rev-parse','HEAD']);git(['push',credential.remote_url,`${sha}:refs/heads/${credential.branch}`],true);
const remote=git(['ls-remote',credential.remote_url,`refs/heads/${credential.branch}`],true);
if(!remote.startsWith(sha))throw new Error('Remote source verification failed.');
console.log(JSON.stringify({commit_sha:sha,project_id:JSON.parse(readFileSync(root+'/.openai/hosting.json','utf8')).project_id}));
