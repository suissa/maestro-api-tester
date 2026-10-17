import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { useEffect, useMemo, useState } from "react";

type LineKind = "normal" | "pass" | "fail" | "info";

type OutputLine = {
  id: number;
  text: string;
  kind: LineKind;
};

const MAX_LINES = 10_000;

function classify(text: string, fallback: LineKind): LineKind {
  const line = text.trim();
  if (/^(✔|✓|ok\b|pass\b|passed\b)/i.test(line)) return "pass";
  if (/^(✖|✗|not ok\b|fail\b|failed\b|error\b)/i.test(line)) return "fail";
  return fallback;
}

function App() {
  const [lines, setLines] = useState<OutputLine[]>([
    { id: 0, text: "MAESTRO TEST EXECUTION", kind: "info" },
    { id: 1, text: "Press Enter or R to run the complete suite.", kind: "info" },
  ]);
  const [running, setRunning] = useState(false);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [testFiles, setTestFiles] = useState<string[]>([]);
  const [runCount, setRunCount] = useState(0);

  const append = (chunk: string, fallback: LineKind = "normal") => {
    const next = chunk
      .replaceAll("\r", "")
      .split("\n")
      .filter((line) => line.length > 0);
    if (next.length === 0) return;

    setLines((current) => {
      const startId = current.length === 0 ? 0 : current[current.length - 1].id + 1;
      const additions = next.map((text, index) => ({
        id: startId + index,
        text,
        kind: classify(text, fallback),
      }));
      return [...current, ...additions].slice(-MAX_LINES);
    });
  };

  const run = async () => {
    if (running) return;

    setRunning(true);
    setExitCode(null);
    setRunCount((value) => value + 1);
    setStartedAt(Date.now());
    setElapsed(0);
    setSelected(0);

    try {
      const files = (await readdir(join(process.cwd(), "tests")))
        .filter((name) => name.endsWith(".test.ts"))
        .sort()
        .map((name) => join("tests", name));
      setTestFiles(files);

      if (files.length === 0) {
        append("No *.test.ts files found under tests/.", "fail");
        setExitCode(1);
        return;
      }

      setLines([
        {
          id: 0,
          text: `RUN #${runCount + 1} · ${files.length} test file(s)`,
          kind: "info",
        },
        {
          id: 1,
          text: "$ node --experimental-strip-types --test --test-reporter=spec tests/*.test.ts",
          kind: "info",
        },
      ]);
      append(`Discovered: ${files.join(", ")}`, "info");

      const child = spawn(
        process.execPath,
        ["--experimental-strip-types", "--test", "--test-reporter=spec", ...files],
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

      await new Promise<void>((resolve) => {
        child.once("error", (error) => {
          append(error instanceof Error ? error.stack ?? error.message : String(error), "fail");
          setExitCode(1);
          resolve();
        });
        child.once("close", (code) => {
          const result = code ?? 1;
          setExitCode(result);
          append(
            result === 0
              ? "✓ TEST RUN PASSED"
              : `✗ TEST RUN FAILED · exit code ${result}`,
            result === 0 ? "pass" : "fail",
          );
          resolve();
        });
      });
    } catch (error) {
      append(error instanceof Error ? error.stack ?? error.message : String(error), "fail");
      setExitCode(1);
    } finally {
      setElapsed(startedAt === null ? 0 : Date.now() - startedAt);
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!running || startedAt === null) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(timer);
  }, [running, startedAt]);

  useEffect(() => {
    setSelected(lines.length === 0 ? 0 : lines.length - 1);
  }, [lines.length]);

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") process.exit(0);
    if (key.name === "return" || key.name === "r") void run();
    if (key.name === "up") setSelected((value) => Math.max(0, value - 1));
    if (key.name === "down") setSelected((value) => Math.min(lines.length - 1, value + 1));
    if (key.name === "home") setSelected(0);
    if (key.name === "end") setSelected(Math.max(0, lines.length - 1));
  });

  const visible = useMemo(() => {
    const height = 20;
    const start = Math.max(0, Math.min(selected - height + 1, lines.length - height));
    return lines.slice(start, start + height);
  }, [lines, selected]);

  const passed = lines.filter((line) => line.kind === "pass").length;
  const failed = lines.filter((line) => line.kind === "fail").length;
  const seconds = (elapsed / 1000).toFixed(1);

  return (
    <box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 1,
      }}
    >
      <box style={{ flexDirection: "column", border: true, padding: 1, marginBottom: 1 }}>
        <text>
          MAESTRO · TEST EXECUTION DASHBOARD · OpenTUI
        </text>
        <text>
          {running ? "RUNNING" : exitCode === 0 ? "PASSED" : exitCode === null ? "IDLE" : "FAILED"} · {seconds}s · run #{runCount}
        </text>
      </box>

      <box style={{ flexDirection: "row", height: 6, marginBottom: 1 }}>
        <box style={{ flexGrow: 1, border: true, padding: 1, marginRight: 1 }} title="Suite">
          <text>Files: {testFiles.length || "—"}</text>
          <text>{testFiles.length ? testFiles.join(" · ") : "No execution yet"}</text>
          <text>Runner: Node.js native test runner</text>
        </box>
        <box style={{ width: 34, border: true, padding: 1 }} title="Result">
          <text>PASS lines: {passed}</text>
          <text>FAIL lines: {failed}</text>
          <text>Exit: {exitCode === null ? "—" : exitCode}</text>
        </box>
      </box>

      <box style={{ flexGrow: 1, border: true, padding: 1 }} title="Live stdout + stderr">
        <scrollbox style={{ flexGrow: 1 }}>
          {visible.map((line) => (
            <text
              key={line.id}
              style={{
                fg:
                  line.kind === "pass"
                    ? "#55dd88"
                    : line.kind === "fail"
                      ? "#ff6677"
                      : line.kind === "info"
                        ? "#00d2fd"
                        : "#d6deeb",
              }}
            >
              {line.text}
            </text>
          ))}
        </scrollbox>
      </box>

      <box style={{ border: true, padding: 1, marginTop: 1 }}>
        <text>ENTER/R run · ↑/↓ scroll · HOME/END jump · Q/ESC quit</text>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
