import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import nodemailer from "nodemailer";
import {
  createDevelopmentAdminAccount,
  shouldUseDevelopmentFallback,
} from "./src/auth/fallback";
import { hashPassword, verifyPassword } from "./src/auth/password";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads in memory (prevents disk usage on cloud platforms)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  // Removed fileSize limit to allow large uploads (admin-only uploads)
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/jpg",
      "image/x-png",
      "image/svg+xml",
    ];
    const normalizedMime = (file.mimetype || "").toLowerCase();
    if (
      allowedMimes.includes(normalizedMime) ||
      normalizedMime.startsWith("image/")
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."
        )
      );
    }
  },
});

const JWT_SECRET = process.env.JWT_SECRET || "default_secret_for_dev";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET must be set in production. Refusing to start with the built-in development secret, " +
      "which would let anyone mint a valid admin session."
  );
}

/* -------------------------------------------------------------------------
 * Who counts as an admin.
 *
 * One definition, used by every protected route. It deliberately has NO
 * NODE_ENV escape hatch: six route handlers previously ended their check with
 * `|| process.env.NODE_ENV !== "production"`, so a deploy that simply forgot
 * to set that variable authorised every upload, edit, reorder and delete on
 * the site for anyone at all — silently, with no error to notice.
 *
 * The email allowlist exists so an account whose DB role hasn't been promoted
 * yet still works. Override it with ADMIN_EMAILS (comma separated) instead of
 * editing code.
 * ---------------------------------------------------------------------- */
const ADMIN_EMAIL_ALLOWLIST = new Set(
  String(
    process.env.ADMIN_EMAILS ||
      "24r01a66v9@cmrithyderabad.edu.in,admin@ikshana.local"
  )
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
);

const isAdminUser = (req: any): boolean => {
  if (String(req?.user?.role || "").toLowerCase() === "admin") return true;
  const email = String(req?.user?.email || "").trim().toLowerCase();
  return email !== "" && ADMIN_EMAIL_ALLOWLIST.has(email);
};

/**
 * True when Supabase/PostgREST is telling us a table simply isn't there yet.
 *
 * Several features depend on tables created by
 * db/pending/2026-09-06_site_features.sql. Until that runs, their routes
 * report "unavailable" instead of 500ing, so the site works in both states.
 *
 * Note that PGRST205 ("could not find the table in the schema cache") is
 * ambiguous — it also fires when PostgREST's cache is merely stale — so this
 * is only ever used to degrade a feature gracefully, never to conclude that
 * data has been lost.
 */
const isMissingTableError = (error: any): boolean => {
  const text = `${error?.message || ""} ${error?.code || ""} ${error?.details || ""}`.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("relation") ||
    error?.code === "42p01" ||
    error?.code === "pgrst205"
  );
};

const MISSING_TABLE_HINT =
  "highlight_prefs table not found — run db/pending/2026-09-06_site_features.sql in Supabase to enable pinning.";

/* -------------------------------------------------------------------------
 * Minimal in-memory rate limiter for the three endpoints the public can write
 * to. Dependency-free and per-process, which is enough to stop review spam and
 * to stop the help-request status lookup being walked phone number by phone
 * number. If this ever runs on more than one instance it needs a shared store.
 * ---------------------------------------------------------------------- */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const rateLimit = (opts: { windowMs: number; max: number; key: string }) => {
  return (req: any, res: any, next: any) => {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const ip = forwarded || req.ip || req.socket?.remoteAddress || "unknown";
    const id = `${opts.key}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(id);

    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(id, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    if (bucket.count >= opts.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      const minutes = Math.ceil(retryAfter / 60);
      return res.status(429).json({
        error:
          retryAfter < 90
            ? `Too many attempts. Please try again in ${retryAfter} seconds.`
            : `Too many attempts. Please try again in about ${minutes} minutes.`,
      });
    }

    bucket.count += 1;
    return next();
  };
};

const rateBucketSweep = setInterval(() => {
  const now = Date.now();
  rateBuckets.forEach((bucket, key) => {
    if (now > bucket.resetAt) rateBuckets.delete(key);
  });
}, 10 * 60 * 1000);
if (typeof rateBucketSweep.unref === "function") rateBucketSweep.unref();

const createMailTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user,
      pass,
    },
  });
};

const sendPasswordResetEmail = async (toEmail: string, resetUrl: string) => {
  const transporter = createMailTransporter();

  if (!transporter) {
    console.log(
      `[dev] SMTP not configured. Password reset link for ${toEmail}: ${resetUrl}`
    );
    return {
      sent: false,
      resetUrl,
      reason:
        "SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not set in .env",
    };
  }

  try {
    // Set a timeout for email sending (5 seconds)
    const emailPromise = transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        process.env.SMTP_USER ||
        "no-reply@ikshana.local",
      to: toEmail,
      subject: "Reset your Ikshana password",
      html: `<p>Hello,</p><p>Use the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Email sending timeout")), 5000)
    );

    await Promise.race([emailPromise, timeoutPromise]);
    console.log(`[email] Password reset email sent to ${toEmail}`);
    return { sent: true, resetUrl };
  } catch (err: any) {
    console.error("Failed to send email via SMTP:", err?.message || err);
    // Still return the reset URL so user can proceed
    return {
      sent: false,
      resetUrl,
      reason:
        "Email could not be sent, but you can use the reset link directly",
    };
  }
};

function normalizeEventRecord(event: any) {
  if (!event) return event;
  return {
    ...event,
    activities:
      typeof event.activities === "string"
        ? JSON.parse(event.activities)
        : event.activities || [],
  };
}

function parseEventDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const match = text.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})$/i,
  );
  if (!match) return null;

  const months: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };

  const month = months[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (!month || !Number.isInteger(day) || !Number.isInteger(year)) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Supabase Setup (Mandatory)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "FATAL CONFIG ERROR: SUPABASE_URL and Supabase keys must be defined."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const isSecretKey = Boolean(
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);
console.log(
  `Connected to Supabase using ${
    isSecretKey ? "Secret Key (RLS Bypassed)" : "Anon Key (Subject to RLS)"
  }.`
);

// Helper: Upload file buffer to Supabase Storage with a local fallback
async function uploadToSupabaseStorage(
  file: any,
  bucketName: string = "photos"
): Promise<string> {
  const fileExt = path.extname(file.originalname);
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const fileName = `img-${uniqueSuffix}${fileExt}`;

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucketName).getPublicUrl(fileName);

    return publicUrl;
  } catch (error: any) {
    console.error(
      "Supabase Storage Upload Error, using local fallback:",
      error
    );

    const uploadsDir = path.join(__dirname, "uploads");
    await fs.promises.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, fileName);
    await fs.promises.writeFile(filePath, file.buffer);

    return `/uploads/${fileName}`;
  }
}

// Append a local photo metadata record to uploads/manifest.json for offline fallback
async function appendLocalPhotoManifest(record: any) {
  try {
    const uploadsDir = path.join(__dirname, "uploads");
    await fs.promises.mkdir(uploadsDir, { recursive: true });
    const manifestPath = path.join(uploadsDir, "manifest.json");
    let manifest = [] as any[];
    try {
      const existing = await fs.promises.readFile(manifestPath, "utf8");
      manifest = JSON.parse(existing || "[]");
    } catch (e) {
      manifest = [];
    }

    record.created_at = record.created_at || new Date().toISOString();
    manifest.unshift(record);
    await fs.promises.writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      "utf8"
    );
    console.log("[DEBUG] Appended local photo manifest entry:", record.url);
  } catch (e) {
    console.error("[DEBUG] Failed to append local photo manifest:", e);
  }
}

// Helper: Delete file from Supabase Storage by its public URL
async function deleteFromSupabaseStorage(
  url: string,
  bucketName: string = "photos"
): Promise<void> {
  try {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      console.error("Supabase Storage Delete Error:", error);
    }
  } catch (e) {
    console.error("Failed to parse/delete file from Supabase Storage:", e);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const host = "0.0.0.0";

  const listenWithFallback = async (port: number): Promise<number> => {
    return await new Promise<number>((resolve, reject) => {
      const server = app.listen(port, host, () => resolve(port));
      server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE" && port < 3010) {
          console.warn(`Port ${port} is busy, trying ${port + 1}...`);
          server.close(() => {
            listenWithFallback(port + 1)
              .then(resolve)
              .catch(reject);
          });
        } else {
          reject(error);
        }
      });
    });
  };

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  // CORS middleware: allow local frontend during development and handle preflight
  const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
  app.use((req: any, res: any, next: any) => {
    const origin = req.get("origin");
    if (!origin) {
      // non-browser requests (curl, server-side) - allow
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Ikshana-Token"
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  const developmentAdminAccount = shouldUseDevelopmentFallback({
    NODE_ENV: process.env.NODE_ENV,
  })
    ? await createDevelopmentAdminAccount({
        NODE_ENV: process.env.NODE_ENV,
        DEFAULT_ADMIN_EMAIL: process.env.DEFAULT_ADMIN_EMAIL,
        DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD,
      })
    : null;

  // Serve uploaded files as static assets (fallback for local files)
  const uploadsDir = path.join(__dirname, "uploads");
  app.use("/uploads", express.static(uploadsDir));

  // Health check for deployment platforms
  app.get("/health", (req, res) => res.status(200).send("ok"));

  app.get("/favicon.ico", (req, res) => {
    res.type("image/x-icon").send("");
  });

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const cookieToken = req.cookies?.token || "";
    const authHeader = req.headers.authorization || "";
    const fallbackHeaderToken = req.headers["x-ikshana-token"] || "";
    const headerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";
    const token = cookieToken || headerToken || fallbackHeaderToken;

    // No implicit-admin fallback. This used to fall through to a synthetic
    // development admin both when no token was presented at all and when JWT
    // verification failed outright, whenever NODE_ENV !== "production". That
    // made every admin route an open endpoint the moment the variable was
    // missing on a deploy. The development admin still exists — but it is only
    // reachable by actually signing in through /api/auth/login with its password.
    if (!token) {
      return res.status(401).json({ error: "Please sign in to continue." });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res
          .status(401)
          .json({ error: "Your session has expired. Please sign in again." });
      }
      req.user = user;
      next();
    });
  };

  const authenticateOptionalToken = (req: any, res: any, next: any) => {
    const cookieToken = req.cookies.token;
    const authHeader = req.headers.authorization || "";
    const fallbackHeaderToken = req.headers["x-ikshana-token"] || "";
    const headerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";
    const token = cookieToken || headerToken || fallbackHeaderToken;

    if (!token) {
      req.user = null;
      return next();
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        req.user = null;
        return next();
      }
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    try {
      const hashedPassword = await hashPassword(password);
      const role =
        cleanEmail === "24r01a66v9@cmrithyderabad.edu.in" ? "admin" : "user";

      const { data, error } = await supabase
        .from("users")
        .insert([
          {
            name: String(name).trim(),
            email: cleanEmail,
            password: hashedPassword,
            role,
          },
        ])
        .select();

      if (error) {
        if (error.code === "23505") {
          return res.status(400).json({ error: "Email already exists" });
        }
        throw error;
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Registration failed:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    try {
      // If development fallback is enabled and the requested email is one of the fallback emails,
      // authenticate using the local development admin account without calling Supabase (avoids DNS errors).
      if (developmentAdminAccount) {
        const normalizedFallbackEmails = developmentAdminAccount.emails.map(
          (candidate) => candidate.toLowerCase()
        );
        if (normalizedFallbackEmails.includes(email)) {
          const validPassword =
            password === developmentAdminAccount.password ||
            (await bcrypt.compare(
              password,
              developmentAdminAccount.passwordHash
            ));
          if (!validPassword) {
            return res.status(401).json({ error: "Invalid credentials" });
          }

          const fallbackEmail =
            developmentAdminAccount.emails.find(
              (candidate) => candidate.toLowerCase() === email
            ) || developmentAdminAccount.emails[0];
          const token = jwt.sign(
            {
              id: 0,
              name: developmentAdminAccount.name,
              email: fallbackEmail,
              role: developmentAdminAccount.role,
            },
            JWT_SECRET,
            { expiresIn: "24h" }
          );
          res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
          });
          return res.json({
            user: {
              id: 0,
              name: developmentAdminAccount.name,
              email: fallbackEmail,
              role: developmentAdminAccount.role,
            },
            token,
          });
        }
      }

      // Otherwise attempt to fetch the user from Supabase as normal.
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .ilike("email", email)
        .maybeSingle();

      if (error) throw error;

      if (!user || !(await verifyPassword(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Force admin role for the specific email
      const role =
        user.email.toLowerCase() === "24r01a66v9@cmrithyderabad.edu.in"
          ? "admin"
          : user.role;

      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: role },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.json({
        user: { id: user.id, name: user.name, email: user.email, role: role },
        token,
      });
    } catch (error) {
      console.error("Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      let userId: number | null = null;
      let targetEmail = email;

      const { data: user, error } = await supabase
        .from("users")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();
      if (error) throw error;

      if (user) {
        userId = user.id;
        targetEmail = user.email;
      } else if (developmentAdminAccount) {
        const normalizedFallback = developmentAdminAccount.emails.map((e) =>
          e.toLowerCase()
        );
        if (normalizedFallback.includes(email)) {
          userId = 0;
          targetEmail = email;
        }
      }

      if (userId === null) {
        return res.json({
          success: true,
          message:
            "If an account exists for that email, a reset link has been sent.",
        });
      }

      const resetToken = jwt.sign(
        { id: userId, email: targetEmail, purpose: "password-reset" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const reqOrigin =
        req.get("origin") ||
        (req.get("referer") ? new URL(req.get("referer")!).origin : null);
      const host = req.get("host") || "localhost:3000";
      const protocol = req.protocol || "http";
      const baseUrl =
        process.env.FRONTEND_URL ||
        process.env.APP_URL ||
        reqOrigin ||
        `${protocol}://${host}`;

      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(
        resetToken
      )}`;

      // Send email with timeout, but don't wait for it to complete
      const mailResult = await Promise.race([
        sendPasswordResetEmail(targetEmail, resetUrl),
        new Promise<{ sent: boolean; resetUrl: string }>((resolve) =>
          setTimeout(() => resolve({ sent: false, resetUrl }), 6000)
        ),
      ]).catch(() => ({ sent: false, resetUrl }));

      const message = mailResult.sent
        ? "A password reset link has been sent to your email address."
        : "SMTP email server is not configured in .env, so no email could be dispatched. Use the reset link below to proceed:";

      return res.json({
        success: true,
        message,
        resetUrl: mailResult.resetUrl,
      });
    } catch (error) {
      console.error("Forgot password failed:", error);
      return res
        .status(500)
        .json({ error: "Unable to process password reset" });
    }
  });

  app.post("/api/auth/check-reset-user", async (req, res) => {
    const { token } = req.body || {};

    if (!token) {
      return res.status(400).json({ error: "Reset token is required" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id?: number;
        email?: string;
        purpose?: string;
      };
      if (decoded?.purpose !== "password-reset" || !decoded?.email) {
        return res.status(400).json({ error: "Invalid reset token" });
      }

      // Check if user is admin
      const { data: user, error } = await supabase
        .from("users")
        .select("role")
        .ilike("email", decoded.email)
        .maybeSingle();
      if (error) throw error;

      if (user) {
        return res.json({ isAdmin: user.role === "admin" });
      } else if (
        developmentAdminAccount &&
        developmentAdminAccount.emails
          .map((e) => e.toLowerCase())
          .includes(decoded.email.toLowerCase())
      ) {
        return res.json({ isAdmin: true });
      } else {
        return res.json({ isAdmin: false });
      }
    } catch (error: any) {
      if (
        error?.name === "TokenExpiredError" ||
        error?.name === "JsonWebTokenError"
      ) {
        return res
          .status(400)
          .json({ error: "Invalid or expired reset token" });
      }

      console.error("Check reset user failed:", error);
      return res.status(500).json({ error: "Unable to verify user" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: "Reset token and new password are required" });
    }

    if (String(newPassword).length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters long" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id?: number;
        email?: string;
        purpose?: string;
      };
      if (decoded?.purpose !== "password-reset" || !decoded?.email) {
        return res.status(400).json({ error: "Invalid reset token" });
      }

      const hashedPassword = await hashPassword(String(newPassword));

      // Try finding user in Supabase
      const { data: user, error } = await supabase
        .from("users")
        .select("id, email")
        .ilike("email", decoded.email)
        .maybeSingle();
      if (error) throw error;

      if (user) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ password: hashedPassword })
          .eq("id", user.id);
        if (updateError) throw updateError;
      } else if (
        developmentAdminAccount &&
        developmentAdminAccount.emails
          .map((e) => e.toLowerCase())
          .includes(decoded.email.toLowerCase())
      ) {
        developmentAdminAccount.password = String(newPassword);
        developmentAdminAccount.passwordHash = hashedPassword;

        // Upsert into Supabase users table so future lookups work
        await supabase
          .from("users")
          .upsert(
            [
              {
                name: developmentAdminAccount.name,
                email: decoded.email.toLowerCase(),
                password: hashedPassword,
                role: developmentAdminAccount.role,
              },
            ],
            { onConflict: "email" }
          );
      } else {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({ success: true, message: "Password reset successful" });
    } catch (error: any) {
      if (
        error?.name === "TokenExpiredError" ||
        error?.name === "JsonWebTokenError"
      ) {
        return res
          .status(400)
          .json({ error: "Invalid or expired reset token" });
      }

      console.error("Reset password failed:", error);
      return res.status(500).json({ error: "Unable to reset password" });
    }
  });

  app.post(
    "/api/auth/change-password",
    authenticateToken,
    async (req: any, res) => {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: "Current and new password are required" });
      }

      if (String(newPassword).length < 6) {
        return res
          .status(400)
          .json({ error: "New password must be at least 6 characters long" });
      }

      try {
        const normalizedEmail = String(req.user?.email || "")
          .trim()
          .toLowerCase();
        const isDevelopmentAdmin =
          developmentAdminAccount &&
          normalizedEmail &&
          developmentAdminAccount.emails
            .map((candidate) => candidate.toLowerCase())
            .includes(normalizedEmail);

        if (isDevelopmentAdmin) {
          const current = String(currentPassword || "");
          const expected = String(developmentAdminAccount.password || "");
          if (current !== expected) {
            return res
              .status(401)
              .json({ error: "Current password is incorrect" });
          }
          return res.json({
            success: true,
            message: "Password updated for development admin account",
          });
        }

        const { data: user, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", req.user.email)
          .maybeSingle();
        if (error) throw error;

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        if (
          !user.password ||
          !(await verifyPassword(currentPassword, user.password))
        ) {
          return res
            .status(401)
            .json({ error: "Current password is incorrect" });
        }

        const hashedPassword = await hashPassword(newPassword);
        const { error: updateError } = await supabase
          .from("users")
          .update({ password: hashedPassword })
          .eq("id", user.id);
        if (updateError) throw updateError;

        return res.json({ success: true });
      } catch (error) {
        console.error("Change password failed:", error);
        return res.status(500).json({ error: "Unable to change password" });
      }
    }
  );

  app.get("/api/auth/me", authenticateOptionalToken, (req: any, res) => {
    if (!req.user) {
      return res.status(204).send();
    }
    res.json({ user: req.user });
  });

  // Events API
  app.get("/api/events", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.json((data || []).map(normalizeEventRecord));
    } catch (error: any) {
      console.error("Supabase fetch events error:", error);
      // If Supabase is unreachable or schema errors, fallback to empty list for local development
      const errText = JSON.stringify(error || {}) || String(error || "");
      if (
        error?.message?.includes("acknowledgments") ||
        error?.message?.includes("column") ||
        error?.message?.includes("schema cache") ||
        errText.toLowerCase().includes("getaddrinfo") ||
        errText.toLowerCase().includes("enotfound") ||
        errText.toLowerCase().includes("fetch failed")
      ) {
        return res.json([]);
      }
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/events", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const {
      title,
      date,
      occasion,
      description,
      acknowledgments,
      activities,
      originalTitle,
      originalDate,
    } = req.body;
    if (!title || !date || !description) {
      return res
        .status(400)
        .json({ error: "Title, date, and description are required" });
    }

    try {
      const insertPayload: Record<string, any> = {
        title,
        date,
        event_date: parseEventDate(date),
        occasion: occasion || "Additional Event",
        description,
      };

      if (acknowledgments !== undefined)
        insertPayload.acknowledgments = acknowledgments || null;
      if (activities !== undefined)
        insertPayload.activities = Array.isArray(activities) ? activities : [];

      const { data, error } = await supabase
        .from("events")
        .insert([insertPayload])
        .select();

      if (error) throw error;
      return res.json({
        success: true,
        event: normalizeEventRecord(data?.[0]),
      });
    } catch (error: any) {
      console.error("Supabase add event error:", error);
      if (
        error?.message?.includes("acknowledgments") ||
        error?.message?.includes("column") ||
        error?.message?.includes("schema cache")
      ) {
        return res
          .status(500)
          .json({
            error:
              "Your Supabase events table is missing one or more required columns. Please create the table first.",
          });
      }
      res.status(500).json({ error: error.message || "Failed to add event" });
    }
  });

  app.patch("/api/events/:id", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const {
      title,
      date,
      occasion,
      description,
      acknowledgments,
      activities,
    } = req.body;

    try {
      const updatePayload = {
        title,
        date,
        event_date: parseEventDate(date),
        occasion,
        description,
        acknowledgments,
        activities: Array.isArray(activities) ? activities : [],
      };

      let data: any[] | null = null;
      let error: any = null;

      if (/^\d+$/.test(String(id))) {
        const result = await supabase
          .from("events")
          .update(updatePayload)
          .eq("id", Number(id))
          .select();
        data = result.data;
        error = result.error;
      } else {
        // Legacy seed events use string ids in the frontend, while the
        // Supabase events table uses integer ids. Resolve a legacy request
        // using its title/date instead of ever comparing a string to id.
        const lookup = await supabase
          .from("events")
          .select("id")
          .eq("title", originalTitle || title)
          .eq("date", originalDate || date)
          .limit(1);

        if (lookup.error) throw lookup.error;
        const matchedId = lookup.data?.[0]?.id;

        if (matchedId === undefined || matchedId === null) {
          return res.status(404).json({ error: "Event not found in Supabase" });
        }

        const result = await supabase
          .from("events")
          .update(updatePayload)
          .eq("id", matchedId)
          .select();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      if (!data?.[0]) {
        return res.status(404).json({ error: "Event not found" });
      }

      return res.json({
        success: true,
        event: normalizeEventRecord(data[0]),
      });
    } catch (error: any) {
      console.error("Supabase update event error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    try {
      const { data, error } = await supabase
        .from("events")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw error;

      if (!data?.length) {
        return res.status(404).json({ error: "Event not found" });
      }

      return res.json({ success: true });
    } catch (error: any) {
      console.error("Supabase delete event error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to delete event" });
    }
  });

  // Photos API
  app.get("/api/photos", async (req, res) => {
    const { category, sub_category } = req.query;

    try {
      console.log("[DEBUG] GET /api/photos query:", { category, sub_category });

      let query = supabase.from("photos").select("*");

      if (category) query = query.eq("category", category);
      if (sub_category) query = query.eq("sub_category", sub_category);

      // Gallery order is persisted in display_order. group_id/photo_order are
      // secondary sorts so photos within the same memory stay adjacent and in
      // their saved order even before the frontend re-groups them.
      const { data, error } = await query
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("group_id", { ascending: true, nullsFirst: false })
        .order("photo_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      console.log(
        `[DEBUG] GET /api/photos returned ${data?.length || 0} record(s)`
      );
      return res.json(data || []);
    } catch (error: any) {
      console.error(
        "Supabase fetch photos error:",
        error?.stack || error?.message || error
      );

      // Keep the local manifest as a development fallback only. Do not use it
      // to report a successful database write.
      try {
        const uploadsDir = path.join(__dirname, "uploads");
        const manifestPath = path.join(uploadsDir, "manifest.json");
        let manifest: any[] = [];

        try {
          const raw = await fs.promises.readFile(manifestPath, "utf8");
          manifest = JSON.parse(raw || "[]");
        } catch {
          manifest = [];
        }

        let results = manifest;

        if (category) {
          results = results.filter(
            (record) => String(record.category) === String(category)
          );
        }

        if (sub_category) {
          results = results.filter(
            (record) => String(record.sub_category) === String(sub_category)
          );
        }

        return res.json(results);
      } catch (fallbackError) {
        return res.status(500).json({
          error: "Failed to fetch photos",
          detail: error?.message || String(error || fallbackError),
        });
      }
    }
  });

  // Debug endpoint: check photos table accessibility and surface Supabase errors
  app.get("/api/debug/photos-check", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("id,created_at,display_order,group_id,photo_order")
        .limit(1);

      if (error) {
        console.error("[DEBUG] photos-check error:", error);
        return res.status(500).json({
          ok: false,
          error: error.message || String(error),
          details: error,
        });
      }

      return res.json({ ok: true, sample: data });
    } catch (err: any) {
      console.error("[DEBUG] photos-check exception:", err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.post(
    "/api/photos",
    authenticateOptionalToken,
    upload.single("file"),
    async (req: any, res) => {
      try {
        console.log("[DEBUG] POST /api/photos headers:", {
          host: req.headers.host,
          contentType: req.headers["content-type"],
        });
        console.log(
          "[DEBUG] POST /api/photos body:",
          req.body
            ? {
                title: req.body.title,
                category: req.body.category,
                sub_category: req.body.sub_category,
                date: req.body.date,
                group_id: req.body.group_id,
                photo_order: req.body.photo_order,
                display_order: req.body.display_order,
              }
            : {}
        );
        console.log(
          "[DEBUG] POST /api/photos file present:",
          !!req.file,
          req.file
            ? {
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
              }
            : null
        );

        const isAuthorized = isAdminUser(req);

        if (!isAuthorized) {
          return res.status(403).json({ error: "Admin access required" });
        }

        const {
          title,
          category,
          sub_category,
          date,
          is_featured,
          display_order,
          group_id,
          photo_order,
        } = req.body || {};

        if (!req.file) {
          return res.status(400).json({ error: "File is required" });
        }

        if (!category) {
          return res.status(400).json({ error: "Category is required" });
        }

        // Upload the actual image first. If Supabase Storage is unavailable,
        // uploadToSupabaseStorage() may return a local fallback URL, but the
        // metadata must still be inserted into the database successfully.
        const fileUrl = await uploadToSupabaseStorage(req.file, "photos");

        const featuredFlag =
          is_featured === "true" ||
          is_featured === "1" ||
          is_featured === 1 ||
          is_featured === true
            ? 1
            : 0;

        // If the frontend did not provide an order, append the new memory to
        // the end of its category.
        let nextDisplayOrder = Number(display_order);

        if (!Number.isFinite(nextDisplayOrder)) {
          nextDisplayOrder = 1;

          const { data: lastPhoto, error: orderError } = await supabase
            .from("photos")
            .select("display_order")
            .eq("category", category)
            .order("display_order", { ascending: false, nullsFirst: false })
            .limit(1);

          if (!orderError && lastPhoto?.[0]?.display_order != null) {
            nextDisplayOrder = Number(lastPhoto[0].display_order) + 1;
          } else if (orderError) {
            // Keep the insert working if an older database does not have
            // display_order yet. The reorder endpoint will report the schema
            // problem explicitly instead of silently pretending it worked.
            console.warn(
              "[DEBUG] Could not determine next display_order:",
              orderError.message || orderError
            );
          }
        }

        const numericPhotoOrder = Number(photo_order);

        const insertPayload: Record<string, any> = {
          url: fileUrl,
          title: title?.trim() || "Untitled Moment",
          category,
          sub_category: sub_category || null,
          date: date || new Date().toISOString().slice(0, 10),
          is_featured: featuredFlag,
          display_order: nextDisplayOrder,
          // group_id ties every photo in a multi-photo memory together, and
          // photo_order keeps them in the order the admin arranged them in.
          // Without these two fields the frontend cannot tell a 5-photo
          // memory apart from 5 separate single-photo memories.
          group_id: group_id || null,
          photo_order: Number.isFinite(numericPhotoOrder)
            ? numericPhotoOrder
            : 0,
        };

        console.log("[DEBUG] Inserting photo metadata:", insertPayload);

        const { data, error } = await supabase
          .from("photos")
          .insert([insertPayload])
          .select("*")
          .single();

        if (error) {
          console.error("[DEBUG] Photo database insert failed:", error);

          // group_id/photo_order columns may not exist yet on an older
          // database. Surface that clearly instead of a generic 500 so it's
          // obvious a migration is needed, rather than looking like a
          // one-off upload failure.
          const missingColumn =
            error?.message?.includes("group_id") ||
            error?.message?.includes("photo_order");
          if (missingColumn) {
            return res.status(500).json({
              error:
                "The photos table is missing the group_id/photo_order columns. Add them (text/uuid and integer) before multi-photo memories will work.",
            });
          }

          throw error;
        }

        console.log("[DEBUG] Photo inserted successfully:", data);

        return res.status(201).json({
          success: true,
          photo: data,
          id: data.id,
          url: data.url,
        });
      } catch (error: any) {
        console.error(
          "Supabase add photo error:",
          error?.stack || error?.message || error
        );

        // IMPORTANT: Do not return success when the database insert fails.
        // The frontend must know that the memory was not persisted.
        return res.status(500).json({
          error: error?.message || "Failed to add photo",
        });
      }
    }
  );

  app.delete("/api/photos/:id", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;

    try {
      const { data: photoData, error: fetchError } = await supabase
        .from("photos")
        .select("url")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (photoData?.url) {
        await deleteFromSupabaseStorage(photoData.url, "photos");
      }

      const { error } = await supabase.from("photos").delete().eq("id", id);

      if (error) throw error;

      console.log(`[DEBUG] Photo ${id} deleted successfully`);
      return res.json({ success: true });
    } catch (error: any) {
      console.error(
        "Supabase delete photo error:",
        error?.stack || error?.message || error
      );
      return res.status(500).json({
        error:
          error?.message || "Failed to delete photo from storage or database",
      });
    }
  });

  // PATCH accepts multipart/form-data because the gallery edit form can send
  // both text fields and an optional replacement image.
  app.patch(
    "/api/photos/:id",
    authenticateOptionalToken,
    upload.single("file"),
    async (req: any, res) => {
      const isAuthorized = isAdminUser(req);

      if (!isAuthorized) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { id } = req.params;

      try {
        console.log("[DEBUG] PATCH /api/photos/:id", {
          id,
          body: req.body,
          file: req.file
            ? {
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
              }
            : null,
        });

        const {
          title,
          category,
          sub_category,
          date,
          display_order,
          group_id,
          photo_order,
        } = req.body || {};

        // Read the current record so we can preserve fields that were not
        // changed and remove the previous image when it is replaced.
        const { data: existingPhoto, error: existingError } = await supabase
          .from("photos")
          .select("*")
          .eq("id", id)
          .single();

        if (existingError) throw existingError;

        const updatePayload: Record<string, any> = {};

        if (title !== undefined) updatePayload.title = title.trim();
        if (category !== undefined) updatePayload.category = category;
        if (sub_category !== undefined) {
          updatePayload.sub_category = sub_category || null;
        }
        if (date !== undefined) updatePayload.date = date;
        if (group_id !== undefined) updatePayload.group_id = group_id || null;
        if (photo_order !== undefined) {
          const numericPhotoOrder = Number(photo_order);
          if (Number.isFinite(numericPhotoOrder)) {
            updatePayload.photo_order = numericPhotoOrder;
          }
        }
        if (display_order !== undefined && display_order !== "") {
          const numericOrder = Number(display_order);

          if (!Number.isFinite(numericOrder)) {
            return res.status(400).json({
              error: "display_order must be a valid number",
            });
          }

          updatePayload.display_order = numericOrder;
        }

        // A new image is optional during edit. If supplied, upload it and
        // replace the existing URL.
        if (req.file) {
          const newFileUrl = await uploadToSupabaseStorage(req.file, "photos");
          updatePayload.url = newFileUrl;

          if (
            existingPhoto?.url &&
            existingPhoto.url !== newFileUrl &&
            String(existingPhoto.url).includes("/storage/v1/object/public/")
          ) {
            await deleteFromSupabaseStorage(existingPhoto.url, "photos");
          }
        }

        if (Object.keys(updatePayload).length === 0) {
          return res.status(400).json({
            error: "No fields were provided to update",
          });
        }

        console.log("[DEBUG] Updating photo:", {
          id,
          updatePayload,
        });

        const { data, error } = await supabase
          .from("photos")
          .update(updatePayload)
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          const missingColumn =
            error?.message?.includes("group_id") ||
            error?.message?.includes("photo_order");
          if (missingColumn) {
            return res.status(500).json({
              error:
                "The photos table is missing the group_id/photo_order columns. Add them (text/uuid and integer) before multi-photo memories will work.",
            });
          }
          throw error;
        }

        console.log("[DEBUG] Photo updated successfully:", data);

        return res.json({
          success: true,
          photo: data,
        });
      } catch (error: any) {
        console.error(
          "Supabase update photo error:",
          error?.stack || error?.message || error
        );

        return res.status(500).json({
          error: error?.message || "Failed to update photo",
        });
      }
    }
  );

  app.patch(
    "/api/photos/:id/feature",
    authenticateToken,
    async (req: any, res) => {
      if (!isAdminUser(req)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { id } = req.params;
      const { category } = req.body;

      try {
        const { error: resetError } = await supabase
          .from("photos")
          .update({ is_featured: 0 })
          .eq("category", category);

        if (resetError) throw resetError;

        const { data, error } = await supabase
          .from("photos")
          .update({ is_featured: 1 })
          .eq("id", id)
          .select();

        if (error) throw error;

        return res.json({ success: true, photo: data?.[0] });
      } catch (error: any) {
        console.error("Supabase feature photo error:", error);
        return res.status(500).json({
          error: error?.message || "Failed to feature photo",
        });
      }
    }
  );

  // Reorder photos in gallery
  app.post("/api/photos/reorder", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { order } = req.body || {};

    if (!order || typeof order !== "object" || Array.isArray(order)) {
      return res.status(400).json({ error: "Order mapping is required" });
    }

    try {
      const entries = Object.entries(order);

      if (entries.length === 0) {
        return res.json({ success: true });
      }

      // Every Supabase update must be checked. Promise.all() by itself does
      // not throw for Supabase's { data, error } responses, which previously
      // allowed this endpoint to return 200 even when nothing was saved.
      const results = await Promise.all(
        entries.map(async ([photoId, position]) => {
          const numericPosition = Number(position);

          if (!Number.isFinite(numericPosition)) {
            throw new Error(
              `Invalid display_order for photo ${photoId}: ${position}`
            );
          }

          const { data, error } = await supabase
            .from("photos")
            .update({ display_order: numericPosition })
            .eq("id", photoId)
            .select("id,display_order")
            .maybeSingle();

          if (error) throw error;

          if (!data) {
            throw new Error(`Photo ${photoId} was not found`);
          }

          return data;
        })
      );

      console.log("[DEBUG] Gallery order persisted:", results);

      return res.json({
        success: true,
        updated: results,
      });
    } catch (error: any) {
      console.error(
        "Supabase reorder photos error:",
        error?.stack || error?.message || error
      );

      return res.status(500).json({
        error: error?.message || "Failed to reorder photos",
      });
    }
  });

  /* ------------------------------------------------------------------ */
  /*  MILESTONES API                                                     */
  /*  Insert this block into server.ts, right after the "// Photos API"  */
  /*  block ends (i.e. right before "// Leadership Members API").        */
  /*                                                                     */
  /*  It expects a Supabase table called `milestones` — see              */
  /*  milestones-table.sql for the exact schema to run in Supabase.      */
  /*                                                                     */
  /*  DB column names are snake_case (icon_key), the frontend uses       */
  /*  camelCase (iconKey) — the two small helpers below convert between  */
  /*  them so About.tsx doesn't need to change its payload shape.        */
  /* ------------------------------------------------------------------ */

  function toMilestoneRow(payload: any) {
    return {
      year: payload.year,
      title: payload.title,
      description: payload.description ?? "",
      icon_key: payload.iconKey || "sprout",
    };
  }

  function fromMilestoneRow(row: any) {
    if (!row) return row;
    return {
      id: row.id,
      year: row.year,
      title: row.title,
      description: row.description,
      iconKey: row.icon_key,
    };
  }

  app.get("/api/milestones", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .order("year", { ascending: true });

      if (error) throw error;
      return res.json((data || []).map(fromMilestoneRow));
    } catch (error: any) {
      console.error("Supabase fetch milestones error:", error);
      // Table not created yet, or DB unreachable in local dev — return an
      // empty list so the frontend quietly falls back to its local/default
      // milestones instead of surfacing a 500.
      const errText = JSON.stringify(error || {}) || String(error || "");
      if (
        error?.message?.includes("relation") ||
        error?.message?.includes("does not exist") ||
        error?.message?.includes("schema cache") ||
        errText.toLowerCase().includes("getaddrinfo") ||
        errText.toLowerCase().includes("enotfound") ||
        errText.toLowerCase().includes("fetch failed")
      ) {
        return res.json([]);
      }
      res.status(500).json({ error: "Failed to fetch milestones" });
    }
  });

  app.post("/api/milestones", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { year, title, description, iconKey } = req.body || {};
    if (!year || !title) {
      return res.status(400).json({ error: "Year and title are required" });
    }

    try {
      const id = `m-${Date.now()}`;
      const insertPayload = {
        id,
        ...toMilestoneRow({ year, title, description, iconKey }),
      };

      const { data, error } = await supabase
        .from("milestones")
        .insert([insertPayload])
        .select()
        .single();

      if (error) throw error;
      return res
        .status(201)
        .json({ success: true, milestone: fromMilestoneRow(data) });
    } catch (error: any) {
      console.error("Supabase add milestone error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to add milestone" });
    }
  });

  app.patch("/api/milestones/:id", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const { year, title, description, iconKey } = req.body || {};

    try {
      const updatePayload: Record<string, any> = {};
      if (year !== undefined) updatePayload.year = year;
      if (title !== undefined) updatePayload.title = title;
      if (description !== undefined) updatePayload.description = description;
      if (iconKey !== undefined) updatePayload.icon_key = iconKey;
      updatePayload.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("milestones")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ success: true, milestone: fromMilestoneRow(data) });
    } catch (error: any) {
      console.error("Supabase update milestone error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to update milestone" });
    }
  });

  app.delete(
    "/api/milestones/:id",
    authenticateToken,
    async (req: any, res) => {
      if (!isAdminUser(req)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { id } = req.params;
      try {
        const { error } = await supabase
          .from("milestones")
          .delete()
          .eq("id", id);
        if (error) throw error;
        return res.json({ success: true });
      } catch (error: any) {
        console.error("Supabase delete milestone error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to delete milestone" });
      }
    }
  );

  // Leadership Members API
  app.get("/api/leadership-members", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("leadership_members")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return res.json(data || []);
    } catch (error: any) {
      console.error("Supabase fetch leadership members error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch leadership members" });
    }
  });

  app.post(
    "/api/leadership-members",
    authenticateOptionalToken,
    upload.single("file"),
    async (req: any, res) => {
      const isAuthorized = isAdminUser(req);

      if (!isAuthorized) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const {
        name,
        role,
        tenure,
        bio,
        category,
        display_order,
        linkedin_url,
        instagram_url,
        image,
      } = req.body;

      if (!name || !role) {
        return res.status(400).json({ error: "Name and role are required" });
      }

      try {
        let imageUrl = image || "";
        if (req.file) {
          imageUrl = await uploadToSupabaseStorage(req.file, "photos");
        }

        const payload = {
          name: name.trim(),
          role: role.trim(),
          tenure: tenure ? tenure.trim() : "2026",
          bio: typeof bio === "string" ? bio.trim() : "",
          image: imageUrl,
          category: category || "founders",
          display_order: display_order ? Number(display_order) : 0,
          linkedin_url: linkedin_url ? linkedin_url.trim() : null,
          instagram_url: instagram_url ? instagram_url.trim() : null,
        };

        const { data, error } = await supabase
          .from("leadership_members")
          .insert([payload])
          .select();

        if (error) throw error;
        res.json({ success: true, member: data[0] });
      } catch (error: any) {
        console.error("Supabase add leadership member error:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to add leadership member" });
      }
    }
  );

  app.patch(
    "/api/leadership-members/:id",
    authenticateOptionalToken,
    upload.single("file"),
    async (req: any, res) => {
      const isAuthorized = isAdminUser(req);

      if (!isAuthorized) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { id } = req.params;
      if (!/^\d+$/.test(id)) {
        return res
          .status(400)
          .json({ error: "Invalid member ID. ID must be numeric." });
      }
      const {
        name,
        role,
        tenure,
        bio,
        category,
        display_order,
        linkedin_url,
        instagram_url,
        image,
      } = req.body || {};

      try {
        const updatePayload: Record<string, any> = {};

        if (req.file) {
          updatePayload.image = await uploadToSupabaseStorage(
            req.file,
            "photos"
          );
        } else if (image !== undefined) {
          updatePayload.image = image;
        }

        if (name !== undefined) updatePayload.name = name.trim();
        if (role !== undefined) updatePayload.role = role.trim();
        if (tenure !== undefined) updatePayload.tenure = tenure.trim();
        if (bio !== undefined)
          updatePayload.bio = typeof bio === "string" ? bio.trim() : "";
        if (category !== undefined) updatePayload.category = category;
        if (display_order !== undefined)
          updatePayload.display_order = Number(display_order);
        if (linkedin_url !== undefined)
          updatePayload.linkedin_url = linkedin_url
            ? linkedin_url.trim()
            : null;
        if (instagram_url !== undefined)
          updatePayload.instagram_url = instagram_url
            ? instagram_url.trim()
            : null;

        const { data, error } = await supabase
          .from("leadership_members")
          .update(updatePayload)
          .eq("id", id)
          .select();

        if (error) throw error;
        return res.json({ success: true, member: data?.[0] });
      } catch (error: any) {
        console.error("Supabase update leadership member error:", error);
        return res
          .status(500)
          .json({
            error: error.message || "Failed to update leadership member",
          });
      }
    }
  );

  app.delete(
    "/api/leadership-members/:id",
    authenticateOptionalToken,
    async (req: any, res) => {
      const isAuthorized = isAdminUser(req);

      if (!isAuthorized) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { id } = req.params;
      if (!/^\d+$/.test(id)) {
        return res.json({ success: true, message: "Non-numeric ID ignored." });
      }

      try {
        const { data: memberData } = await supabase
          .from("leadership_members")
          .select("image")
          .eq("id", id)
          .single();

        if (
          memberData &&
          memberData.image &&
          memberData.image.includes("supabase.co/storage/v1/object/public/")
        ) {
          await deleteFromSupabaseStorage(memberData.image, "photos");
        }

        const { error } = await supabase
          .from("leadership_members")
          .delete()
          .eq("id", id);
        if (error) throw error;

        return res.json({ success: true });
      } catch (error: any) {
        console.error("Supabase delete leadership member error:", error);
        res
          .status(500)
          .json({
            error: error.message || "Failed to delete leadership member",
          });
      }
    }
  );

  // Videos API
  // Returns an empty list rather than 500 when the `videos` table hasn't
  // been created yet — see db/pending/2026-09-06_site_features.sql.
  app.get("/api/videos", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.json(data);
    } catch (error: any) {
      if (isMissingTableError(error)) return res.json([]);
      console.error("Supabase fetch videos error:", error);
      res.status(500).json({ error: "Failed to fetch videos" });
    }
  });

  app.post("/api/videos", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const { title, description, url, thumbnail, category, date } = req.body;
    if (!title || !url)
      return res.status(400).json({ error: "Title and URL are required" });

    try {
      const { data, error } = await supabase
        .from("videos")
        .insert([
          {
            title,
            description: description || null,
            url,
            thumbnail: thumbnail || null,
            category: category || "General",
            date: date || new Date().toLocaleDateString(),
          },
        ])
        .select();

      if (error) throw error;
      return res.json({ success: true, id: data[0].id });
    } catch (error) {
      console.error("Supabase add video error:", error);
      res.status(500).json({ error: "Failed to add video" });
    }
  });

  app.delete("/api/videos/:id", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const { id } = req.params;
    try {
      const { error } = await supabase.from("videos").delete().eq("id", id);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error) {
      console.error("Supabase delete video error:", error);
      res.status(500).json({ error: "Failed to delete video" });
    }
  });

  // Sponsors API
  app.get("/api/sponsors", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("sponsors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.json(data || []);
    } catch (error) {
      console.error("Supabase fetch sponsors error:", error);
      res.status(500).json({ error: "Failed to fetch sponsors" });
    }
  });

  app.post("/api/sponsors", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const {
      name,
      description,
      logo_url,
      website_url,
      type,
      contact_email,
      contact_phone,
    } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    try {
      const { data, error } = await supabase
        .from("sponsors")
        .insert([
          {
            name,
            description: description || null,
            logo_url: logo_url || null,
            website_url: website_url || null,
            type: type || "sponsor",
            contact_email: contact_email || null,
            contact_phone: contact_phone || null,
          },
        ])
        .select();

      if (error) throw error;
      return res.json({ success: true, id: data[0].id });
    } catch (error) {
      console.error("Supabase add sponsor error:", error);
      res.status(500).json({ error: "Failed to add sponsor" });
    }
  });

  app.delete("/api/sponsors/:id", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const { id } = req.params;
    try {
      const { error } = await supabase.from("sponsors").delete().eq("id", id);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error) {
      console.error("Supabase delete sponsor error:", error);
      res.status(500).json({ error: "Failed to delete sponsor" });
    }
  });

  // Job Openings API
  app.get("/api/jobs", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("job_openings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.json(data || []);
    } catch (error) {
      console.error("Supabase fetch jobs error:", error);
      res.status(500).json({ error: "Failed to fetch job openings" });
    }
  });

  app.post("/api/jobs", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const {
      title,
      department,
      description,
      requirements,
      location,
      job_type,
      contact_email,
    } = req.body;
    if (!title || !description)
      return res
        .status(400)
        .json({ error: "Title and description are required" });

    try {
      const { data, error } = await supabase
        .from("job_openings")
        .insert([
          {
            title,
            department: department || null,
            description,
            requirements: requirements || null,
            location: location || null,
            job_type: job_type || "volunteer",
            contact_email: contact_email || null,
            is_active: true,
          },
        ])
        .select();

      if (error) throw error;
      return res.json({ success: true, id: data[0].id });
    } catch (error) {
      console.error("Supabase add job error:", error);
      res.status(500).json({ error: "Failed to add job opening" });
    }
  });

  app.delete("/api/jobs/:id", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const { id } = req.params;
    try {
      const { error } = await supabase
        .from("job_openings")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error) {
      console.error("Supabase delete job error:", error);
      res.status(500).json({ error: "Failed to delete job opening" });
    }
  });

  // Reviews API
  app.get("/api/reviews", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.json(data);
    } catch (error) {
      console.error("Supabase fetch reviews error:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // Public by design — visitors leave reviews without an account. That makes
  // it the one endpoint anyone on the internet can write rows through, so it
  // needs a rate limit and hard length caps. Previously it had neither, and
  // would accept unlimited reviews under any name, including a founder's.
  app.post(
    "/api/reviews",
    rateLimit({ windowMs: 60 * 60 * 1000, max: 3, key: "review" }),
    async (req, res) => {
    const user_name = String(req.body?.user_name || "").trim();
    const comment = String(req.body?.comment || "").trim();
    const rating = Number(req.body?.rating);

    if (!user_name || !comment) {
      return res.status(400).json({ error: "Please add your name and a comment." });
    }
    if (user_name.length > 60) {
      return res.status(400).json({ error: "Please keep your name under 60 characters." });
    }
    if (comment.length > 1200) {
      return res.status(400).json({ error: "Please keep your review under 1200 characters." });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Choose a rating from 1 to 5." });
    }

    try {
      const { data, error } = await supabase
        .from("reviews")
        .insert([
          {
            user_name,
            rating,
            comment,
          },
        ])
        .select();

      if (error) throw error;
      return res.json({ success: true, id: data[0].id });
    } catch (error) {
      console.error("Supabase add review error:", error);
      res.status(500).json({ error: "Failed to submit review" });
    }
    }
  );

  app.delete("/api/reviews/:id", authenticateToken, async (req: any, res) => {
    const isAuthorized = isAdminUser(req);

    if (!isAuthorized) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;

    try {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error) {
      console.error("Supabase delete review error:", error);
      return res.status(500).json({ error: "Failed to delete review" });
    }
  });

  /* ---------------------------------------------------------------------
   * Highlights scroller (home page)
   *
   * The feed itself is derived on the client from photos + events, so this
   * endpoint only carries the ADMIN EXCEPTIONS: what's pinned to the front and
   * what's hidden. That keeps the scroller working with zero curation.
   *
   * If sql/003_highlight_prefs.sql hasn't been run yet the table won't exist.
   * Rather than 500, we return an empty set so the scroller degrades to a pure
   * auto feed and the site keeps working.
   * ------------------------------------------------------------------- */
  app.get("/api/highlights/prefs", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("highlight_prefs")
        .select("item_key, pinned, hidden, sort_order");
      if (error) throw error;
      return res.json({ available: true, prefs: data || [] });
    } catch (error: any) {
      if (isMissingTableError(error)) {
        return res.json({ available: false, prefs: [], hint: MISSING_TABLE_HINT });
      }
      console.error("Supabase fetch highlight prefs error:", error);
      return res.status(500).json({ error: "Failed to load highlight settings" });
    }
  });

  app.put("/api/highlights/prefs", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const itemKey = String(req.body?.item_key || "").trim();
    if (!/^(photo|event):[A-Za-z0-9_-]{1,120}$/.test(itemKey)) {
      return res.status(400).json({ error: "Invalid item reference." });
    }

    const pinned = Boolean(req.body?.pinned);
    const hidden = Boolean(req.body?.hidden);
    const sortOrder = Number.isFinite(Number(req.body?.sort_order))
      ? Number(req.body.sort_order)
      : 0;

    try {
      // Nothing to remember once an item is neither pinned nor hidden — drop
      // the row rather than accumulating no-op records forever.
      if (!pinned && !hidden) {
        const { error } = await supabase
          .from("highlight_prefs")
          .delete()
          .eq("item_key", itemKey);
        if (error) throw error;
        return res.json({ success: true, cleared: true });
      }

      const { data, error } = await supabase
        .from("highlight_prefs")
        .upsert(
          { item_key: itemKey, pinned, hidden, sort_order: sortOrder, updated_at: new Date().toISOString() },
          { onConflict: "item_key" },
        )
        .select();
      if (error) throw error;
      return res.json({ success: true, pref: data?.[0] ?? null });
    } catch (error: any) {
      if (isMissingTableError(error)) {
        return res.status(503).json({ error: MISSING_TABLE_HINT });
      }
      console.error("Supabase save highlight pref error:", error);
      return res.status(500).json({ error: "Failed to save highlight setting" });
    }
  });

  /* ---------------------------------------------------------------------
   * Site settings — the small key/value store behind the Donate panel, the
   * journey video, and the contact details.
   *
   * None of this existed anywhere before: there was no field for a UPI ID, a
   * QR image, or bank details, which is why the Donate button had nowhere to
   * point. See db/pending/2026-09-06_site_features.sql.
   *
   * If that migration hasn't been run the table is absent, and every route
   * here reports `available: false` rather than 500ing, so the Donate panel
   * simply stays hidden and the rest of the site is unaffected.
   * ------------------------------------------------------------------- */

  // Whitelisted so a compromised admin session can't write arbitrary keys, and
  // so a typo in the client can't silently create a setting nothing reads.
  const SETTING_KEYS = new Set([
    "donate_upi_id",
    "donate_upi_payee_name",
    "donate_qr_url",
    "donate_bank_name",
    "donate_bank_account_name",
    "donate_bank_account_no",
    "donate_bank_ifsc",
    "donate_bank_branch",
    "donate_note",
    "journey_video_url",
    "journey_video_title",
    "contact_email",
    "contact_location",
  ]);

  const SETTINGS_HINT =
    "site_settings table not found — run db/pending/2026-09-06_site_features.sql in Supabase.";

  app.get("/api/settings", async (req, res) => {
    try {
      const { data, error } = await supabase.from("site_settings").select("key, value");
      if (error) throw error;
      const settings: Record<string, string> = {};
      (data || []).forEach((row: any) => {
        if (SETTING_KEYS.has(row.key)) settings[row.key] = row.value ?? "";
      });
      return res.json({ available: true, settings });
    } catch (error: any) {
      if (isMissingTableError(error)) {
        return res.json({ available: false, settings: {}, hint: SETTINGS_HINT });
      }
      console.error("Supabase fetch settings error:", error);
      return res.status(500).json({ error: "Failed to load site settings" });
    }
  });

  app.put("/api/settings", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const incoming = req.body?.settings;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      return res.status(400).json({ error: "Expected a { settings: { key: value } } object." });
    }

    const rows: { key: string; value: string; updated_at: string; updated_by: string }[] = [];
    const rejected: string[] = [];
    for (const [key, raw] of Object.entries(incoming)) {
      if (!SETTING_KEYS.has(key)) { rejected.push(key); continue; }
      const value = raw === null || raw === undefined ? "" : String(raw).trim();
      if (value.length > 2000) {
        return res.status(400).json({ error: `"${key}" is too long.` });
      }
      rows.push({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: String(req.user?.email || "admin"),
      });
    }

    if (rejected.length) {
      return res.status(400).json({ error: `Unknown setting(s): ${rejected.join(", ")}` });
    }
    if (!rows.length) {
      return res.status(400).json({ error: "Nothing to save." });
    }

    try {
      const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      return res.json({ success: true, saved: rows.length });
    } catch (error: any) {
      if (isMissingTableError(error)) {
        return res.status(503).json({ error: SETTINGS_HINT });
      }
      console.error("Supabase save settings error:", error);
      return res.status(500).json({ error: "Failed to save site settings" });
    }
  });

  // Medical Requests API
  const MAX_HELP_DOCUMENTS = 5;
  const MAX_HELP_DOCUMENT_CHARS = 4 * 1024 * 1024; // ~3 MB of file, base64 encoded

  app.post(
    "/api/medical-request",
    rateLimit({ windowMs: 60 * 60 * 1000, max: 5, key: "help-submit" }),
    async (req, res) => {
      const patient_name = String(req.body?.patient_name || "").trim();
      const contact_number = String(req.body?.contact_number || "").trim();
      const emergency_details = String(req.body?.emergency_details || "").trim();
      const hospital_name = String(req.body?.hospital_name || "").trim();
      const required_amount = req.body?.required_amount ?? null;

      if (!patient_name || !contact_number || !emergency_details) {
        return res.status(400).json({
          error: "Patient name, contact number and details of the emergency are all required.",
        });
      }
      if (patient_name.length > 120) {
        return res.status(400).json({ error: "Please keep the patient name under 120 characters." });
      }
      if (hospital_name.length > 160) {
        return res.status(400).json({ error: "Please keep the hospital name under 160 characters." });
      }
      if (emergency_details.length > 4000) {
        return res.status(400).json({ error: "Please keep the details under 4000 characters." });
      }
      if (!/^[0-9+\-()\s]{6,20}$/.test(contact_number)) {
        return res.status(400).json({ error: "Enter a valid contact number." });
      }

      // Files arrive as base64 data URLs in the JSON body. Cap both the count
      // and the size — the body parser allows 50mb, which is enough for a
      // single request to stall the process and bloat the database row.
      let documents: string | null = null;
      try {
        const raw = req.body?.documents;
        const list = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(list) && list.length > 0) {
          if (list.length > MAX_HELP_DOCUMENTS) {
            return res
              .status(400)
              .json({ error: `Please attach at most ${MAX_HELP_DOCUMENTS} files.` });
          }
          const oversized = list.some(
            (entry: unknown) =>
              typeof entry === "string" && entry.length > MAX_HELP_DOCUMENT_CHARS
          );
          if (oversized) {
            return res
              .status(413)
              .json({ error: "One of those files is too large. Please keep each under 3 MB." });
          }
          documents = JSON.stringify(list);
        }
      } catch {
        return res
          .status(400)
          .json({ error: "Those attachments could not be read. Please try adding them again." });
      }

      try {
        const { data, error } = await supabase
          .from("medical_requests")
          .insert([
            {
              patient_name,
              contact_number,
              emergency_details,
              hospital_name: hospital_name || null,
              required_amount,
              documents,
              status: "pending",
            },
          ])
          .select();

        if (error) throw error;
        return res.json({ success: true, id: data[0].id });
      } catch (error) {
        console.error("Supabase add medical request error:", error);
        res.status(500).json({ error: "Failed to submit request" });
      }
    }
  );

  // Public, so a family can check on their own request — which is why it must
  // hand back as little as possible. A phone number is guessable, so this
  // deliberately does NOT select("*"): no patient name, no emergency details,
  // no hospital, no documents. Just enough to answer "where is my request?".
  app.get(
    "/api/medical-request/:contact",
    rateLimit({ windowMs: 10 * 60 * 1000, max: 12, key: "help-status" }),
    async (req, res) => {
      const contact = String(req.params.contact || "").trim();
      if (contact.length < 6) {
        return res
          .status(400)
          .json({ error: "Enter the full contact number used on the request." });
      }

      try {
        const { data, error } = await supabase
          .from("medical_requests")
          .select("id, status, created_at, expiry_date")
          .eq("contact_number", contact)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
          return res.json(data[0]);
        }
        return res
          .status(404)
          .json({ error: "No request found for this number" });
      } catch (error) {
        console.error("Supabase fetch medical request error:", error);
        res.status(500).json({ error: "Failed to fetch request status" });
      }
    }
  );

  // Admin only. This returns patient names, contact numbers, the emergency
  // description and the uploaded documents for every request ever submitted;
  // it previously had no authentication at all, so anyone who knew the URL
  // could download the lot.
  app.get("/api/medical-requests", authenticateToken, async (req: any, res) => {
    if (!isAdminUser(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const { data, error } = await supabase
        .from("medical_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return res.json(data);
    } catch (error) {
      console.error("Supabase fetch all medical requests error:", error);
      res.status(500).json({ error: "Failed to fetch medical requests" });
    }
  });

  app.delete(
    "/api/medical-request/:id",
    authenticateToken,
    async (req: any, res) => {
      if (!isAdminUser(req)) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { id } = req.params;

      try {
        const { error } = await supabase
          .from("medical_requests")
          .delete()
          .eq("id", id);
        if (error) throw error;
        return res.json({ success: true });
      } catch (error) {
        console.error("Supabase delete medical request error:", error);
        res.status(500).json({ error: "Failed to delete request" });
      }
    }
  );

  app.patch(
    "/api/medical-request/:id",
    authenticateToken,
    async (req: any, res) => {
      if (!isAdminUser(req)) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { id } = req.params;
      const { status, expiry_date } = req.body;

      try {
        const updateFields: any = {};
        if (status !== undefined) updateFields.status = status;
        if (expiry_date !== undefined) updateFields.expiry_date = expiry_date;

        const { data, error } = await supabase
          .from("medical_requests")
          .update(updateFields)
          .eq("id", id)
          .select();

        if (error) throw error;
        return res.json({ success: true, data: data[0] });
      } catch (error) {
        console.error("Supabase update medical request error:", error);
        res.status(500).json({ error: "Failed to update request" });
      }
    }
  );

  // RSVP API
  app.post("/api/rsvp", async (req, res) => {
    const { event_id, name, email } = req.body;
    if (!event_id || !name || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const { data, error } = await supabase
        .from("rsvps")
        .insert([
          {
            event_id,
            name,
            email,
          },
        ])
        .select();

      if (error) throw error;
      return res.json({ success: true, id: data[0].id });
    } catch (error) {
      console.error("Supabase add RSVP error:", error);
      res.status(500).json({ error: "Failed to submit RSVP" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  // Error handler for uploads and other middleware errors
  // This ensures multer errors are logged and returned as JSON for easier debugging
  // NOTE: keep this after all routes/middleware so it catches upstream errors
  app.use((err: any, req: any, res: any, next: any) => {
    try {
      console.error("[ERROR HANDLER]", err && err.stack ? err.stack : err);
      if (err && err.name === "MulterError") {
        return res
          .status(400)
          .json({ error: err.message || "File upload error" });
      }
      return res
        .status(err?.status || 500)
        .json({ error: err?.message || "Internal server error" });
    } catch (e) {
      console.error("[ERROR HANDLER] Failed to handle error:", e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  const actualPort = await listenWithFallback(PORT);
  console.log(`Server running on http://localhost:${actualPort}`);
}

startServer();
