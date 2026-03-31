const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const { exec } = require("child_process");
const {
  buildPublicEnv,
  generateKeys,
  issueLicense,
  listLicenses,
  revokeLicense,
  verifyLicense,
} = require("./manager");

const host = process.env.LICENSE_WEB_HOST || "127.0.0.1";
const port = Number(process.env.LICENSE_WEB_PORT || "8787");
const shouldOpen = process.env.LICENSE_WEB_OPEN === "1";
const htmlPath = path.join(__dirname, "web.html");

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res) {
  const html = fs.readFileSync(htmlPath, "utf8");
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > 1024 * 1024) {
        reject(new Error("Body demasiado grande (max 1MB)."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function toOptionalText(value) {
  const text = String(value ?? "").trim();
  return text.length ? text : undefined;
}

function toOptionalNumber(value) {
  const text = String(value ?? "").trim();
  if (!text.length) return undefined;
  const n = Number(text);
  if (!Number.isFinite(n)) {
    throw new Error(`Numero invalido: ${value}`);
  }
  return n;
}

async function handleApi(req, res, urlObj) {
  if (req.method === "GET" && urlObj.pathname === "/api/licenses") {
    const dbPath = urlObj.searchParams.get("dbPath") || "./data/licenses.json";
    const result = listLicenses({ dbPath });
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Metodo no permitido" });
  }

  let payload = {};
  try {
    const raw = await readBody(req);
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: `Body JSON invalido: ${String(error.message || error)}` });
  }

  try {
    if (urlObj.pathname === "/api/keygen") {
      const result = generateKeys({ outDir: toOptionalText(payload.outDir) || "./keys" });
      return sendJson(res, 200, { ok: true, result });
    }

    if (urlObj.pathname === "/api/public-env") {
      const publicFile = toOptionalText(payload.publicFile);
      if (!publicFile) throw new Error("publicFile es requerido");
      const envLine = buildPublicEnv({ publicFile });
      return sendJson(res, 200, { ok: true, envLine });
    }

    if (urlObj.pathname === "/api/issue") {
      const requestJsonText = toOptionalText(payload.requestJsonText);
      let requestData;
      if (requestJsonText) {
        requestData = JSON.parse(requestJsonText);
      }

      const result = issueLicense({
        privateFile: toOptionalText(payload.privateFile),
        requestFile: toOptionalText(payload.requestFile),
        requestData,
        licenseId: toOptionalText(payload.licenseId),
        days: toOptionalNumber(payload.days),
        issuedAt: toOptionalText(payload.issuedAt),
        validFrom: toOptionalText(payload.validFrom),
        expiresAt: toOptionalText(payload.expiresAt),
        customer: toOptionalText(payload.customer),
        maxUsers: toOptionalNumber(payload.maxUsers),
        features: toOptionalText(payload.features),
        outFile: toOptionalText(payload.outFile),
        dbPath: toOptionalText(payload.dbPath),
      });

      return sendJson(res, 200, {
        ok: true,
        result: {
          outFile: result.outFile,
          dbPath: result.dbPath,
          licenseId: result.record.licenseId,
          expiresAt: result.record.expiresAt,
          status: result.record.status,
        },
      });
    }

    if (urlObj.pathname === "/api/verify") {
      const result = verifyLicense({
        publicFile: toOptionalText(payload.publicFile),
        licenseFile: toOptionalText(payload.licenseFile),
      });
      return sendJson(res, 200, { ok: true, result });
    }

    if (urlObj.pathname === "/api/revoke") {
      const result = revokeLicense({
        dbPath: toOptionalText(payload.dbPath),
        licenseId: toOptionalText(payload.licenseId),
        reason: toOptionalText(payload.reason),
      });
      return sendJson(res, 200, {
        ok: true,
        result: {
          licenseId: result.record.licenseId,
          status: result.record.status,
          revokedAt: result.record.revokedAt,
          reason: result.record.revokeReason,
        },
      });
    }

    return sendJson(res, 404, { ok: false, error: "Endpoint no encontrado" });
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: String(error.message || error) });
  }
}

const server = http.createServer(async (req, res) => {
  const base = req.headers.host ? `http://${req.headers.host}` : `http://${host}:${port}`;
  const urlObj = new URL(req.url, base);

  if (req.method === "GET" && urlObj.pathname === "/") {
    return sendHtml(res);
  }

  if (urlObj.pathname.startsWith("/api/")) {
    return handleApi(req, res, urlObj);
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.on("error", (error) => {
  const code = String(error && error.code ? error.code : "");
  if (code === "EADDRINUSE") {
    console.error(`ERROR: el puerto ${port} ya esta en uso.`);
  } else if (code === "EACCES" || code === "EPERM") {
    console.error(`ERROR: no hay permisos para abrir ${host}:${port}.`);
  } else {
    console.error(`ERROR: no se pudo iniciar el panel web (${String(error.message || error)}).`);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  console.log(`License Manager Web: ${url}`);

  if (shouldOpen) {
    const cmd = process.platform === "darwin"
      ? `open ${url}`
      : process.platform === "win32"
        ? `start ${url}`
        : `xdg-open ${url}`;
    exec(cmd, () => {});
  }
});
