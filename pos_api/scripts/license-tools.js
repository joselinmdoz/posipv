#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function canonicalJson(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function readMachineId() {
  const files = ["/etc/machine-id", "/var/lib/dbus/machine-id", "/sys/class/dmi/id/product_uuid"];
  for (const filePath of files) {
    try {
      const value = fs.readFileSync(filePath, "utf8").trim();
      if (value) return value;
    } catch {
      continue;
    }
  }
  return "";
}

function getMacAddresses() {
  const map = os.networkInterfaces() || {};
  const set = new Set();
  for (const infos of Object.values(map)) {
    for (const info of infos || []) {
      if (!info || info.internal) continue;
      const mac = String(info.mac || "").trim().toLowerCase();
      if (!mac || mac === "00:00:00:00:00:00") continue;
      set.add(mac);
    }
  }
  return Array.from(set).sort();
}

function buildDeviceHash(seed = "") {
  const machineId = readMachineId();
  const macs = getMacAddresses();
  const cpuModel = os.cpus()?.[0]?.model || "unknown-cpu";
  const hostName = os.hostname() || "unknown-host";
  const parts = [
    `platform:${os.platform()}`,
    `arch:${os.arch()}`,
    `host:${hostName}`,
    `cpu:${cpuModel}`,
    `machine:${machineId || "none"}`,
    ...macs.map((mac) => `mac:${mac}`),
  ];
  if (seed) parts.push(`seed:${seed}`);
  return sha256(parts.map((item) => item.trim().toLowerCase()).sort().join("|"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cmdKeygen(args) {
  const outDir = path.resolve(process.cwd(), args.out || "keys");
  ensureDir(outDir);
  const pair = crypto.generateKeyPairSync("ed25519");
  const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
  const publicPem = pair.publicKey.export({ type: "spki", format: "pem" });
  fs.writeFileSync(path.join(outDir, "license-private.pem"), privatePem);
  fs.writeFileSync(path.join(outDir, "license-public.pem"), publicPem);
  console.log(`Claves generadas en: ${outDir}`);
}

function cmdFingerprint(args) {
  const seed = String(args.seed || "");
  const hash = buildDeviceHash(seed);
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    deviceHash: hash,
    seed: seed || null,
    platform: os.platform(),
    arch: os.arch(),
  }, null, 2));
}

function cmdSign(args) {
  const privateKeyPath = args.private;
  const payloadPath = args.payload;
  if (!privateKeyPath || !payloadPath) {
    throw new Error("Uso: sign --private <license-private.pem> --payload <payload.json> [--out license.dat]");
  }

  const privatePem = fs.readFileSync(path.resolve(process.cwd(), privateKeyPath), "utf8");
  const payload = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), payloadPath), "utf8"));
  const message = Buffer.from(canonicalJson(payload), "utf8");
  const signature = crypto.sign(null, message, privatePem).toString("base64");
  const envelope = {
    alg: "Ed25519",
    payload,
    signature,
  };

  const outPath = path.resolve(process.cwd(), args.out || "license.dat");
  fs.writeFileSync(outPath, JSON.stringify(envelope, null, 2));
  console.log(`Licencia firmada en: ${outPath}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log("Comandos:");
    console.log("  keygen --out <dir>");
    console.log("  fingerprint [--seed valor]");
    console.log("  sign --private <file.pem> --payload <payload.json> [--out license.dat]");
    process.exit(0);
  }

  if (cmd === "keygen") return cmdKeygen(args);
  if (cmd === "fingerprint") return cmdFingerprint(args);
  if (cmd === "sign") return cmdSign(args);

  throw new Error(`Comando no soportado: ${cmd}`);
}

try {
  main();
} catch (error) {
  console.error(String(error?.message || error));
  process.exit(1);
}
