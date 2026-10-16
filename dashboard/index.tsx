import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import { useState } from "react";
import { describe, request } from "../src/api-tester.ts";

const METHODS = [
  { name: "GET", value: "GET" },
  { name: "POST", value: "POST" },
  { name: "PUT", value: "PUT" },
  { name: "PATCH", value: "PATCH" },
  { name: "DELETE", value: "DELETE" },
];

function App() {
  const [url, setUrl] = useState("http://127.0.0.1:8787/health");
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("");
  const [result, setResult] = useState("Waiting for a request...");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const response = await request({ url, method, body: body || undefined });
      setResult(
        `${describe(response)}\n\n${JSON.stringify(response.data, null, 2)}`,
      );
    } catch (error) {
      setResult(
        `Request failed\n\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setBusy(false);
    }
  };

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") process.exit(0);
    if (key.name === "return") void run();
  });

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
          <strong>MAESTRO API TESTER</strong> · OpenTUI / React
        </text>
      </box>
      <box style={{ flexDirection: "row", height: 7, marginBottom: 1 }}>
        <box
          style={{ flexGrow: 1, border: true, padding: 1, marginRight: 1 }}
          title="Request"
        >
          <text>Method</text>
          <select
            focused
            options={METHODS}
            onChange={(_, option) => setMethod(option?.value ?? "GET")}
          />
          <text>URL</text>
          <input value={url} onInput={setUrl} onSubmit={() => void run()} />
        </box>
        <box style={{ width: 44, border: true, padding: 1 }} title="JSON body">
          <input
            value={body}
            onInput={setBody}
            placeholder='{"hello":"maestro"}'
          />
        </box>
      </box>
      <box
        style={{ flexGrow: 1, border: true, padding: 1, marginBottom: 1 }}
        title={busy ? "Running..." : "Response"}
      >
        <scrollbox style={{ flexGrow: 1 }}>
          <text>{result}</text>
        </scrollbox>
      </box>
      <box style={{ border: true, padding: 1 }}>
        <text>ENTER run request · q / ESC quit · Routes: /health /routes /echo</text>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App />);
