// Local persistence layer.
//
// We originally planned to run this on Supabase (Postgres) locally via the
// Supabase CLI, and to use Prisma as the ORM. Neither works inside this
// build sandbox: the Supabase CLI pulls its Postgres/Auth/Studio images from
// ghcr.io, and Prisma downloads its query-engine binary from
// binaries.prisma.sh — both hosts are blocked by the sandbox's network
// policy. Node 22 ships a built-in `node:sqlite` module that needs nothing
// downloaded at all, so that's what real local dev runs on for now.
//
// The schema below is a deliberate mirror of supabase/migrations/0001_init.sql
// (same tables, same columns, same constraints, minus Postgres-only syntax
// like RLS policies and uuid/timestamptz types). When this app is later
// pointed at a real Supabase project, that migration is what creates the
// production schema — this file just needs to be swapped for a Postgres
// client. Ownership checks that Postgres RLS would enforce at the database
// layer are enforced here in the application code instead (see lib/auth.ts
// and the API routes).

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { seedSampleData } from "./seed";

// Set LEASEMATCH_DB_PATH in production to a file on a persistent disk (e.g.
// a Render disk mounted at /var/data). Defaults to ./data for local dev.
const DB_PATH = process.env.LEASEMATCH_DB_PATH || path.join(process.cwd(), "data", "leasematch.db");

declare global {
  var __leasematchDb: DatabaseSync | undefined;
  var __leasematchSchemaVersion: number | undefined;
}

// Bump when the schema below changes. In dev the connection survives
// hot-reloads (see bottom of this block), so this is what makes a running
// `next dev` pick up new tables/columns and the sample seed without a restart.
const SCHEMA_VERSION = 5;

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  // timeout: wait for a concurrent writer instead of failing with SQLITE_BUSY.
  const db = new DatabaseSync(DB_PATH, { timeout: 5000 });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function ensureSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('tenant','owner','broker','pm')),
      full_name TEXT NOT NULL,
      company_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      property_type TEXT NOT NULL,
      location TEXT NOT NULL,
      price REAL NOT NULL,
      beds INTEGER NOT NULL DEFAULT 0,
      baths INTEGER NOT NULL DEFAULT 1,
      sqft INTEGER,
      furnished TEXT NOT NULL DEFAULT 'unfurnished' CHECK (furnished IN ('furnished','unfurnished')),
      description TEXT,
      amenities TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending_verification'
        CHECK (status IN ('pending_verification','live','vacant','under_offer','leased')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS properties_provider_id_idx ON properties(provider_id);
    CREATE INDEX IF NOT EXISTS properties_status_idx ON properties(status);

    CREATE TABLE IF NOT EXISTS tenant_preferences (
      profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      property_types TEXT NOT NULL DEFAULT '[]',
      locations TEXT NOT NULL DEFAULT '[]',
      budget REAL,
      furnished TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','withdrawn')),
      occupation TEXT NOT NULL,
      monthly_income REAL,
      move_in TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (property_id, tenant_id)
    );

    CREATE INDEX IF NOT EXISTS applications_property_id_idx ON applications(property_id);
    CREATE INDEX IF NOT EXISTS applications_tenant_id_idx ON applications(tenant_id);

    CREATE TABLE IF NOT EXISTS leases (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      provider_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      stage TEXT NOT NULL DEFAULT 'awaiting_signature'
        CHECK (stage IN ('awaiting_signature','awaiting_payment','awaiting_confirmation','finalized')),
      tenant_signed_at TEXT,
      landlord_signed_at TEXT,
      tenant_signature_name TEXT,
      landlord_signature_name TEXT,
      tenant_signature_method TEXT,
      landlord_signature_method TEXT,
      payment_marked_at TEXT,
      payment_provider TEXT,
      payment_reference TEXT,
      confirmed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS leases_tenant_id_idx ON leases(tenant_id);
    CREATE INDEX IF NOT EXISTS leases_provider_id_idx ON leases(provider_id);

    CREATE TABLE IF NOT EXISTS lease_messages (
      id TEXT PRIMARY KEY,
      lease_id TEXT NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS lease_messages_lease_id_idx ON lease_messages(lease_id);

    -- Outreach to listings found outside LeaseMatch (via the agent's web
    -- search). Each inquiry gets its own reply-to email alias so a real
    -- reply from the external agent/landlord can be routed back into this
    -- thread instead of the tenant's personal inbox. See lib/email.ts.
    CREATE TABLE IF NOT EXISTS external_inquiries (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      source_site TEXT NOT NULL,
      listing_title TEXT NOT NULL,
      listing_url TEXT,
      contact_email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','sent','replied','closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS external_inquiries_tenant_id_idx ON external_inquiries(tenant_id);

    CREATE TABLE IF NOT EXISTS external_inquiry_messages (
      id TEXT PRIMARY KEY,
      inquiry_id TEXT NOT NULL REFERENCES external_inquiries(id) ON DELETE CASCADE,
      direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
      sender_label TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS external_inquiry_messages_inquiry_id_idx ON external_inquiry_messages(inquiry_id);

    -- Live market searches the agent ran on Bayut / Dubizzle through
    -- OpenAI's hosted web search (no scraping), and the individual ads it
    -- found. Kept so a tenant can come back to a result to email the
    -- advertiser or have the agent (simulated) call them. See
    -- lib/market-search.ts.
    CREATE TABLE IF NOT EXISTS market_searches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      criteria TEXT NOT NULL,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS market_searches_tenant_id_idx ON market_searches(tenant_id);

    CREATE TABLE IF NOT EXISTS market_listings (
      id TEXT PRIMARY KEY,
      search_id TEXT NOT NULL REFERENCES market_searches(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'listing' CHECK (kind IN ('listing','results_page')),
      source_site TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      price_text TEXT,
      location TEXT,
      beds TEXT,
      advertiser_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS market_listings_search_id_idx ON market_listings(search_id);

    -- Simulated agent phone calls to landlords. Nothing is ever dialled —
    -- the transcript is a scripted simulation (lib/call-script.ts) and every
    -- record is labelled as such wherever it's shown.
    CREATE TABLE IF NOT EXISTS agent_calls (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      market_listing_id TEXT REFERENCES market_listings(id) ON DELETE SET NULL,
      inquiry_id TEXT REFERENCES external_inquiries(id) ON DELETE SET NULL,
      listing_title TEXT NOT NULL,
      callee_label TEXT NOT NULL,
      outcome TEXT NOT NULL,
      transcript TEXT NOT NULL,
      summary TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS agent_calls_tenant_id_idx ON agent_calls(tenant_id);
  `);

  // Additive column migrations for databases created before these existed.
  addColumnIfMissing(db, "properties", "photos", "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(db, "external_inquiries", "contact_phone", "TEXT");
  addColumnIfMissing(db, "external_inquiries", "market_listing_id", "TEXT");
  addColumnIfMissing(db, "leases", "package", "TEXT");
  addColumnIfMissing(db, "leases", "package_paid_at", "TEXT");
  addColumnIfMissing(db, "leases", "terms", "TEXT");
  for (const col of [
    "handover_method",
    "handover_date",
    "handover_time",
    "handover_place",
    "handover_address",
    "handover_recipient",
    "handover_phone",
    "handover_notes",
    "handover_set_at",
    "handover_confirmed_at",
    "keys_received_at",
  ]) {
    addColumnIfMissing(db, "leases", col, "TEXT");
  }
  migrateUploadKinds(db);
  db.exec(`
    -- Private files on disk (UPLOAD_DIR): inspection photos.
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('photo','inspection','payment_proof')),
      file_name TEXT NOT NULL,
      original_name TEXT,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- "Notify me" alerts: tenants wait for listings, landlords/agents for tenants.
    CREATE TABLE IF NOT EXISTS saved_alerts (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('listing','tenant')),
      location TEXT,
      max_price REAL,
      min_beds INTEGER,
      property_type TEXT,
      note TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      last_notified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      lease_id TEXT REFERENCES leases(id) ON DELETE SET NULL,
      created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL DEFAULT 'viewing' CHECK (purpose IN ('viewing','handover','listing')),
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','done')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT
    );
    -- Payment confirmations attached by both sides: the tenant's proof of
    -- payment and the landlord's proof of receipt. When both exist the
    -- platform concludes the lease automatically.
    CREATE TABLE IF NOT EXISTS payment_proofs (
      id TEXT PRIMARY KEY,
      lease_id TEXT NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
      side TEXT NOT NULL CHECK (side IN ('tenant','landlord')),
      upload_id TEXT REFERENCES uploads(id) ON DELETE SET NULL,
      amount REAL,
      reference TEXT,
      note TEXT,
      created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS inspection_photos (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
      step TEXT NOT NULL,
      upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
      analysis TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedSampleData(db);
}

// Schema 4 created uploads with CHECK (photo, inspection); SQLite can't
// alter a CHECK, so rebuild the table once to allow payment proofs.
function migrateUploadKinds(db: DatabaseSync) {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'uploads'`).get() as
    | { sql: string }
    | undefined;
  if (!row || row.sql.includes("'payment_proof'")) return;
  db.exec("PRAGMA foreign_keys = OFF;");
  try {
    db.exec(`
      BEGIN;
      CREATE TABLE uploads_v5 (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('photo','inspection','payment_proof')),
        file_name TEXT NOT NULL,
        original_name TEXT,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO uploads_v5 SELECT id, owner_id, property_id, kind, file_name, original_name, mime, size, created_at FROM uploads;
      DROP TABLE uploads;
      ALTER TABLE uploads_v5 RENAME TO uploads;
      COMMIT;
    `);
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

function addColumnIfMissing(db: DatabaseSync, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

// Reuse one connection across hot-reloads in dev (Next.js re-evaluates
// modules on every request in dev unless we stash the instance globally).
function getDb(): DatabaseSync {
  let conn = globalThis.__leasematchDb;
  if (!conn) {
    conn = open();
    globalThis.__leasematchDb = conn;
  }
  if (globalThis.__leasematchSchemaVersion !== SCHEMA_VERSION) {
    ensureSchema(conn);
    globalThis.__leasematchSchemaVersion = SCHEMA_VERSION;
  }
  return conn;
}

// Opened lazily on first use, not at import time: `next build` imports
// route modules in parallel workers (which would fight over the file), and
// on Render the persistent disk isn't mounted until the service starts.
export const db = new Proxy({} as DatabaseSync, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Role = "tenant" | "owner" | "broker" | "pm";

export type Profile = {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  full_name: string;
  company_name: string | null;
  created_at: string;
};

export type Property = {
  id: string;
  provider_id: string;
  title: string;
  property_type: string;
  location: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;
  furnished: "furnished" | "unfurnished";
  description: string | null;
  amenities: string[];
  photos: string[];
  status: string;
  created_at: string;
};

export function newId(): string {
  return randomUUID();
}

export function createProfile(input: {
  email: string;
  passwordHash: string;
  role: Role;
  fullName: string;
  companyName?: string | null;
}): Profile {
  const id = newId();
  db.prepare(
    `INSERT INTO profiles (id, email, password_hash, role, full_name, company_name)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.email.toLowerCase().trim(),
    input.passwordHash,
    input.role,
    input.fullName.trim(),
    input.companyName?.trim() || null
  );
  return getProfileById(id)!;
}

export function getProfileByEmail(email: string): Profile | undefined {
  return db
    .prepare(`SELECT * FROM profiles WHERE email = ?`)
    .get(email.toLowerCase().trim()) as Profile | undefined;
}

export function getProfileById(id: string): Profile | undefined {
  return db.prepare(`SELECT * FROM profiles WHERE id = ?`).get(id) as
    | Profile
    | undefined;
}

export function createProperty(input: {
  providerId: string;
  title: string;
  propertyType: string;
  location: string;
  price: number;
  beds: number;
  baths: number;
  sqft?: number | null;
  furnished: "furnished" | "unfurnished";
  description?: string | null;
  amenities: string[];
}): Property {
  const id = newId();
  db.prepare(
    `INSERT INTO properties
      (id, provider_id, title, property_type, location, price, beds, baths, sqft, furnished, description, amenities, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification')`
  ).run(
    id,
    input.providerId,
    input.title.trim(),
    input.propertyType,
    input.location.trim(),
    input.price,
    input.beds,
    input.baths,
    input.sqft ?? null,
    input.furnished,
    input.description?.trim() || null,
    JSON.stringify(input.amenities)
  );
  return getPropertyById(id)!;
}

function rowToProperty(row: unknown): Property {
  const r = row as Omit<Property, "amenities" | "photos"> & { amenities: string; photos: string };
  return {
    ...r,
    amenities: JSON.parse(r.amenities || "[]"),
    photos: JSON.parse(r.photos || "[]"),
  };
}

export function getPropertyById(id: string): Property | undefined {
  const row = db.prepare(`SELECT * FROM properties WHERE id = ?`).get(id);
  return row ? rowToProperty(row) : undefined;
}

export function listPropertiesByProvider(providerId: string): Property[] {
  const rows = db
    .prepare(
      `SELECT * FROM properties WHERE provider_id = ? ORDER BY created_at DESC`
    )
    .all(providerId);
  return rows.map(rowToProperty);
}

export function listLiveProperties(): Property[] {
  const rows = db
    .prepare(`SELECT * FROM properties WHERE status = 'live' ORDER BY created_at DESC`)
    .all();
  return rows.map(rowToProperty);
}

export type PropertyFilters = {
  propertyType?: string;
  location?: string;
  maxPrice?: number;
  minBeds?: number;
  furnished?: string;
  q?: string;
};

// The browsable property database (/listings) — live listings only,
// filtered in SQL so it scales past the sample set.
export function searchLiveProperties(filters: PropertyFilters): Property[] {
  const where = ["status = 'live'"];
  const args: (string | number)[] = [];
  if (filters.propertyType) {
    where.push("property_type = ?");
    args.push(filters.propertyType);
  }
  if (filters.location) {
    where.push("location = ?");
    args.push(filters.location);
  }
  if (filters.maxPrice) {
    where.push("price <= ?");
    args.push(filters.maxPrice);
  }
  if (filters.minBeds !== undefined) {
    where.push("beds >= ?");
    args.push(filters.minBeds);
  }
  if (filters.furnished) {
    where.push("furnished = ?");
    args.push(filters.furnished);
  }
  if (filters.q) {
    where.push("(title LIKE ? OR description LIKE ? OR location LIKE ?)");
    const like = `%${filters.q}%`;
    args.push(like, like, like);
  }
  const rows = db
    .prepare(`SELECT * FROM properties WHERE ${where.join(" AND ")} ORDER BY price ASC`)
    .all(...args);
  return rows.map(rowToProperty);
}

export function countApplicationsByProperty(propertyIds: string[]): Record<string, number> {
  if (propertyIds.length === 0) return {};
  const rows = db
    .prepare(
      `SELECT property_id, COUNT(*) AS n FROM applications
       WHERE property_id IN (${propertyIds.map(() => "?").join(",")}) AND status = 'pending'
       GROUP BY property_id`
    )
    .all(...propertyIds) as { property_id: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.property_id, r.n]));
}

export function daysSince(sqliteDate: string): number {
  const then = new Date(sqliteDate.replace(" ", "T") + "Z").getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export function setPropertyStatus(id: string, status: Property["status"]) {
  db.prepare(`UPDATE properties SET status = ? WHERE id = ?`).run(status, id);
}

// ---- Tenant preferences ----

export type TenantPreferences = {
  profile_id: string;
  property_types: string[];
  locations: string[];
  budget: number | null;
  furnished: string | null;
  notes: string | null;
  updated_at: string;
};

function rowToPrefs(row: unknown): TenantPreferences {
  const r = row as Omit<TenantPreferences, "property_types" | "locations"> & {
    property_types: string;
    locations: string;
  };
  return {
    ...r,
    property_types: JSON.parse(r.property_types || "[]"),
    locations: JSON.parse(r.locations || "[]"),
  };
}

export function getTenantPreferences(profileId: string): TenantPreferences | undefined {
  const row = db
    .prepare(`SELECT * FROM tenant_preferences WHERE profile_id = ?`)
    .get(profileId);
  return row ? rowToPrefs(row) : undefined;
}

export function upsertTenantPreferences(input: {
  profileId: string;
  propertyTypes: string[];
  locations: string[];
  budget: number | null;
  furnished: string | null;
  notes: string | null;
}): TenantPreferences {
  db.prepare(
    `INSERT INTO tenant_preferences (profile_id, property_types, locations, budget, furnished, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (profile_id) DO UPDATE SET
       property_types = excluded.property_types,
       locations = excluded.locations,
       budget = excluded.budget,
       furnished = excluded.furnished,
       notes = excluded.notes,
       updated_at = datetime('now')`
  ).run(
    input.profileId,
    JSON.stringify(input.propertyTypes),
    JSON.stringify(input.locations),
    input.budget,
    input.furnished,
    input.notes?.trim() || null
  );
  return getTenantPreferences(input.profileId)!;
}

// ---- Matching ----

export function scoreProperty(p: Property, prefs?: TenantPreferences | null): number {
  if (!prefs) return 50;
  let score = 0;
  score += !prefs.property_types.length || prefs.property_types.includes(p.property_type) ? 35 : 5;
  score += !prefs.locations.length || prefs.locations.includes(p.location) ? 35 : 5;
  if (!prefs.budget) score += 30;
  else if (p.price <= prefs.budget) score += 30;
  else if (p.price <= prefs.budget * 1.25) score += 16;
  else score += 4;
  return Math.min(99, score);
}

// ---- Applications ----

export type Application = {
  id: string;
  property_id: string;
  tenant_id: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  occupation: string;
  monthly_income: number | null;
  move_in: string | null;
  note: string | null;
  created_at: string;
};

export function createApplication(input: {
  propertyId: string;
  tenantId: string;
  occupation: string;
  monthlyIncome: number | null;
  moveIn: string | null;
  note: string | null;
}): Application {
  const existing = db
    .prepare(`SELECT * FROM applications WHERE property_id = ? AND tenant_id = ?`)
    .get(input.propertyId, input.tenantId) as Application | undefined;
  if (existing) return existing;

  const id = newId();
  db.prepare(
    `INSERT INTO applications (id, property_id, tenant_id, status, occupation, monthly_income, move_in, note)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
  ).run(
    id,
    input.propertyId,
    input.tenantId,
    input.occupation.trim(),
    input.monthlyIncome,
    input.moveIn?.trim() || null,
    input.note?.trim() || null
  );
  return getApplicationById(id)!;
}

export function getApplicationById(id: string): Application | undefined {
  return db.prepare(`SELECT * FROM applications WHERE id = ?`).get(id) as
    | Application
    | undefined;
}

export function getApplicationForTenant(
  propertyId: string,
  tenantId: string
): Application | undefined {
  return db
    .prepare(`SELECT * FROM applications WHERE property_id = ? AND tenant_id = ?`)
    .get(propertyId, tenantId) as Application | undefined;
}

export function listApplicationsByProperty(propertyId: string): Application[] {
  return db
    .prepare(`SELECT * FROM applications WHERE property_id = ? ORDER BY created_at DESC`)
    .all(propertyId) as Application[];
}

export function listApplicationsByTenant(tenantId: string): Application[] {
  return db
    .prepare(`SELECT * FROM applications WHERE tenant_id = ? ORDER BY created_at DESC`)
    .all(tenantId) as Application[];
}

export function setApplicationStatus(
  id: string,
  status: Application["status"]
): Application | undefined {
  db.prepare(`UPDATE applications SET status = ? WHERE id = ?`).run(status, id);
  return getApplicationById(id);
}

// ---- Leases ----

export type LeaseStage =
  | "awaiting_signature"
  | "awaiting_payment"
  | "awaiting_confirmation"
  | "finalized";

export type SignatureMethod = "uae_pass" | "in_app";

export type Lease = {
  id: string;
  application_id: string;
  property_id: string;
  tenant_id: string;
  provider_id: string;
  stage: LeaseStage;
  tenant_signed_at: string | null;
  landlord_signed_at: string | null;
  tenant_signature_name: string | null;
  landlord_signature_name: string | null;
  tenant_signature_method: SignatureMethod | null;
  landlord_signature_method: SignatureMethod | null;
  payment_marked_at: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  confirmed_at: string | null;
  package: string | null;
  package_paid_at: string | null;
  terms: string | null;
  handover_method: "in_person" | "mail" | null;
  handover_date: string | null;
  handover_time: string | null;
  handover_place: string | null;
  handover_address: string | null;
  handover_recipient: string | null;
  handover_phone: string | null;
  handover_notes: string | null;
  handover_set_at: string | null;
  handover_confirmed_at: string | null;
  keys_received_at: string | null;
  created_at: string;
};

export function createLeaseFromApplication(applicationId: string): Lease {
  const existing = db
    .prepare(`SELECT * FROM leases WHERE application_id = ?`)
    .get(applicationId) as Lease | undefined;
  if (existing) return existing;

  const application = getApplicationById(applicationId);
  if (!application) throw new Error("Application not found");
  const property = getPropertyById(application.property_id);
  if (!property) throw new Error("Property not found");

  const id = newId();
  db.prepare(
    `INSERT INTO leases (id, application_id, property_id, tenant_id, provider_id, stage)
     VALUES (?, ?, ?, ?, ?, 'awaiting_signature')`
  ).run(id, applicationId, property.id, application.tenant_id, property.provider_id);
  return getLeaseById(id)!;
}

export function getLeaseById(id: string): Lease | undefined {
  return db.prepare(`SELECT * FROM leases WHERE id = ?`).get(id) as Lease | undefined;
}

export function getLeaseByApplication(applicationId: string): Lease | undefined {
  return db
    .prepare(`SELECT * FROM leases WHERE application_id = ?`)
    .get(applicationId) as Lease | undefined;
}

export function listLeasesForUser(profileId: string, role: Role): Lease[] {
  const column = role === "tenant" ? "tenant_id" : "provider_id";
  return db
    .prepare(`SELECT * FROM leases WHERE ${column} = ? ORDER BY created_at DESC`)
    .all(profileId) as Lease[];
}

function advanceLeaseStage(lease: Lease): Lease {
  if (lease.stage === "awaiting_signature" && lease.tenant_signed_at && lease.landlord_signed_at) {
    db.prepare(`UPDATE leases SET stage = 'awaiting_payment' WHERE id = ?`).run(lease.id);
    return getLeaseById(lease.id)!;
  }
  return lease;
}

export function signLease(
  leaseId: string,
  role: "tenant" | "provider",
  input: { signatureName: string; method: SignatureMethod }
): Lease {
  const dateCol = role === "tenant" ? "tenant_signed_at" : "landlord_signed_at";
  const nameCol = role === "tenant" ? "tenant_signature_name" : "landlord_signature_name";
  const methodCol = role === "tenant" ? "tenant_signature_method" : "landlord_signature_method";
  db.prepare(
    `UPDATE leases SET ${dateCol} = datetime('now'), ${nameCol} = ?, ${methodCol} = ? WHERE id = ?`
  ).run(input.signatureName.trim(), input.method, leaseId);
  const lease = getLeaseById(leaseId)!;
  return advanceLeaseStage(lease);
}

export function submitPayment(
  leaseId: string,
  input?: { provider?: string; reference?: string }
): Lease {
  db.prepare(
    `UPDATE leases SET payment_marked_at = datetime('now'), stage = 'awaiting_confirmation',
       payment_provider = ?, payment_reference = ?
     WHERE id = ?`
  ).run(input?.provider ?? "manual", input?.reference ?? null, leaseId);
  return getLeaseById(leaseId)!;
}

export function confirmPayment(leaseId: string): Lease {
  db.prepare(
    `UPDATE leases SET confirmed_at = datetime('now'), stage = 'finalized' WHERE id = ?`
  ).run(leaseId);
  const lease = getLeaseById(leaseId)!;
  setPropertyStatus(lease.property_id, "leased");
  return lease;
}

// ---- Lease amendment chat ----

export type LeaseMessage = {
  id: string;
  lease_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export function listLeaseMessages(leaseId: string): LeaseMessage[] {
  return db
    .prepare(`SELECT * FROM lease_messages WHERE lease_id = ? ORDER BY created_at ASC`)
    .all(leaseId) as LeaseMessage[];
}

export function addLeaseMessage(input: {
  leaseId: string;
  senderId: string;
  body: string;
}): LeaseMessage {
  const id = newId();
  db.prepare(
    `INSERT INTO lease_messages (id, lease_id, sender_id, body) VALUES (?, ?, ?, ?)`
  ).run(id, input.leaseId, input.senderId, input.body.trim());
  return db.prepare(`SELECT * FROM lease_messages WHERE id = ?`).get(id) as LeaseMessage;
}

// ---- External inquiries (agent outreach to listings found outside
// LeaseMatch via web search) ----

export type ExternalInquiry = {
  id: string;
  tenant_id: string;
  source_site: string;
  listing_title: string;
  listing_url: string | null;
  contact_email: string;
  contact_phone: string | null;
  market_listing_id: string | null;
  status: "draft" | "sent" | "replied" | "closed";
  created_at: string;
};

export type ExternalInquiryMessage = {
  id: string;
  inquiry_id: string;
  direction: "outbound" | "inbound";
  sender_label: string;
  body: string;
  created_at: string;
};

export function createExternalInquiry(input: {
  tenantId: string;
  sourceSite: string;
  listingTitle: string;
  listingUrl: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  marketListingId?: string | null;
  draftBody: string;
}): ExternalInquiry {
  const id = newId();
  db.prepare(
    `INSERT INTO external_inquiries (id, tenant_id, source_site, listing_title, listing_url, contact_email, contact_phone, market_listing_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.tenantId,
    input.sourceSite,
    input.listingTitle,
    input.listingUrl,
    input.contactEmail,
    input.contactPhone ?? null,
    input.marketListingId ?? null
  );
  db.prepare(
    `INSERT INTO external_inquiry_messages (id, inquiry_id, direction, sender_label, body)
     VALUES (?, ?, 'outbound', 'You (draft)', ?)`
  ).run(newId(), id, input.draftBody.trim());
  return getExternalInquiryById(id)!;
}

export function getExternalInquiryById(id: string): ExternalInquiry | undefined {
  return db.prepare(`SELECT * FROM external_inquiries WHERE id = ?`).get(id) as
    | ExternalInquiry
    | undefined;
}

export function listExternalInquiriesForTenant(tenantId: string): ExternalInquiry[] {
  return db
    .prepare(`SELECT * FROM external_inquiries WHERE tenant_id = ? ORDER BY created_at DESC`)
    .all(tenantId) as ExternalInquiry[];
}

export function listExternalInquiryMessages(inquiryId: string): ExternalInquiryMessage[] {
  return db
    .prepare(`SELECT * FROM external_inquiry_messages WHERE inquiry_id = ? ORDER BY created_at ASC`)
    .all(inquiryId) as ExternalInquiryMessage[];
}

// Replaces the single draft message body while the inquiry is still
// unsent — lets the tenant edit the AI's draft before anything goes out.
export function updateExternalInquiryDraft(inquiryId: string, body: string) {
  const msg = db
    .prepare(
      `SELECT id FROM external_inquiry_messages WHERE inquiry_id = ? AND direction = 'outbound' ORDER BY created_at ASC LIMIT 1`
    )
    .get(inquiryId) as { id: string } | undefined;
  if (!msg) return;
  db.prepare(`UPDATE external_inquiry_messages SET body = ? WHERE id = ?`).run(body.trim(), msg.id);
}

export function markExternalInquirySent(inquiryId: string) {
  db.prepare(`UPDATE external_inquiries SET status = 'sent' WHERE id = ? AND status = 'draft'`).run(
    inquiryId
  );
  db.prepare(
    `UPDATE external_inquiry_messages SET sender_label = 'You'
     WHERE id = (
       SELECT id FROM external_inquiry_messages
       WHERE inquiry_id = ? AND direction = 'outbound' ORDER BY created_at ASC LIMIT 1
     )`
  ).run(inquiryId);
}

export function addExternalInquiryMessage(input: {
  inquiryId: string;
  direction: "outbound" | "inbound";
  senderLabel: string;
  body: string;
}): ExternalInquiryMessage {
  const id = newId();
  db.prepare(
    `INSERT INTO external_inquiry_messages (id, inquiry_id, direction, sender_label, body)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, input.inquiryId, input.direction, input.senderLabel, input.body.trim());
  if (input.direction === "outbound") {
    db.prepare(`UPDATE external_inquiries SET status = 'sent' WHERE id = ? AND status != 'closed'`).run(
      input.inquiryId
    );
  } else {
    db.prepare(`UPDATE external_inquiries SET status = 'replied' WHERE id = ? AND status != 'closed'`).run(
      input.inquiryId
    );
  }
  return db.prepare(`SELECT * FROM external_inquiry_messages WHERE id = ?`).get(id) as ExternalInquiryMessage;
}

export function listInquiriesForMarketListing(
  marketListingId: string,
  tenantId: string
): ExternalInquiry[] {
  return db
    .prepare(
      `SELECT * FROM external_inquiries WHERE market_listing_id = ? AND tenant_id = ? ORDER BY created_at DESC`
    )
    .all(marketListingId, tenantId) as ExternalInquiry[];
}

// ---- Market searches (agent search across Bayut / Dubizzle) ----

export type MarketSearch = {
  id: string;
  tenant_id: string;
  criteria: string; // JSON of MarketCriteria
  summary: string | null;
  created_at: string;
};

export type MarketListing = {
  id: string;
  search_id: string;
  tenant_id: string;
  kind: "listing" | "results_page";
  source_site: string;
  title: string;
  url: string;
  price_text: string | null;
  location: string | null;
  beds: string | null;
  advertiser_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  summary: string | null;
  created_at: string;
};

export function createMarketSearch(input: {
  tenantId: string;
  criteria: unknown;
  summary: string | null;
  listings: Omit<MarketListing, "id" | "search_id" | "tenant_id" | "created_at">[];
}): MarketSearch {
  const id = newId();
  db.prepare(
    `INSERT INTO market_searches (id, tenant_id, criteria, summary) VALUES (?, ?, ?, ?)`
  ).run(id, input.tenantId, JSON.stringify(input.criteria), input.summary);
  const insert = db.prepare(
    `INSERT INTO market_listings
      (id, search_id, tenant_id, kind, source_site, title, url, price_text, location, beds, advertiser_name, contact_email, contact_phone, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const l of input.listings) {
    insert.run(
      newId(),
      id,
      input.tenantId,
      l.kind,
      l.source_site,
      l.title,
      l.url,
      l.price_text,
      l.location,
      l.beds,
      l.advertiser_name,
      l.contact_email,
      l.contact_phone,
      l.summary
    );
  }
  return db.prepare(`SELECT * FROM market_searches WHERE id = ?`).get(id) as MarketSearch;
}

export function listMarketSearches(tenantId: string, limit = 10): MarketSearch[] {
  return db
    .prepare(`SELECT * FROM market_searches WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(tenantId, limit) as MarketSearch[];
}

export function getMarketSearch(id: string): MarketSearch | undefined {
  return db.prepare(`SELECT * FROM market_searches WHERE id = ?`).get(id) as
    | MarketSearch
    | undefined;
}

export function listMarketListings(searchId: string): MarketListing[] {
  return db
    .prepare(`SELECT * FROM market_listings WHERE search_id = ? ORDER BY rowid ASC`)
    .all(searchId) as MarketListing[];
}

export function getMarketListing(id: string): MarketListing | undefined {
  return db.prepare(`SELECT * FROM market_listings WHERE id = ?`).get(id) as
    | MarketListing
    | undefined;
}

// ---- Simulated agent calls ----

export type CallLine = { speaker: "agent" | "callee"; text: string };

export type AgentCall = {
  id: string;
  tenant_id: string;
  market_listing_id: string | null;
  inquiry_id: string | null;
  listing_title: string;
  callee_label: string;
  outcome: string;
  transcript: CallLine[];
  summary: string;
  duration_seconds: number;
  created_at: string;
};

function rowToCall(row: unknown): AgentCall {
  const r = row as Omit<AgentCall, "transcript"> & { transcript: string };
  return { ...r, transcript: JSON.parse(r.transcript || "[]") };
}

export function createAgentCall(input: {
  tenantId: string;
  marketListingId: string | null;
  inquiryId: string | null;
  listingTitle: string;
  calleeLabel: string;
  outcome: string;
  transcript: CallLine[];
  summary: string;
  durationSeconds: number;
}): AgentCall {
  const id = newId();
  db.prepare(
    `INSERT INTO agent_calls
      (id, tenant_id, market_listing_id, inquiry_id, listing_title, callee_label, outcome, transcript, summary, duration_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.tenantId,
    input.marketListingId,
    input.inquiryId,
    input.listingTitle,
    input.calleeLabel,
    input.outcome,
    JSON.stringify(input.transcript),
    input.summary,
    input.durationSeconds
  );
  return rowToCall(db.prepare(`SELECT * FROM agent_calls WHERE id = ?`).get(id));
}

export function listAgentCalls(
  tenantId: string,
  filter: { marketListingId?: string; inquiryId?: string } = {}
): AgentCall[] {
  if (filter.marketListingId) {
    return db
      .prepare(
        `SELECT * FROM agent_calls WHERE tenant_id = ? AND market_listing_id = ? ORDER BY created_at DESC`
      )
      .all(tenantId, filter.marketListingId)
      .map(rowToCall);
  }
  if (filter.inquiryId) {
    return db
      .prepare(`SELECT * FROM agent_calls WHERE tenant_id = ? AND inquiry_id = ? ORDER BY created_at DESC`)
      .all(tenantId, filter.inquiryId)
      .map(rowToCall);
  }
  return db
    .prepare(`SELECT * FROM agent_calls WHERE tenant_id = ? ORDER BY created_at DESC`)
    .all(tenantId)
    .map(rowToCall);
}

// ---- Uploads ----

export type Upload = {
  id: string;
  owner_id: string;
  property_id: string | null;
  kind: "photo" | "inspection" | "payment_proof";
  file_name: string;
  original_name: string | null;
  mime: string;
  size: number;
  created_at: string;
};

export function createUpload(input: Omit<Upload, "created_at">): Upload {
  db.prepare(
    `INSERT INTO uploads (id, owner_id, property_id, kind, file_name, original_name, mime, size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.owner_id,
    input.property_id,
    input.kind,
    input.file_name,
    input.original_name,
    input.mime,
    input.size
  );
  return getUpload(input.id)!;
}

export function getUpload(id: string): Upload | undefined {
  return db.prepare(`SELECT * FROM uploads WHERE id = ?`).get(id) as Upload | undefined;
}


// ---- Deal packages ----

export function setLeasePackage(leaseId: string, pkg: string) {
  db.prepare(`UPDATE leases SET package = ? WHERE id = ? AND package_paid_at IS NULL`).run(pkg, leaseId);
}

export function markPackagePaid(leaseId: string) {
  db.prepare(`UPDATE leases SET package_paid_at = COALESCE(package_paid_at, datetime('now')) WHERE id = ?`).run(leaseId);
}

export function saveLeaseTerms(leaseId: string, terms: Record<string, unknown>) {
  db.prepare(`UPDATE leases SET terms = ? WHERE id = ? AND tenant_signed_at IS NULL AND landlord_signed_at IS NULL`).run(
    JSON.stringify(terms),
    leaseId
  );
}

// ---- Saved alerts ("notify me") ----

export type SavedAlert = {
  id: string;
  profile_id: string;
  kind: "listing" | "tenant";
  location: string | null;
  max_price: number | null;
  min_beds: number | null;
  property_type: string | null;
  note: string | null;
  active: number;
  last_notified_at: string | null;
  created_at: string;
};

export function createSavedAlert(a: Omit<SavedAlert, "id" | "active" | "last_notified_at" | "created_at">): SavedAlert {
  const id = newId();
  db.prepare(
    `INSERT INTO saved_alerts (id, profile_id, kind, location, max_price, min_beds, property_type, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, a.profile_id, a.kind, a.location, a.max_price, a.min_beds, a.property_type, a.note);
  return db.prepare(`SELECT * FROM saved_alerts WHERE id = ?`).get(id) as SavedAlert;
}

export function listSavedAlerts(profileId: string): SavedAlert[] {
  return db
    .prepare(`SELECT * FROM saved_alerts WHERE profile_id = ? AND active = 1 ORDER BY created_at DESC`)
    .all(profileId) as SavedAlert[];
}

export function deactivateSavedAlert(id: string, profileId: string) {
  db.prepare(`UPDATE saved_alerts SET active = 0 WHERE id = ? AND profile_id = ?`).run(id, profileId);
}

export function activeAlerts(kind: SavedAlert["kind"]): SavedAlert[] {
  return db.prepare(`SELECT * FROM saved_alerts WHERE kind = ? AND active = 1`).all(kind) as SavedAlert[];
}

export function touchAlert(id: string) {
  db.prepare(`UPDATE saved_alerts SET last_notified_at = datetime('now') WHERE id = ?`).run(id);
}

// ---- Photo inspections ----

export type Inspection = {
  id: string;
  property_id: string;
  lease_id: string | null;
  created_by: string;
  purpose: "viewing" | "handover" | "listing";
  status: "in_progress" | "done";
  created_at: string;
  finished_at: string | null;
};

export type InspectionPhoto = {
  id: string;
  inspection_id: string;
  step: string;
  upload_id: string;
  analysis: string | null;
  created_at: string;
};

export function createInspection(i: { propertyId: string; leaseId: string | null; createdBy: string; purpose: Inspection["purpose"] }): Inspection {
  const id = newId();
  db.prepare(`INSERT INTO inspections (id, property_id, lease_id, created_by, purpose) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    i.propertyId,
    i.leaseId,
    i.createdBy,
    i.purpose
  );
  return getInspection(id)!;
}

export const getInspection = (id: string) => db.prepare(`SELECT * FROM inspections WHERE id = ?`).get(id) as Inspection | undefined;

export function listInspectionsFor(profileId: string, propertyId?: string): Inspection[] {
  return (propertyId
    ? db.prepare(`SELECT * FROM inspections WHERE created_by = ? AND property_id = ? ORDER BY created_at DESC`).all(profileId, propertyId)
    : db.prepare(`SELECT * FROM inspections WHERE created_by = ? ORDER BY created_at DESC`).all(profileId)) as Inspection[];
}

export function listInspectionsForLease(leaseId: string): Inspection[] {
  return db.prepare(`SELECT * FROM inspections WHERE lease_id = ? ORDER BY created_at DESC`).all(leaseId) as Inspection[];
}

export function addInspectionPhoto(i: { inspectionId: string; step: string; uploadId: string; analysis: unknown }) {
  db.prepare(`INSERT INTO inspection_photos (id, inspection_id, step, upload_id, analysis) VALUES (?, ?, ?, ?, ?)`).run(
    newId(),
    i.inspectionId,
    i.step,
    i.uploadId,
    JSON.stringify(i.analysis)
  );
}

export const listInspectionPhotos = (inspectionId: string) =>
  db.prepare(`SELECT * FROM inspection_photos WHERE inspection_id = ? ORDER BY created_at`).all(inspectionId) as InspectionPhoto[];

export function finishInspection(id: string) {
  db.prepare(`UPDATE inspections SET status = 'done', finished_at = datetime('now') WHERE id = ?`).run(id);
}

export function inspectionIdsForUpload(uploadId: string): string[] {
  return (db.prepare(`SELECT inspection_id FROM inspection_photos WHERE upload_id = ?`).all(uploadId) as { inspection_id: string }[]).map(
    (r) => r.inspection_id
  );
}

// ---- Payment confirmations (both sides) ----

export type PaymentProof = {
  id: string;
  lease_id: string;
  side: "tenant" | "landlord";
  upload_id: string | null;
  amount: number | null;
  reference: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
};

export function listPaymentProofs(leaseId: string): PaymentProof[] {
  return db.prepare(`SELECT * FROM payment_proofs WHERE lease_id = ? ORDER BY created_at`).all(leaseId) as PaymentProof[];
}

export function paymentProofIdsForUpload(uploadId: string): string[] {
  return (db.prepare(`SELECT lease_id FROM payment_proofs WHERE upload_id = ?`).all(uploadId) as { lease_id: string }[]).map((r) => r.lease_id);
}

// Records one side's confirmation and moves the lease on: the tenant's proof
// marks the payment as sent; once the landlord's proof of receipt is also
// there, the platform concludes the agreement automatically.
export function addPaymentProof(i: {
  leaseId: string;
  side: PaymentProof["side"];
  uploadId: string | null;
  amount: number | null;
  reference: string | null;
  note: string | null;
  createdBy: string;
}): Lease {
  db.prepare(
    `INSERT INTO payment_proofs (id, lease_id, side, upload_id, amount, reference, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(newId(), i.leaseId, i.side, i.uploadId, i.amount, i.reference, i.note, i.createdBy);
  let lease = getLeaseById(i.leaseId)!;
  const proofs = listPaymentProofs(i.leaseId);
  const tenantDone = proofs.some((p) => p.side === "tenant") || (lease.payment_provider === "stripe" && Boolean(lease.payment_reference));
  if (i.side === "tenant" && lease.stage === "awaiting_payment") {
    lease = submitPayment(i.leaseId, { provider: "bank_transfer", reference: i.reference ?? undefined });
  }
  if (tenantDone && proofs.some((p) => p.side === "landlord") && lease.stage !== "finalized") {
    if (lease.stage === "awaiting_payment") submitPayment(i.leaseId, { provider: "bank_transfer", reference: i.reference ?? undefined });
    lease = confirmPayment(i.leaseId);
  }
  return lease;
}

// ---- Key handover ----

export function setHandover(
  leaseId: string,
  h: {
    method: "in_person" | "mail";
    date: string | null;
    time: string | null;
    place: string | null;
    address: string | null;
    recipient: string | null;
    phone: string | null;
    notes: string | null;
  }
) {
  db.prepare(
    `UPDATE leases SET handover_method = ?, handover_date = ?, handover_time = ?, handover_place = ?, handover_address = ?,
       handover_recipient = ?, handover_phone = ?, handover_notes = ?, handover_set_at = datetime('now'), handover_confirmed_at = NULL
     WHERE id = ? AND keys_received_at IS NULL`
  ).run(h.method, h.date, h.time, h.place, h.address, h.recipient, h.phone, h.notes, leaseId);
}

export function confirmHandover(leaseId: string) {
  db.prepare(`UPDATE leases SET handover_confirmed_at = datetime('now') WHERE id = ? AND handover_method IS NOT NULL`).run(leaseId);
}

export function markKeysReceived(leaseId: string) {
  db.prepare(`UPDATE leases SET keys_received_at = datetime('now') WHERE id = ? AND handover_confirmed_at IS NOT NULL`).run(leaseId);
}
