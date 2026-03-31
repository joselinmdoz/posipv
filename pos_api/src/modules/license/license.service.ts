import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

type LicenseStatusCode =
  | "VALID"
  | "MISSING"
  | "INVALID_FORMAT"
  | "PUBLIC_KEY_MISSING"
  | "INVALID_SIGNATURE"
  | "DEVICE_MISMATCH"
  | "NOT_YET_VALID"
  | "EXPIRED"
  | "CLOCK_ROLLBACK";

type LicensePayload = {
  licenseId: string;
  deviceHash: string;
  issuedAt: string;
  validFrom?: string;
  expiresAt: string;
  customerName?: string;
  maxUsers?: number;
  features?: string[];
  [key: string]: unknown;
};

type LicenseEnvelope = {
  alg: "Ed25519";
  payload: LicensePayload;
  signature: string;
};

type LicenseEvaluation = {
  valid: boolean;
  code: LicenseStatusCode;
  message: string;
  payload?: LicensePayload;
  payloadHash?: string;
  envelope?: LicenseEnvelope;
  daysRemaining?: number | null;
};

type ActivationRequestPayload = {
  requestVersion: number;
  generatedAt: string;
  systemName: string;
  fingerprint: {
    deviceHash: string;
    platform: string;
    arch: string;
    hostnameHash: string;
    machineIdHash: string;
    macHashes: string[];
  };
};

type KeyPemSource = "OVERRIDE_FILE" | "ENV" | "DEFAULT" | "NONE";

@Injectable()
export class LicenseService {
  private readonly singletonId = "default";
  private readonly cacheTtlMs: number;
  private readonly clockRollbackToleranceMs: number;
  private readonly defaultPublicKeyPem =
    "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA4vmHiLMKXkaIck2YYT+3EGiJCLVgKoMC7QLtW87qdcE=\n-----END PUBLIC KEY-----";
  private readonly keyPemSecureDir = path.resolve(process.cwd(), "uploads", ".posipv", ".sys", ".secure", ".runtime");
  private readonly keyPemPasswordFile = path.join(this.keyPemSecureDir, ".kp.lock");
  private readonly keyPemOverrideFile = path.join(this.keyPemSecureDir, ".kp.pem");
  private readonly deviceHashPinFile = path.join(this.keyPemSecureDir, ".dv.hash");
  private readonly deviceInstallIdFile = path.join(this.keyPemSecureDir, ".dv.id");
  private statusCache: { at: number; value: any } | null = null;
  private deviceHashCache: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.cacheTtlMs = this.readPositiveInt("LICENSE_CACHE_TTL_MS", 15_000);
    this.clockRollbackToleranceMs = this.readPositiveInt("LICENSE_CLOCK_ROLLBACK_TOLERANCE_MS", 300_000);
  }

  async getLicenseStatus(force = false) {
    const now = Date.now();
    if (!force && this.statusCache && now - this.statusCache.at < this.cacheTtlMs) {
      return this.statusCache.value;
    }

    const row = await this.prisma.systemLicense.findUnique({
      where: { id: this.singletonId },
    });
    const deviceHash = this.getDeviceHash(row?.licenseData || null);

    const evaluation = this.evaluateLicense(row?.licenseData || null, {
      deviceHash,
      now: new Date(),
      lastSeenAt: row?.lastSeenAt || null,
    });

    const statusPayload = {
      valid: evaluation.valid,
      code: evaluation.code,
      message: evaluation.message,
      serverTime: new Date().toISOString(),
      deviceHash,
      daysRemaining: evaluation.daysRemaining ?? null,
      license: evaluation.payload
        ? {
            licenseId: evaluation.payload.licenseId,
            issuedAt: evaluation.payload.issuedAt,
            validFrom: evaluation.payload.validFrom || evaluation.payload.issuedAt,
            expiresAt: evaluation.payload.expiresAt,
            customerName: evaluation.payload.customerName || null,
            maxUsers: evaluation.payload.maxUsers ?? null,
            features: Array.isArray(evaluation.payload.features) ? evaluation.payload.features : [],
          }
        : null,
    };

    await this.persistEvaluation(row?.id || null, row?.licenseData || null, evaluation);
    this.statusCache = { at: now, value: statusPayload };
    return statusPayload;
  }

  async buildActivationRequest() {
    const deviceHash = this.getDeviceHash();
    const machineId = this.readMachineId();
    const hostname = os.hostname() || "unknown-host";
    const system = await this.prisma.systemSettings.findUnique({
      where: { id: "default" },
      select: { systemName: true },
    });

    const payload: ActivationRequestPayload = {
      requestVersion: 1,
      generatedAt: new Date().toISOString(),
      systemName: system?.systemName || "POS System",
      fingerprint: {
        deviceHash,
        platform: os.platform(),
        arch: os.arch(),
        hostnameHash: this.sha256(hostname),
        machineIdHash: this.sha256(machineId || "no-machine-id"),
        macHashes: this.getMacAddresses().map((mac) => this.sha256(mac)).slice(0, 12),
      },
    };

    return {
      ...payload,
      requestText: JSON.stringify(payload, null, 2),
    };
  }

  async activateLicense(input: unknown) {
    const rawText = this.extractLicenseText(input);
    const current = await this.prisma.systemLicense.findUnique({
      where: { id: this.singletonId },
    });
    const deviceHash = this.getDeviceHash(current?.licenseData || null);

    const evaluation = this.evaluateLicense(rawText, {
      deviceHash,
      now: new Date(),
      lastSeenAt: current?.lastSeenAt || null,
      skipClockRollback: true,
    });

    if (
      evaluation.code === "INVALID_FORMAT" ||
      evaluation.code === "PUBLIC_KEY_MISSING" ||
      evaluation.code === "INVALID_SIGNATURE" ||
      evaluation.code === "DEVICE_MISMATCH"
    ) {
      throw new BadRequestException(evaluation.message);
    }

    const payload = evaluation.payload!;
    await this.prisma.systemLicense.upsert({
      where: { id: this.singletonId },
      create: {
        id: this.singletonId,
        licenseData: rawText,
        payloadJson: payload as any,
        payloadHash: evaluation.payloadHash || null,
        licenseId: payload.licenseId,
        deviceHash: payload.deviceHash,
        issuedAt: this.parseIsoDate(payload.issuedAt),
        validFrom: this.parseIsoDate(payload.validFrom || payload.issuedAt),
        expiresAt: this.parseIsoDate(payload.expiresAt),
        features: Array.isArray(payload.features) ? payload.features : [],
        maxUsers: payload.maxUsers ?? null,
        status: evaluation.code,
        statusMessage: evaluation.message,
        lastValidatedAt: new Date(),
        lastSeenAt: new Date(),
      },
      update: {
        licenseData: rawText,
        payloadJson: payload as any,
        payloadHash: evaluation.payloadHash || null,
        licenseId: payload.licenseId,
        deviceHash: payload.deviceHash,
        issuedAt: this.parseIsoDate(payload.issuedAt),
        validFrom: this.parseIsoDate(payload.validFrom || payload.issuedAt),
        expiresAt: this.parseIsoDate(payload.expiresAt),
        features: Array.isArray(payload.features) ? payload.features : [],
        maxUsers: payload.maxUsers ?? null,
        status: evaluation.code,
        statusMessage: evaluation.message,
        lastValidatedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });

    this.pinDeviceHash(payload.deviceHash);
    this.statusCache = null;
    return this.getLicenseStatus(true);
  }

  getCurrentPublicKeyPem(password: string) {
    if (!this.verifyKeyPemPassword(password)) {
      throw new BadRequestException("Contraseña de seguridad inválida.");
    }
    const resolved = this.resolvePublicKeyPem();
    return {
      source: resolved.source,
      publicKeyPem: resolved.pem || "",
    };
  }

  setCurrentPublicKeyPem(password: string, inputPem: string) {
    if (!this.verifyKeyPemPassword(password)) {
      throw new BadRequestException("Contraseña de seguridad inválida.");
    }
    const normalized = this.normalizePublicKeyPem(inputPem);
    this.ensureKeyPemSecureDir();
    fs.writeFileSync(this.keyPemOverrideFile, normalized, { encoding: "utf8", mode: 0o600 });
    this.statusCache = null;
    return {
      source: "OVERRIDE_FILE" as KeyPemSource,
      publicKeyPem: normalized,
      message: "Clave pública actualizada correctamente.",
    };
  }

  async assertLicenseIsValid() {
    const status = await this.getLicenseStatus();
    if (!status.valid) {
      throw new BadRequestException(status.message);
    }
  }

  private async persistEvaluation(currentId: string | null, licenseData: string | null, evaluation: LicenseEvaluation) {
    const now = new Date();
    const payload = evaluation.payload;
    const nextLastSeenAt =
      evaluation.code === "CLOCK_ROLLBACK"
        ? undefined
        : now;

    await this.prisma.systemLicense.upsert({
      where: { id: currentId || this.singletonId },
      create: {
        id: this.singletonId,
        licenseData: licenseData || null,
        payloadJson: payload ? (payload as any) : null,
        payloadHash: evaluation.payloadHash || null,
        licenseId: payload?.licenseId || null,
        deviceHash: payload?.deviceHash || null,
        issuedAt: payload ? this.parseIsoDate(payload.issuedAt) : null,
        validFrom: payload ? this.parseIsoDate(payload.validFrom || payload.issuedAt) : null,
        expiresAt: payload ? this.parseIsoDate(payload.expiresAt) : null,
        features: payload && Array.isArray(payload.features) ? payload.features : [],
        maxUsers: payload?.maxUsers ?? null,
        status: evaluation.code,
        statusMessage: evaluation.message,
        lastValidatedAt: now,
        lastSeenAt: nextLastSeenAt || null,
      },
      update: {
        payloadJson: payload ? (payload as any) : null,
        payloadHash: evaluation.payloadHash || null,
        licenseId: payload?.licenseId || null,
        deviceHash: payload?.deviceHash || null,
        issuedAt: payload ? this.parseIsoDate(payload.issuedAt) : null,
        validFrom: payload ? this.parseIsoDate(payload.validFrom || payload.issuedAt) : null,
        expiresAt: payload ? this.parseIsoDate(payload.expiresAt) : null,
        features: payload && Array.isArray(payload.features) ? payload.features : [],
        maxUsers: payload?.maxUsers ?? null,
        status: evaluation.code,
        statusMessage: evaluation.message,
        lastValidatedAt: now,
        ...(nextLastSeenAt ? { lastSeenAt: nextLastSeenAt } : {}),
      },
    });
  }

  private evaluateLicense(
    licenseData: string | null,
    options: {
      deviceHash: string;
      now: Date;
      lastSeenAt: Date | null;
      skipClockRollback?: boolean;
    },
  ): LicenseEvaluation {
    if (!licenseData) {
      return this.evalResult(false, "MISSING", "No hay una licencia instalada.");
    }

    let envelope: LicenseEnvelope;
    try {
      envelope = this.parseEnvelope(licenseData);
    } catch (error: any) {
      return this.evalResult(false, "INVALID_FORMAT", error?.message || "Formato de licencia inválido.");
    }

    const publicKey = this.getPublicKeyPem();
    if (!publicKey) {
      return this.evalResult(false, "PUBLIC_KEY_MISSING", "No hay clave pública configurada para validar licencias.");
    }

    const payloadHash = this.sha256(this.canonicalJson(envelope.payload));
    const isSignatureValid = this.verifyEnvelopeSignature(envelope, publicKey);
    if (!isSignatureValid) {
      return this.evalResult(false, "INVALID_SIGNATURE", "La firma digital de la licencia no es válida.");
    }

    let payload: LicensePayload;
    try {
      payload = this.normalizePayload(envelope.payload);
    } catch (error: any) {
      return this.evalResult(false, "INVALID_FORMAT", error?.message || "Contenido de licencia inválido.");
    }

    if (payload.deviceHash !== options.deviceHash) {
      return this.evalResult(false, "DEVICE_MISMATCH", "La licencia no corresponde a este dispositivo.", {
        payload,
        payloadHash,
        envelope,
      });
    }

    if (!options.skipClockRollback && options.lastSeenAt) {
      const nowMs = options.now.getTime();
      const lastSeenMs = options.lastSeenAt.getTime();
      if (nowMs + this.clockRollbackToleranceMs < lastSeenMs) {
        return this.evalResult(
          false,
          "CLOCK_ROLLBACK",
          "Se detectó retroceso del reloj del sistema. Ajuste fecha/hora para continuar.",
          { payload, payloadHash, envelope },
        );
      }
    }

    const validFrom = this.parseIsoDate(payload.validFrom || payload.issuedAt);
    const expiresAt = this.parseIsoDate(payload.expiresAt);
    if (!validFrom || !expiresAt) {
      return this.evalResult(false, "INVALID_FORMAT", "Fechas de vigencia inválidas en la licencia.");
    }

    if (options.now.getTime() < validFrom.getTime()) {
      return this.evalResult(false, "NOT_YET_VALID", "La licencia aún no entra en vigencia.", {
        payload,
        payloadHash,
        envelope,
      });
    }

    if (options.now.getTime() > expiresAt.getTime()) {
      return this.evalResult(false, "EXPIRED", "La licencia ha expirado.", {
        payload,
        payloadHash,
        envelope,
      });
    }

    const daysRemaining = (expiresAt.getTime() - options.now.getTime()) / 86_400_000;
    return this.evalResult(true, "VALID", "Licencia válida.", {
      payload,
      payloadHash,
      envelope,
      daysRemaining: Number(daysRemaining.toFixed(2)),
    });
  }

  private evalResult(
    valid: boolean,
    code: LicenseStatusCode,
    message: string,
    extra?: Partial<LicenseEvaluation>,
  ): LicenseEvaluation {
    return {
      valid,
      code,
      message,
      payload: extra?.payload,
      payloadHash: extra?.payloadHash,
      envelope: extra?.envelope,
      daysRemaining: extra?.daysRemaining ?? null,
    };
  }

  private extractLicenseText(input: unknown): string {
    if (typeof input === "string") {
      const text = input.trim();
      if (!text) throw new BadRequestException("Debe proporcionar el contenido de la licencia.");
      return text;
    }

    if (input && typeof input === "object") {
      const obj = input as Record<string, unknown>;
      if (typeof obj.license === "string" && obj.license.trim()) {
        return obj.license.trim();
      }
      return JSON.stringify(obj);
    }

    throw new BadRequestException("Entrada de licencia no válida.");
  }

  private parseEnvelope(text: string): LicenseEnvelope {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadRequestException("La licencia debe ser un JSON válido.");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new BadRequestException("Estructura de licencia inválida.");
    }
    if (parsed.alg !== "Ed25519") {
      throw new BadRequestException("Algoritmo de firma no soportado. Se esperaba Ed25519.");
    }
    if (!parsed.payload || typeof parsed.payload !== "object" || Array.isArray(parsed.payload)) {
      throw new BadRequestException("El payload de la licencia es inválido.");
    }
    if (typeof parsed.signature !== "string" || !parsed.signature.trim()) {
      throw new BadRequestException("La licencia no contiene firma.");
    }

    return {
      alg: "Ed25519",
      payload: parsed.payload as LicensePayload,
      signature: parsed.signature.trim(),
    };
  }

  private normalizePayload(raw: LicensePayload): LicensePayload {
    const licenseId = String(raw.licenseId || "").trim();
    if (licenseId.length < 6 || licenseId.length > 160) {
      throw new BadRequestException("licenseId inválido en la licencia.");
    }

    const deviceHash = String(raw.deviceHash || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(deviceHash)) {
      throw new BadRequestException("deviceHash inválido en la licencia.");
    }

    const issuedAt = String(raw.issuedAt || "").trim();
    if (!this.parseIsoDate(issuedAt)) {
      throw new BadRequestException("issuedAt inválido en la licencia.");
    }

    const expiresAt = String(raw.expiresAt || "").trim();
    if (!this.parseIsoDate(expiresAt)) {
      throw new BadRequestException("expiresAt inválido en la licencia.");
    }

    const validFromInput = raw.validFrom !== undefined ? String(raw.validFrom || "").trim() : "";
    const validFrom = validFromInput || issuedAt;
    if (!this.parseIsoDate(validFrom)) {
      throw new BadRequestException("validFrom inválido en la licencia.");
    }

    const features = Array.isArray(raw.features)
      ? Array.from(
          new Set(
            raw.features
              .map((item) => String(item || "").trim())
              .filter((item) => item.length > 0 && item.length <= 80),
          ),
        ).slice(0, 120)
      : [];

    let maxUsers: number | undefined = undefined;
    if (raw.maxUsers !== undefined && raw.maxUsers !== null) {
      const n = Number(raw.maxUsers);
      if (!Number.isInteger(n) || n <= 0 || n > 1_000_000) {
        throw new BadRequestException("maxUsers inválido en la licencia.");
      }
      maxUsers = n;
    }

    return {
      ...raw,
      licenseId,
      deviceHash,
      issuedAt,
      validFrom,
      expiresAt,
      features,
      ...(maxUsers !== undefined ? { maxUsers } : {}),
    };
  }

  private verifyEnvelopeSignature(envelope: LicenseEnvelope, publicKeyPem: string): boolean {
    try {
      const message = Buffer.from(this.canonicalJson(envelope.payload), "utf8");
      const signature = this.decodeBase64(envelope.signature);
      return crypto.verify(null, message, publicKeyPem, signature);
    } catch {
      return false;
    }
  }

  private decodeBase64(value: string): Buffer {
    const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + padding, "base64");
  }

  private getPublicKeyPem(): string | null {
    return this.resolvePublicKeyPem().pem;
  }

  private resolvePublicKeyPem(): { pem: string | null; source: KeyPemSource } {
    const filePem = this.readPublicKeyPemFromFile();
    if (filePem) return { pem: filePem, source: "OVERRIDE_FILE" };

    const raw = String(this.config.get<string>("LICENSE_PUBLIC_KEY_PEM") || "").trim();
    if (raw) {
      const fromEnv = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
      const normalizedEnv = this.tryNormalizePublicKeyPem(fromEnv);
      if (normalizedEnv) return { pem: normalizedEnv, source: "ENV" };
    }

    const normalizedDefault = this.tryNormalizePublicKeyPem(this.defaultPublicKeyPem);
    if (normalizedDefault) return { pem: normalizedDefault, source: "DEFAULT" };

    return { pem: null, source: "NONE" };
  }

  private normalizePublicKeyPem(input: string): string {
    const text = String(input || "").trim();
    if (!text) {
      throw new BadRequestException("Debe proporcionar una clave pública.");
    }
    const withLines = text.includes("\\n") ? text.replace(/\\n/g, "\n") : text;
    const normalized = withLines.replace(/\r\n/g, "\n").trim();
    if (!normalized.startsWith("-----BEGIN PUBLIC KEY-----") || !normalized.endsWith("-----END PUBLIC KEY-----")) {
      throw new BadRequestException("Formato PEM inválido para clave pública.");
    }
    try {
      crypto.createPublicKey(normalized);
    } catch {
      throw new BadRequestException("La clave pública PEM no es válida.");
    }
    return normalized;
  }

  private tryNormalizePublicKeyPem(input: string): string | null {
    try {
      return this.normalizePublicKeyPem(input);
    } catch {
      return null;
    }
  }

  private readPublicKeyPemFromFile(): string | null {
    try {
      if (!fs.existsSync(this.keyPemOverrideFile)) return null;
      const text = fs.readFileSync(this.keyPemOverrideFile, "utf8");
      return this.tryNormalizePublicKeyPem(text);
    } catch {
      return null;
    }
  }

  private ensureKeyPemSecureDir() {
    fs.mkdirSync(this.keyPemSecureDir, { recursive: true });
  }

  private verifyKeyPemPassword(input: string): boolean {
    const provided = String(input || "");
    if (!provided) return false;
    const expected = this.readKeyPemPassword();
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  private readKeyPemPassword(): string {
    this.ensureKeyPemSecureDir();
    if (!fs.existsSync(this.keyPemPasswordFile)) {
      this.writeEncryptedPassword(this.defaultKeyPemPassword());
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.keyPemPasswordFile, "utf8")) as any;
      const encrypted = String(raw?.password || "").trim();
      if (!encrypted) throw new Error("missing encrypted password");
      return this.decryptWithLocalKey(encrypted);
    } catch {
      this.writeEncryptedPassword(this.defaultKeyPemPassword());
      const raw = JSON.parse(fs.readFileSync(this.keyPemPasswordFile, "utf8")) as any;
      return this.decryptWithLocalKey(String(raw.password || ""));
    }
  }

  private writeEncryptedPassword(password: string) {
    this.ensureKeyPemSecureDir();
    const payload = {
      v: 1,
      createdAt: new Date().toISOString(),
      password: this.encryptWithLocalKey(password),
    };
    fs.writeFileSync(this.keyPemPasswordFile, JSON.stringify(payload), { encoding: "utf8", mode: 0o600 });
  }

  private buildLocalSecretKey(): Buffer {
    const seed = [
      String(this.config.get<string>("JWT_SECRET") || ""),
      this.getDeviceHash(),
      os.platform(),
      os.arch(),
      os.hostname(),
      this.readMachineId(),
      "posipv:keypem:v1",
    ].join("|");
    const salt = this.sha256(`${os.platform()}|${os.arch()}|local-keypem-salt`);
    return crypto.scryptSync(seed, salt, 32);
  }

  private encryptWithLocalKey(plainText: string): string {
    const key = this.buildLocalSecretKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(plainText, "utf8")), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
  }

  private decryptWithLocalKey(encryptedText: string): string {
    const [ivB64, tagB64, payloadB64] = String(encryptedText || "").split(".");
    if (!ivB64 || !tagB64 || !payloadB64) {
      throw new Error("invalid encrypted text");
    }
    const key = this.buildLocalSecretKey();
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const payload = Buffer.from(payloadB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(payload), decipher.final()]);
    return plain.toString("utf8");
  }

  private defaultKeyPemPassword(): string {
    return String.fromCharCode(87, 100, 48, 122, 42, 54, 54, 54);
  }

  private getDeviceHash(licenseDataForRecovery?: string | null): string {
    if (this.deviceHashCache) return this.deviceHashCache;

    const pinned = this.readPinnedDeviceHash();
    if (pinned) {
      this.deviceHashCache = pinned;
      return this.deviceHashCache;
    }

    const recoveredFromLicense = this.tryRecoverDeviceHashFromLicense(licenseDataForRecovery || null);
    if (recoveredFromLicense) {
      this.pinDeviceHash(recoveredFromLicense);
      return recoveredFromLicense;
    }

    const stableHash = this.computeStableDeviceHash();
    this.pinDeviceHash(stableHash);
    return stableHash;
  }

  private tryRecoverDeviceHashFromLicense(licenseData: string | null): string | null {
    if (!licenseData) return null;
    try {
      const envelope = this.parseEnvelope(licenseData);
      const publicKey = this.getPublicKeyPem();
      if (!publicKey) return null;
      if (!this.verifyEnvelopeSignature(envelope, publicKey)) return null;
      const payload = this.normalizePayload(envelope.payload);
      if (!/^[a-f0-9]{64}$/.test(payload.deviceHash)) return null;
      return payload.deviceHash;
    } catch {
      return null;
    }
  }

  private computeStableDeviceHash(): string {
    const machineId = this.readMachineId() || "no-machine-id";
    const installSeed = String(this.config.get<string>("LICENSE_DEVICE_SEED") || "").trim();
    const installId = this.getOrCreateInstallId();

    const parts = [
      `platform:${os.platform()}`,
      `arch:${os.arch()}`,
      `machine:${machineId}`,
      `install:${installId}`,
    ];

    if (installSeed) {
      parts.push(`seed:${installSeed}`);
    }

    const canonical = parts.map((item) => item.trim().toLowerCase()).sort().join("|");
    return this.sha256(canonical);
  }

  private pinDeviceHash(value: string) {
    const hash = String(value || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) return;

    this.ensureKeyPemSecureDir();
    try {
      fs.writeFileSync(this.deviceHashPinFile, hash, { encoding: "utf8", mode: 0o600 });
    } catch {
      // no-op: if pinning fails, hash seguirá en memoria para la sesión actual.
    }
    this.deviceHashCache = hash;
  }

  private readPinnedDeviceHash(): string | null {
    try {
      if (!fs.existsSync(this.deviceHashPinFile)) return null;
      const value = fs.readFileSync(this.deviceHashPinFile, "utf8").trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(value)) return null;
      return value;
    } catch {
      return null;
    }
  }

  private getOrCreateInstallId(): string {
    this.ensureKeyPemSecureDir();
    try {
      if (fs.existsSync(this.deviceInstallIdFile)) {
        const existing = fs.readFileSync(this.deviceInstallIdFile, "utf8").trim().toLowerCase();
        if (/^[a-f0-9]{24,128}$/.test(existing)) return existing;
      }
    } catch {
      // noop
    }

    const generated = crypto.randomBytes(24).toString("hex");
    try {
      fs.writeFileSync(this.deviceInstallIdFile, generated, { encoding: "utf8", mode: 0o600 });
    } catch {
      // noop
    }
    return generated;
  }

  private readMachineId(): string {
    const candidates = ["/etc/machine-id", "/var/lib/dbus/machine-id", "/sys/class/dmi/id/product_uuid"];
    for (const filePath of candidates) {
      try {
        const value = fs.readFileSync(filePath, "utf8").trim();
        if (value) return value;
      } catch {
        continue;
      }
    }
    return "";
  }

  private getMacAddresses(): string[] {
    const network = os.networkInterfaces();
    const macs = new Set<string>();
    for (const [, infos] of Object.entries(network)) {
      for (const info of infos || []) {
        if (!info || info.internal) continue;
        const mac = String(info.mac || "").trim().toLowerCase();
        if (!mac || mac === "00:00:00:00:00:00") continue;
        macs.add(mac);
      }
    }
    return Array.from(macs).sort();
  }

  private parseIsoDate(value: string | undefined | null): Date | null {
    const text = String(value || "").trim();
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  private sha256(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  private canonicalJson(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "string") return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalJson(item)).join(",")}]`;
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
      const body = keys
        .map((key) => `${JSON.stringify(key)}:${this.canonicalJson(obj[key])}`)
        .join(",");
      return `{${body}}`;
    }
    return JSON.stringify(String(value));
  }

  private readPositiveInt(envKey: string, fallback: number): number {
    const raw = Number(this.config.get<string>(envKey));
    if (!Number.isFinite(raw) || raw <= 0) return fallback;
    return Math.floor(raw);
  }
}
