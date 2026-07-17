import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function managedServerArgvPrefix({ nodePath, serverPath, repoRoot, configPath }) {
  return [
    nodePath,
    serverPath,
    "--root", repoRoot,
    "--config", configPath,
    "--port", "auto",
    "--start-token"
  ];
}

function linuxProcessIdentity(pid) {
  const commandLinePath = `/proc/${pid}/cmdline`;
  const statPath = `/proc/${pid}/stat`;
  if (!existsSync(commandLinePath) || !existsSync(statPath)) return null;
  const argv = readFileSync(commandLinePath)
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const statLine = readFileSync(statPath, "utf8");
  const closeParen = statLine.lastIndexOf(")");
  const fieldsAfterCommand = statLine.slice(closeParen + 2).trim().split(/\s+/);
  const startTicks = fieldsAfterCommand[19];
  if (argv.length === 0 || !startTicks) throw new Error(`PID ${pid}의 /proc identity를 읽을 수 없습니다.`);
  return {
    argv,
    command: argv.join(" "),
    startMarker: `linux-start-ticks:${startTicks}`
  };
}

function psValue(pid, field) {
  const result = spawnSync("/bin/ps", ["-ww", "-p", String(pid), "-o", `${field}=`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(`PID ${pid}의 OS process identity를 읽을 수 없습니다: ${result.stderr.trim() || `ps exit ${result.status}`}`);
  }
  const value = result.stdout.trim();
  if (!value) throw new Error(`PID ${pid}의 OS process identity가 비어 있습니다.`);
  return value;
}

export function inspectOsProcess(pid) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error(`올바르지 않은 PID입니다: ${pid}`);
  const linux = linuxProcessIdentity(pid);
  if (linux) return linux;
  return {
    argv: null,
    command: psValue(pid, "command"),
    startMarker: `ps-lstart:${psValue(pid, "lstart").replace(/\s+/g, " ")}`
  };
}

export function managedProcessIdentity({ pid, nodePath, serverPath, repoRoot, configPath, startTokenSha256 }) {
  if (!/^[a-f0-9]{64}$/.test(startTokenSha256 ?? "")) {
    return { matches: false, reason: "invalid_start_token_hash", process: null };
  }
  let observed;
  try {
    observed = inspectOsProcess(pid);
  } catch (error) {
    return { matches: false, reason: "process_identity_unavailable", error: error.message, process: null };
  }
  const prefix = managedServerArgvPrefix({ nodePath, serverPath, repoRoot, configPath });
  let token = null;
  if (observed.argv) {
    if (observed.argv.length !== prefix.length + 1 || !prefix.every((value, index) => observed.argv[index] === value)) {
      return { matches: false, reason: "managed_command_mismatch", process: observed };
    }
    token = observed.argv.at(-1);
  } else {
    const commandPrefixes = [
      `${prefix.join(" ")} `,
      `${[path.basename(nodePath), ...prefix.slice(1)].join(" ")} `
    ];
    const commandPrefix = commandPrefixes.find((candidate) => observed.command.startsWith(candidate));
    if (!commandPrefix) {
      return { matches: false, reason: "managed_command_mismatch", process: observed };
    }
    token = observed.command.slice(commandPrefix.length);
    if (!token || /\s/.test(token)) {
      return { matches: false, reason: "managed_command_mismatch", process: observed };
    }
  }
  if (sha256(token) !== startTokenSha256) {
    return { matches: false, reason: "start_token_mismatch", process: observed };
  }
  return {
    matches: true,
    reason: "managed_process_match",
    process: {
      ...observed,
      commandSha256: sha256(observed.command)
    }
  };
}
