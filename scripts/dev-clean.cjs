/**
 * 一键清理 AI-Insight 的所有 dev 子进程（孤儿回收）。
 *
 * 用法： node scripts/dev-clean.cjs
 * 匹配规则（命令行必须同时满足）：
 *   - 路径含 "AI-Insight"
 *   - 命令行含 "main.ts" / "tsx" / "vite" 之一（dev 相关）
 * 排除规则：
 *   - 不杀当前正在执行本脚本的进程及其父进程链（避免自杀）
 *   - 不杀 "dev-clean" 自身
 *   - 不杀他项目（路径不含 AI-Insight，如 correlation-analysis-system）
 *
 * Windows 用 wmic + taskkill；Unix 用 ps + kill。
 */
const { execSync } = require("node:child_process");
const { platform } = require("node:os");

const isWin = platform() === "win32";

function log(msg) {
  console.log(`[dev-clean] ${msg}`);
}

/** 取当前进程及其所有祖先 PID，组成不可杀集合。 */
function protectedPids() {
  const set = new Set([process.pid]);
  try {
    let pid = process.pid;
    for (let i = 0; i < 16; i++) {
      let ppid;
      if (isWin) {
        const out = execSync(
          `wmic process where "ProcessId=${pid}" get ParentProcessId /value`,
          { encoding: "utf8" },
        );
        const m = out.match(/ParentProcessId=(\d+)/);
        if (!m) break;
        ppid = parseInt(m[1], 10);
      } else {
        const out = execSync(`ps -o ppid= -p ${pid}`, { encoding: "utf8" });
        ppid = parseInt(out.trim(), 10);
      }
      if (!ppid || ppid === pid || ppid <= 1) break;
      set.add(ppid);
      pid = ppid;
    }
  } catch {
    // 忽略
  }
  return set;
}

function listCandidates() {
  // 返回 [{pid, cmd}]
  const rows = [];
  try {
    if (isWin) {
      const out = execSync(
        `wmic process where "name='node.exe'" get ProcessId,CommandLine /format:list`,
        { encoding: "utf8", maxBuffer: 1 << 24 },
      );
      // /format:list 输出：CommandLine=<...>\nProcessId=<n>\n（顺序与 get 列序一致，
      // CommandLine 在前）。用"凑齐一对就输出"的方式，与顺序无关。
      let pid = null;
      let cmd = null;
      const flush = () => {
        if (pid != null && cmd != null) rows.push({ pid, cmd });
        pid = null;
        cmd = null;
      };
      for (const line of out.split(/\r?\n/)) {
        // wmic /format:list 行尾是 \r\r\n，split 后残留尾部 \r，先 trim
        const m = line.trim().match(/^(CommandLine|ProcessId)=(.*)$/);
        if (!m) continue;
        if (m[1] === "ProcessId") pid = m[2].trim();
        else cmd = m[2];
        if (pid != null && cmd != null) flush();
      }
    } else {
      const out = execSync(`ps -eo pid=,command=`, { encoding: "utf8" });
      for (const line of out.split(/\n/)) {
        const t = line.trim();
        if (!t) continue;
        const sp = t.indexOf(" ");
        const pid = t.slice(0, sp).trim();
        const cmd = t.slice(sp + 1).trim();
        if (/^\d+$/.test(pid)) rows.push({ pid, cmd });
      }
    }
  } catch {
    // 忽略
  }
  return rows;
}

const devKeywords = ["main.ts", "tsx", "vite"];

/** 占用指定端口的 PID 集合（端口兜底识别：占着 4000 的必是本项目后端）。 */
function pidsOnPort(port) {
  const set = new Set();
  try {
    if (isWin) {
      const out = execSync(`netstat -ano -p TCP`, { encoding: "utf8" });
      for (const line of out.split(/\r?\n/)) {
        if (line.includes("LISTENING") && new RegExp(`[:.]${port}\\s`).test(line)) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (/^\d+$/.test(pid)) set.add(pid);
        }
      }
    } else {
      const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
      for (const p of out.split(/\s+/)) if (/^\d+$/.test(p)) set.add(p);
    }
  } catch {
    // 忽略
  }
  return set;
}

/** 本项目后端端口（与 config.ts 默认值一致）。 */
const SERVER_PORT = parseInt(process.env.PORT ?? "4000", 10);
const serverPortPids = pidsOnPort(SERVER_PORT);

function isAiInsightDev(cmd, pid) {
  if (!cmd) return false;
  if (cmd.includes("dev-clean")) return false; // 排除自身
  // 方式1：命令行含 AI-Insight（绝对路径启动）+ dev 关键字
  if (cmd.includes("AI-Insight") && devKeywords.some((k) => cmd.includes(k))) return true;
  // 方式2：占用后端端口的 node 进程（端口兜底，识别相对路径启动的后端）
  if (serverPortPids.has(String(pid)) && devKeywords.some((k) => cmd.includes(k))) return true;
  return false;
}

const guard = protectedPids();
const candidates = listCandidates();
const targets = candidates.filter(
  (r) => isAiInsightDev(r.cmd, r.pid) && !guard.has(parseInt(r.pid, 10)),
);

if (targets.length === 0) {
  log("no AI-Insight dev processes found — clean");
  process.exit(0);
}

log(`found ${targets.length} process(es) to kill:`);
for (const t of targets) log(`  PID ${t.pid}  ${t.cmd.slice(0, 90)}`);

let killed = 0;
for (const t of targets) {
  try {
    if (isWin) execSync(`taskkill /PID ${t.pid} /T /F`, { stdio: "ignore" });
    else process.kill(parseInt(t.pid, 10), "SIGKILL");
    killed++;
  } catch {
    log(`  failed to kill PID ${t.pid} (skip)`);
  }
}
log(`killed ${killed}/${targets.length}. Done.`);
process.exit(0);
