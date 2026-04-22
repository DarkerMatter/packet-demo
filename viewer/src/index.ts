import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import pc from "picocolors";

const portPath = process.argv[2];
if (!portPath) {
  console.error("Usage: npx tsx src/index.ts <serial-port>");
  console.error("  e.g. npx tsx src/index.ts /dev/tty.usbmodem1101");
  console.error("\nAvailable ports:");
  const { SerialPort: SP } = await import("serialport");
  const ports = await SP.list();
  for (const p of ports) {
    console.error(`  ${p.path}  ${p.manufacturer || ""}`);
  }
  process.exit(1);
}

const baudRate = parseInt(process.argv[3] || "115200", 10);

const port = new SerialPort({ path: portPath, baudRate });
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

function timestamp(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return pc.dim(`${h}:${m}:${s}.${ms}`);
}

parser.on("data", (line: string) => {
  const ts = timestamp();
  const trimmed = line.trim();

  if (trimmed.startsWith("[ALICE]")) {
    console.log(`${ts} ${pc.blue(trimmed)}`);
  } else if (trimmed.startsWith("[BOB]")) {
    console.log(`${ts} ${pc.green(trimmed)}`);
  } else if (trimmed.startsWith("[EVE]")) {
    console.log(`${ts} ${pc.red(pc.bold(trimmed))}`);
  } else {
    console.log(`${ts} ${trimmed}`);
  }
});

port.on("error", (err) => {
  console.error(pc.red(`Serial error: ${err.message}`));
  process.exit(1);
});

port.on("close", () => {
  console.log(pc.dim("Serial port closed."));
  process.exit(0);
});

console.log(pc.dim(`Listening on ${portPath} @ ${baudRate} baud...`));
console.log(pc.dim("Press Ctrl+C to exit.\n"));
