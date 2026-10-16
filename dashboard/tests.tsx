import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { useEffect, useMemo, useState } from "react";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

type Entry = { text: string; kind: "pass" | "fail" | "info" | "raw" };

function App() {
  const [entries, setEntries] = useState<Entry[]>([
    { text: "MAESTRO TEST EXECUTION DASHBOARD", kind: "info" },
    { text: "Preparing test discovery…", kind: "info" },
  ]);
  const [running, setRunning] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [scroll, setScroll] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const append = (text: string, kind: Entry["kind"] = "raw") => {
    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((line) => line.length > 0);
    if (lines.length)
      setEntries((previous) => [
        ...previous,
        ...lines.map((line) => ({
          text: line,
          kind: /^(✔|✓|ok\b|ℹ pass)/i.test(line.trim())
            ? ("pass" as const)
            : /^(✖|✗|not ok\b|Error:|\s+error:)/i.test(line.trim())
              ? ("fail" as const)
              : kind,
        })),
      ]);
  };

  const runTests = async () => {
    if (running) return;
    setEntries([
      { text: "MAESTRO TEST EXECUTION DASHBOARD", kind: "info" },
      {
        text: "$ node --experimental-strip-types --test --test-reporter=spec tests/*.test.ts",
        kind: "info",
      },
    ]);
    setExitCode(null);
    setRunning(true);
    setStartedAt(Date.now());
    setElapsed(0);
    try {
      const files = (await readdir("tests"))
        .filter((name) => name.endsWith(".test.ts"))
        .map((name) => join("tests", name));
      if (!files.length) {
        append("No test files found in tests/.", "fail");
        setExitCode(1);
        return;
      }
      append(
        `Discovered ${files.length} test file(s): ${files.join(", ")}`,
        "info",
      );
      const child = spawn(
        process.execPath,
        [
          "--experimental-strip-types",
          "--test",
          "--test-reporter=spec",
          ...files,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => append(chunk));
      child.stderr.on("data", (chunk: string) => append(chunk, "fail"));
      await new Promise<void>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => {
          setExitCode(code ?? 1);
          append(
            code === 0
              ? "TEST RUN COMPLETED: PASS"
              : `TEST RUN COMPLETED: FAIL (exit code ${code ?? "unknown"})`,
            code === 0 ? "pass" : "fail",
          );
          resolve();
        });
      });
    } catch (error) {
      append(
        error instanceof Error ? (error.stack ?? error.message) : String(error),
        "fail",
      );
      setExitCode(1);
    } finally {
      setRunning(false);
      setElapsed(startedAt ? Date.now() - startedAt : 0);
    }
  };

  useEffect(() => {
    if (!running || startedAt === null) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(timer);
  }, [running, startedAt]);

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") process.exit(0);
    if (key.name === "return" || key.name === "r") void runTests();
    if (key.name === "up") setScroll((value) => Math.max(0, value - 1));
    if (key.name === "down")
      setScroll((value) =>
        Math.min(Math.max(0, entries.length - 1), value + 1),
      );
    if (key.name === "end") setScroll(Math.max(0, entries.length - 1));
    if (key.name === "home") setScroll(0);
  });

  const passed = entries.filter((entry) => entry.kind === "pass").length;
  const failed = entries.filter((entry) => entry.kind === "fail").length;
  const visible = useMemo(
    () => entries.slice(Math.max(0, scroll - 12), scroll + 1),
    [entries, scroll],
  );
  const duration = (elapsed / 1000).toFixed(1) + "s";

  return (
    <box
      style={{
        flexDirection: "column",
        padding: 1,
        backgroundColor: "#090b12",
        width: "100%",
        height: "100%",
      }}
    >
      <box
        style={{
          border: true,
          borderStyle: "double",
          padding: 1,
          marginBottom: 1,
        }}
      >
        <text>
          <strong>MAESTRO</strong> · TEST EXECUTION DASHBOARD · OpenTUI
        </text>
        <text>
          {running
            ? "● RUNNING"
            : exitCode === 0
              ? "✓ PASSED"
              : exitCode !== null
                ? "✗ FAILED"
                : "○ IDLE"}{" "}
          · Duration: {duration} · Output lines: {entries.length}
        </text>
      </box>
      <box style={{ flexDirection: "row", height: 5, marginBottom: 1 }}>
        <box
          style={{ flexGrow: 1, border: true, padding: 1, marginRight: 1 }}
          title="Execution"
        >
          <text>Files: tests/*.test.ts</text>
          <text>Runner: Node.js native test runner</text>
          <text>Stdout and stderr streamed live</text>
        </box>
        <box style={{ width: 34, border: true, padding: 1 }} title="Summary">
          <text>PASS/log lines: {passed}</text>
          <text>FAIL/error lines: {failed}</text>
          <text>Exit code: {exitCode === null ? "—" : String(exitCode)}</text>
        </box>
      </box>
      <box
        style={{ flexGrow: 1, border: true, padding: 1, marginBottom: 1 }}
        title="Live test output · all stdout/stderr"
      >
        <scrollbox style={{ flexGrow: 1 }}>
          {visible.map((entry, index) => (
            <text
              key={Math.max(0, scroll - 12) + index}
              style={{
                fg:
                  entry.kind === "pass"
                    ? "#55dd88"
                    : entry.kind === "fail"
                      ? "#ff6677"
                      : entry.kind === "info"
                        ? "#00d2fd"
                        : "#d6deeb",
              }}
            >
              {entry.text}
            </text>
          ))}
        </scrollbox>
      </box>
      <box style={{ border: true, padding: 1 }}>
        <text>
          ENTER / R run tests · ↑/↓ scroll output · HOME/END navigate · Q / ESC
          quit
        </text>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
