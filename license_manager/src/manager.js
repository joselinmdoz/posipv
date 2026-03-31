const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

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

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toAbsolute(filePath) {
  return path.resolve(process.cwd(), filePath);
}

function readJson(filePath) {
  const abs = toAbsolute(filePath);
  const text = fs.readFileSync(abs, "utf8");
  return JSON.parse(text);
}

function writeJson(filePath, value) {
  const abs = toAbsolute(filePath);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, JSON.stringify(value, null, 2));
}

function normalizeIsoDate(input, label) {
  const text = String(input || "").trim();
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) {
    throw new Error(`${label} invalido. Usa formato ISO-8601 (ej: 2026-03-28T20:00:00.000Z).`);
  }
  return date.toISOString();
}

function normalizePositiveInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} debe ser entero positivo.`);
  }
  return n;
}

function escapePemForEnv(pem) {
  return String(pem).trim().replace(/\r\n/g, "\n").replace(/\n/g, "\\n");
}

function loadRegistry(dbPath) {
  const abs = toAbsolute(dbPath);
  if (!fs.existsSync(abs)) {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      licenses: [],
    };
  }
  const parsed = readJson(dbPath);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.licenses)) {
    throw new Error(`Base de gestion invalida en ${dbPath}`);
  }
  return parsed;
}

function saveRegistry(dbPath, registry) {
  registry.updatedAt = new Date().toISOString();
  writeJson(dbPath, registry);
}

function extractDeviceHash(requestJson) {
  const direct = String(requestJson?.deviceHash || "").trim();
  if (/^[a-f0-9]{64}$/i.test(direct)) return direct.toLowerCase();

  const nested = String(requestJson?.fingerprint?.deviceHash || "").trim();
  if (/^[a-f0-9]{64}$/i.test(nested)) return nested.toLowerCase();

  throw new Error("No se encontro deviceHash valido en la solicitud.");
}

function toFeatures(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function generateKeys(options = {}) {
  const outDir = toAbsolute(options.outDir || "./keys");
  ensureDir(outDir);
  const pair = crypto.generateKeyPairSync("ed25519");
  const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
  const publicPem = pair.publicKey.export({ type: "spki", format: "pem" });

  const privateFile = path.join(outDir, "license-private.pem");
  const publicFile = path.join(outDir, "license-public.pem");

  fs.writeFileSync(privateFile, privatePem);
  fs.writeFileSync(publicFile, publicPem);

  return {
    outDir,
    privateFile,
    publicFile,
  };
}

function buildPublicEnv(options = {}) {
  if (!options.publicFile) {
    throw new Error("Falta publicFile");
  }
  const publicPem = fs.readFileSync(toAbsolute(options.publicFile), "utf8");
  return `LICENSE_PUBLIC_KEY_PEM=${escapePemForEnv(publicPem)}`;
}

function issueLicense(options = {}) {
  const privateFile = String(options.privateFile || "").trim();
  const licenseId = String(options.licenseId || "").trim();
  if (!privateFile) throw new Error("Falta privateFile");
  if (!licenseId) throw new Error("Falta licenseId");
  if (licenseId.length < 6) throw new Error("licenseId debe tener al menos 6 caracteres.");

  let requestJson = options.requestData;
  if (!requestJson) {
    if (!options.requestFile) {
      throw new Error("Falta requestFile o requestData");
    }
    requestJson = readJson(options.requestFile);
  }

  const deviceHash = extractDeviceHash(requestJson);

  const issuedAt = options.issuedAt
    ? normalizeIsoDate(options.issuedAt, "issuedAt")
    : new Date().toISOString();

  const validFrom = options.validFrom
    ? normalizeIsoDate(options.validFrom, "validFrom")
    : issuedAt;

  let expiresAt;
  if (options.expiresAt) {
    expiresAt = normalizeIsoDate(options.expiresAt, "expiresAt");
  } else {
    const days = options.days ? normalizePositiveInt(options.days, "days") : 365;
    const baseDate = new Date(validFrom);
    expiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  const maxUsers = options.maxUsers ? normalizePositiveInt(options.maxUsers, "maxUsers") : undefined;
  const features = toFeatures(options.features);

  const payload = {
    licenseId,
    deviceHash,
    issuedAt,
    validFrom,
    expiresAt,
    ...(options.customer ? { customerName: String(options.customer).trim() } : {}),
    ...(maxUsers !== undefined ? { maxUsers } : {}),
    ...(features.length ? { features } : {}),
  };

  const privatePem = fs.readFileSync(toAbsolute(privateFile), "utf8");
  const message = Buffer.from(canonicalJson(payload), "utf8");
  const signature = crypto.sign(null, message, privatePem).toString("base64");

  const envelope = {
    alg: "Ed25519",
    payload,
    signature,
  };

  const outFile = toAbsolute(options.outFile || `./out/${licenseId}.dat`);
  ensureDir(path.dirname(outFile));
  fs.writeFileSync(outFile, JSON.stringify(envelope, null, 2));

  const dbPath = options.dbPath || "./data/licenses.json";
  const registry = loadRegistry(dbPath);
  const idx = registry.licenses.findIndex((item) => item.licenseId === licenseId);
  const record = {
    licenseId,
    deviceHash,
    issuedAt,
    validFrom,
    expiresAt,
    customerName: payload.customerName || null,
    maxUsers: payload.maxUsers ?? null,
    features: payload.features || [],
    payloadHash: sha256(canonicalJson(payload)),
    signatureHash: sha256(signature),
    status: "ACTIVE",
    generatedAt: new Date().toISOString(),
    sourceRequestFile: options.requestFile ? toAbsolute(options.requestFile) : "WEB/INLINE",
    outputFile: outFile,
  };

  if (idx >= 0) {
    registry.licenses[idx] = { ...registry.licenses[idx], ...record };
  } else {
    registry.licenses.push(record);
  }
  saveRegistry(dbPath, registry);

  return {
    outFile,
    dbPath: toAbsolute(dbPath),
    payload,
    envelope,
    record,
  };
}

function verifyLicense(options = {}) {
  if (!options.publicFile) throw new Error("Falta publicFile");
  if (!options.licenseFile) throw new Error("Falta licenseFile");

  const publicPem = fs.readFileSync(toAbsolute(options.publicFile), "utf8");
  const envelope = readJson(options.licenseFile);

  if (!envelope || envelope.alg !== "Ed25519" || typeof envelope.signature !== "string" || typeof envelope.payload !== "object") {
    throw new Error("Formato de licencia invalido.");
  }

  const message = Buffer.from(canonicalJson(envelope.payload), "utf8");
  const signature = Buffer.from(envelope.signature, "base64");
  const valid = crypto.verify(null, message, publicPem, signature);

  return {
    valid,
    licenseId: envelope.payload.licenseId || null,
    deviceHash: envelope.payload.deviceHash || null,
    issuedAt: envelope.payload.issuedAt || null,
    validFrom: envelope.payload.validFrom || null,
    expiresAt: envelope.payload.expiresAt || null,
    payloadHash: sha256(canonicalJson(envelope.payload)),
  };
}

function listLicenses(options = {}) {
  const dbPath = options.dbPath || "./data/licenses.json";
  const registry = loadRegistry(dbPath);
  return {
    dbPath: toAbsolute(dbPath),
    licenses: registry.licenses || [],
  };
}

function revokeLicense(options = {}) {
  const dbPath = options.dbPath || "./data/licenses.json";
  const licenseId = String(options.licenseId || "").trim();
  const reason = String(options.reason || "Revocada manualmente").trim();

  if (!licenseId) {
    throw new Error("Falta licenseId");
  }

  const registry = loadRegistry(dbPath);
  const idx = registry.licenses.findIndex((item) => item.licenseId === licenseId);
  if (idx < 0) {
    throw new Error(`No existe licencia ${licenseId} en registry.`);
  }

  registry.licenses[idx] = {
    ...registry.licenses[idx],
    status: "REVOKED",
    revokedAt: new Date().toISOString(),
    revokeReason: reason,
  };
  saveRegistry(dbPath, registry);

  return {
    dbPath: toAbsolute(dbPath),
    record: registry.licenses[idx],
  };
}

module.exports = {
  canonicalJson,
  sha256,
  toAbsolute,
  normalizeIsoDate,
  normalizePositiveInt,
  extractDeviceHash,
  generateKeys,
  buildPublicEnv,
  issueLicense,
  verifyLicense,
  listLicenses,
  revokeLicense,
};
