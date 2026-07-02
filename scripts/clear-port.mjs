/**
 * 跨平台端口清理 — 启动后端前干掉占用目标端口的残留进程。
 *
 * 用法： node scripts/clear-port.mjs [port]
 * 默认端口 4166。退出码恒为 0（即使没占用也不报错），可安全作为 predev 钩子。
 *
 * 安全说明：只结束占用该端口的进程。Windows 用 taskkill；Unix 用 lsof/fuser。
 */
import { execSync } from "node:child_process";
import { platform } from "node:os";

const port = parseInt(process.argv[2] ?? "4166", 10);
const isWin = platform() === "win32";

function log(msg) {
  console.log(`[clear-port] ${msg}`);
}

function findPidsOnPort() {
  const pids = new Set();
  try {
    if (isWin) {
      // netstat 找出 LISTENING 占用端口的 PID
      const out = execSync(`netstat -ano -p TCP`, { encoding: "utf8" });
      for (const line of out.split(/\r?\n/)) {
        // 形如： TCP  0.0.0.0:4166  0.0.0.0:0  LISTENING  1234
        if (line.includes("LISTENING") && new RegExp(`[:.]${port}\\s`).test(line)) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) pids.add(pid);
        }
      }
    } else {
      // macOS / Linux：优先 lsof
      try {
        const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
        for (const p of out.split(/\r?\n/)) if (/^\d+$/.test(p)) pids.add(p);
      } catch {
        const out = execSync(`fuser ${port}/tcp 2>/dev/null`, { encoding: "utf8" });
        for (const p of out.trim().split(/\s+/)) if (/^\d+$/.test(p)) pids.add(p);
      }
    }
  } catch {
    // 命令失败通常意味着没有占用，忽略
  }
  return [...pids];
}

const pids = findPidsOnPort();
if (pids.length === 0) {
  log(`port ${port} is free`);
  process.exit(0);
}

log(`port ${port} is held by PID ${pids.join(", ")} — killing...`);
for (const pid of pids) {
  try {
    if (isWin) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    } else {
      process.kill(parseInt(pid, 10), "SIGKILL");
    }
    log(`killed PID ${pid}`);
  } catch {
    log(`failed to kill PID ${pid} (skip)`);
  }
}

// 给内核一点时间回收套接字
setTimeout(() => process.exit(0), 300);
