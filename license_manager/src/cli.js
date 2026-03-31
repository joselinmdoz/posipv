#!/usr/bin/env node
const {
  buildPublicEnv,
  generateKeys,
  issueLicense,
  listLicenses,
  revokeLicense,
  verifyLicense,
} = require("./manager");

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

function requireFlag(args, key) {
  const value = args[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Falta --${key}`);
  }
  return value;
}

function cmdHelp() {
  console.log("license-manager - Comandos");
  console.log("");
  console.log("  keygen --out <dir>");
  console.log("  public-env --public <keys/license-public.pem>");
  console.log("  issue --private <pem> --request <activation-request.json> --license-id <id> [opciones]");
  console.log("  verify --public <pem> --license <license.dat>");
  console.log("  list [--db ./data/licenses.json]");
  console.log("  revoke --license-id <id> [--reason texto] [--db ./data/licenses.json]");
  console.log("  web [--port 8787] [--host 127.0.0.1] [--open]");
  console.log("");
  console.log("Opciones de issue:");
  console.log("  --days <n>                      Vigencia en dias (si no usas --expires-at)");
  console.log("  --issued-at <iso>               Default: ahora");
  console.log("  --valid-from <iso>              Default: issued-at");
  console.log("  --expires-at <iso>              Fecha de expiracion fija");
  console.log("  --customer <nombre>");
  console.log("  --max-users <n>");
  console.log("  --features f1,f2,f3");
  console.log("  --out <archivo>                 Default: ./out/<license-id>.dat");
  console.log("  --db <archivo>                  Default: ./data/licenses.json");
}

function cmdKeygen(args) {
  const result = generateKeys({ outDir: args.out || "./keys" });
  console.log(`Claves creadas en: ${result.outDir}`);
  console.log("IMPORTANTE: conserva license-private.pem fuera de servidores cliente.");
}

function cmdPublicEnv(args) {
  const publicFile = requireFlag(args, "public");
  console.log(buildPublicEnv({ publicFile }));
}

function cmdIssue(args) {
  const result = issueLicense({
    privateFile: requireFlag(args, "private"),
    requestFile: requireFlag(args, "request"),
    licenseId: requireFlag(args, "license-id"),
    days: args.days,
    issuedAt: args["issued-at"],
    validFrom: args["valid-from"],
    expiresAt: args["expires-at"],
    customer: args.customer,
    maxUsers: args["max-users"],
    features: args.features,
    outFile: args.out,
    dbPath: args.db || "./data/licenses.json",
  });

  console.log(`Licencia creada: ${result.outFile}`);
  console.log(`Registry actualizado: ${result.dbPath}`);
}

function cmdVerify(args) {
  const result = verifyLicense({
    publicFile: requireFlag(args, "public"),
    licenseFile: requireFlag(args, "license"),
  });
  console.log(JSON.stringify(result, null, 2));
}

function cmdList(args) {
  const result = listLicenses({ dbPath: args.db || "./data/licenses.json" });
  const rows = result.licenses;
  if (!rows.length) {
    console.log("No hay licencias registradas.");
    return;
  }

  console.log("licenseId | status | expiresAt | customer | deviceHash");
  console.log("--------------------------------------------------------------------------");
  for (const row of rows) {
    const line = [
      String(row.licenseId || "-"),
      String(row.status || "-"),
      String(row.expiresAt || "-"),
      String(row.customerName || "-"),
      `${String(row.deviceHash || "-").slice(0, 16)}...`,
    ].join(" | ");
    console.log(line);
  }
}

function cmdRevoke(args) {
  const result = revokeLicense({
    dbPath: args.db || "./data/licenses.json",
    licenseId: requireFlag(args, "license-id"),
    reason: args.reason,
  });

  console.log(`Licencia revocada: ${result.record.licenseId}`);
}

function cmdWeb(args) {
  const port = args.port ? Number(args.port) : 8787;
  const host = args.host || "127.0.0.1";
  const shouldOpen = Boolean(args.open);

  process.env.LICENSE_WEB_PORT = String(port);
  process.env.LICENSE_WEB_HOST = host;
  process.env.LICENSE_WEB_OPEN = shouldOpen ? "1" : "0";

  require("./web");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";

  if (command === "help") return cmdHelp();
  if (command === "keygen") return cmdKeygen(args);
  if (command === "public-env") return cmdPublicEnv(args);
  if (command === "issue") return cmdIssue(args);
  if (command === "verify") return cmdVerify(args);
  if (command === "list") return cmdList(args);
  if (command === "revoke") return cmdRevoke(args);
  if (command === "web") return cmdWeb(args);

  throw new Error(`Comando no soportado: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${String(error?.message || error)}`);
  process.exit(1);
}
