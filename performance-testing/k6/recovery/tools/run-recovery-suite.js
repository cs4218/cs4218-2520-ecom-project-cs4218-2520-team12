#!/usr/bin/env node
/*
  Recovery test runner:
  1) Starts backend service
  2) Simulates crash (forced stop)
  3) Restarts service and measures endpoint recovery time
  4) Runs k6 post-recovery performance checks
*/

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../../..");
require("dotenv").config({ path: path.join(ROOT, ".env") });

const BASE_URL = process.env.BASE_URL || "http://localhost:6060/api/v1";
const SERVER_START_CMD =
  process.env.SERVER_START_CMD || "node --experimental-modules server.js";
const SERVER_CWD = process.env.SERVER_CWD || ROOT;
const K6_BIN = process.env.K6_BIN || findDefaultK6Binary();
const RUN_ID = new Date().toISOString().replace(/[.:]/g, "-");
const OUT_DIR = path.join(ROOT, "performance-testing", "results", "recovery", RUN_ID);
const SUMMARY_FILE = path.join(OUT_DIR, "recovery-summary.json");
const REPORT_FILE = path.join(OUT_DIR, "recovery-report.md");

const QUICK = process.argv.includes("--quick");
const ONLY = getArgValue("--only");

const DEFAULT_ENV = {
  AUTH_EMAIL: process.env.AUTH_EMAIL || "",
  AUTH_PASSWORD: process.env.AUTH_PASSWORD || "",
  PAYMENT_NONCE: process.env.PAYMENT_NONCE || "invalid-recovery-nonce",
  BASE_URL,
};

const scenarios = [
  {
    id: "payment",
    script: "performance-testing/k6/recovery/payment-recovery-test.js",
    probePath: "/product/braintree/token",
    method: "GET",
    requiresAuthReady: true,
    expectedStatuses: [200],
    recoverySlaSec: 30,
    postRecoveryDuration: QUICK ? "20s" : "60s",
    vus: QUICK ? "6" : "15",
    env: {
      PAYMENT_P95_TARGET_MS: "2000",
      RECONCILIATION_TARGET: "0.95",
    },
  },
  {
    id: "order",
    script: "performance-testing/k6/recovery/order-recovery-test.js",
    probePath: "/auth/orders",
    method: "GET",
    requiresAuthReady: true,
    authProbe: true,
    expectedStatuses: [200],
    recoverySlaSec: 30,
    postRecoveryDuration: QUICK ? "20s" : "60s",
    vus: QUICK ? "8" : "20",
    env: {
      ORDER_P95_TARGET_MS: "2000",
      ORDER_CONSISTENCY_TARGET: "0.90",
    },
  },
  {
    id: "auth-session",
    script: "performance-testing/k6/recovery/auth-session-recovery-test.js",
    probePath: "/auth/login",
    method: "POST",
    requiresAuthReady: true,
    postBody: () => ({
      email: process.env.AUTH_EMAIL,
      password: process.env.AUTH_PASSWORD,
    }),
    expectedStatuses: [200],
    recoverySlaSec: 30,
    postRecoveryDuration: QUICK ? "20s" : "60s",
    vus: QUICK ? "8" : "20",
    env: {
      LOGIN_P95_TARGET_MS: "1500",
      INVALID_SESSION_TARGET: "0.95",
    },
  },
  {
    id: "product",
    script: "performance-testing/k6/recovery/product-recovery-test.js",
    probePath: "/product/get-product",
    method: "GET",
    expectedStatuses: [200],
    recoverySlaSec: 20,
    postRecoveryDuration: QUICK ? "20s" : "60s",
    vus: QUICK ? "10" : "30",
    env: {
      PRODUCT_P95_TARGET_MS: "2000",
    },
  },
];

const selectedScenarios = ONLY
  ? scenarios.filter((scenario) => scenario.id === ONLY)
  : scenarios;

if (selectedScenarios.length === 0) {
  console.error(`Unknown scenario '${ONLY}'. Valid values: ${scenarios.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

if (!DEFAULT_ENV.AUTH_EMAIL || !DEFAULT_ENV.AUTH_PASSWORD) {
  console.error("AUTH_EMAIL and AUTH_PASSWORD environment variables are required.");
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  ensureDir(OUT_DIR);
  await ensureBinary(K6_BIN, ["version"]);

  const resultRows = [];
  let serverProcess = null;

  try {
    serverProcess = startServer();
    await waitForUrl(`${BASE_URL.replace(/\/api\/v1$/, "")}/`, 60_000);

    for (const scenario of selectedScenarios) {
      const { row, nextServerProcess } = await runScenario(scenario, serverProcess);
      resultRows.push(row);

      // Restart process handle is replaced during scenario execution.
      serverProcess = nextServerProcess;
    }
  } finally {
    if (serverProcess) {
      await stopServer(serverProcess);
    }
  }

  const report = buildReport(resultRows);
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(resultRows, null, 2), "utf8");
  fs.writeFileSync(REPORT_FILE, report, "utf8");

  const failed = resultRows.some((row) => !row.passed);
  console.log(`\nRecovery suite completed. Output: ${OUT_DIR}`);
  console.log(`Report: ${REPORT_FILE}`);

  if (failed) {
    process.exitCode = 1;
  }
}

async function runScenario(scenario, serverProcess) {
  const start = Date.now();
  console.log(`\n=== Scenario: ${scenario.id} ===`);

  await stopServer(serverProcess);
  const crashAt = Date.now();

  const restartedProcess = startServer();
  const recoveredAt = await waitForProbe(scenario, 60_000);
  const recoverySec = (recoveredAt - crashAt) / 1000;

  if (scenario.requiresAuthReady) {
    await waitForAuthReady(60_000);
  }

  const recoverySlaMet = recoverySec <= scenario.recoverySlaSec;
  const k6SummaryPath = path.join(OUT_DIR, `${scenario.id}-k6-summary.json`);

  const env = {
    ...process.env,
    ...DEFAULT_ENV,
    ...scenario.env,
    VUS: scenario.vus,
    POST_RECOVERY_DURATION: scenario.postRecoveryDuration,
    BASE_URL,
  };

  const k6ExitCode = await runK6(scenario.script, k6SummaryPath, env);
  const durationSec = (Date.now() - start) / 1000;

  const row = {
    scenario: scenario.id,
    recovery_seconds: Number(recoverySec.toFixed(2)),
    recovery_sla_seconds: scenario.recoverySlaSec,
    recovery_sla_met: recoverySlaMet,
    k6_exit_code: k6ExitCode,
    k6_thresholds_met: k6ExitCode === 0,
    passed: recoverySlaMet && k6ExitCode === 0,
    total_duration_seconds: Number(durationSec.toFixed(2)),
    k6_summary_file: path.relative(ROOT, k6SummaryPath),
    server_started_at: new Date(start).toISOString(),
    recovered_at: new Date(recoveredAt).toISOString(),
  };

  console.log(
    `Scenario ${scenario.id}: recovery=${row.recovery_seconds}s (SLA ${scenario.recovery_sla_seconds}s), k6Exit=${k6ExitCode}`
  );

  return {
    row,
    nextServerProcess: restartedProcess,
  };
}

function buildReport(rows) {
  const lines = [];
  lines.push("# Recovery Performance Report");
  lines.push("");
  lines.push(`Base URL: ${BASE_URL}`);
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("| Scenario | Recovery (s) | SLA (s) | Recovery SLA | k6 thresholds | Overall |");
  lines.push("|---|---:|---:|---|---|---|");

  for (const row of rows) {
    lines.push(
      `| ${row.scenario} | ${row.recovery_seconds.toFixed(2)} | ${row.recovery_sla_seconds} | ${
        row.recovery_sla_met ? "PASS" : "FAIL"
      } | ${row.k6_thresholds_met ? "PASS" : "FAIL"} | ${row.passed ? "PASS" : "FAIL"} |`
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("- A scenario passes only if crash-to-availability recovery time meets SLA and k6 thresholds pass.");
  lines.push("- k6 summary JSON artifacts are stored per scenario in this same output directory.");
  lines.push("- Payment atomicity and order reconciliation checks are inferred through endpoint behavior and order consistency invariants.");
  lines.push("");

  return lines.join("\n") + "\n";
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return null;
  }

  return process.argv[index + 1];
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function ensureBinary(cmd, args) {
  await runCommand(cmd, args, {
    cwd: ROOT,
    env: process.env,
    stdio: "ignore",
  }).catch(() => {
    throw new Error(`Required binary '${cmd}' is not available in PATH.`);
  });
}

function startServer() {
  const child = spawn(SERVER_START_CMD, {
    cwd: SERVER_CWD,
    env: process.env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));

  return child;
}

async function stopServer(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    try {
      await runCommand("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        cwd: ROOT,
        env: process.env,
        stdio: "ignore",
      });
    } catch (_error) {
      // Ignore kill errors; process may already be down.
    }
  } else {
    child.kill("SIGTERM");
  }

  await waitForExit(child, 5_000);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, timeoutMs);

    child.once("exit", () => {
      if (!done) {
        clearTimeout(timer);
        done = true;
        resolve();
      }
    });
  });
}

async function waitForProbe(scenario, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      let headers = { "Content-Type": "application/json" };
      let body = undefined;

      if (scenario.authProbe) {
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            email: DEFAULT_ENV.AUTH_EMAIL,
            password: DEFAULT_ENV.AUTH_PASSWORD,
          }),
        });

        if (loginRes.status !== 200) {
          await delay(1000);
          continue;
        }

        const loginBody = await loginRes.json();
        if (!loginBody || !loginBody.token) {
          await delay(1000);
          continue;
        }

        headers = {
          ...headers,
          Authorization: loginBody.token,
        };
      }

      if (typeof scenario.postBody === "function") {
        body = JSON.stringify(scenario.postBody());
      }

      const response = await fetch(`${BASE_URL}${scenario.probePath}`, {
        method: scenario.method,
        headers,
        body,
      });

      if (scenario.expectedStatuses.includes(response.status)) {
        return Date.now();
      }
    } catch (_error) {
      // Keep polling until timeout.
    }

    await delay(1000);
  }

  throw new Error(`Probe timeout for scenario '${scenario.id}' after ${timeoutMs / 1000}s.`);
}

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status >= 200 && res.status < 500) {
        return;
      }
    } catch (_error) {
      // Keep retrying.
    }

    await delay(1000);
  }

  throw new Error(`Service did not become reachable within ${timeoutMs / 1000}s at ${url}.`);
}

async function waitForAuthReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: DEFAULT_ENV.AUTH_EMAIL,
          password: DEFAULT_ENV.AUTH_PASSWORD,
        }),
      });

      if (response.status === 200) {
        const body = await response.json();
        if (body && body.token) {
          return;
        }
      }
    } catch (_error) {
      // Keep waiting until auth-backed persistence is ready.
    }

    await delay(1000);
  }

  throw new Error(`Auth readiness timeout after ${timeoutMs / 1000}s.`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runK6(scriptRelativePath, summaryFile, env) {
  const scriptPath = path.join(ROOT, scriptRelativePath);
  return runCommand(
    K6_BIN,
    ["run", "--summary-export", summaryFile, scriptPath],
    {
      cwd: ROOT,
      env,
      stdio: "inherit",
    },
    true
  );
}

function runCommand(command, args, options, resolveExitCode = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (resolveExitCode) {
        resolve(code ?? 1);
        return;
      }

      if (code === 0) {
        resolve(0);
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function findDefaultK6Binary() {
  if (process.platform === "win32") {
    const windowsPath = "C:\\Program Files\\k6\\k6.exe";
    if (fs.existsSync(windowsPath)) {
      return windowsPath;
    }
  }

  return "k6";
}
