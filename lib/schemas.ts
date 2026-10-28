import { z } from "zod";

export const roles = ["tenant", "owner", "broker", "pm"] as const;

export const roleLabels: Record<(typeof roles)[number], string> = {
  tenant: "Tenant — I'm looking for a place",
  owner: "Owner — I have a property to lease",
  broker: "Broker — I represent landlords",
  pm: "Property manager — I manage buildings",
};

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name"),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(roles),
    companyName: z.string().trim().optional(),
  })
  .refine(
    (v) => v.role === "tenant" || v.role === "owner" || !!v.companyName,
    { message: "Company name is required for brokers and property managers", path: ["companyName"] }
  );

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const propertyTypes = [
  "Apartment",
  "Villa",
  "Townhouse",
  "Studio",
  "Penthouse",
  "Office",
] as const;

export const amenityOptions = [
  "Parking",
  "Pool",
  "Gym",
  "Balcony",
  "Maid's room",
  "Central AC",
  "Pet friendly",
  "Security",
  "Covered parking",
  "Beach access",
] as const;

export const propertySchema = z.object({
  title: z.string().trim().min(3, "Give the listing a title"),
  propertyType: z.enum(propertyTypes),
  location: z.string().trim().min(2, "Enter a location"),
  price: z.coerce.number().positive("Enter the annual rent"),
  beds: z.coerce.number().int().min(0).max(20),
  baths: z.coerce.number().int().min(0).max(20),
  sqft: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  furnished: z.enum(["furnished", "unfurnished"]),
  description: z.string().trim().max(2000).optional(),
  amenities: z.array(z.string()).default([]),
});

export const preferencesSchema = z.object({
  propertyTypes: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  budget: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  furnished: z.enum(["furnished", "unfurnished", ""]).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const applicationSchema = z.object({
  occupation: z.string().trim().min(2, "Tell us what you do"),
  monthlyIncome: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  moveIn: z.string().trim().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const leaseMessageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(2000),
});

export const externalInquiryReplySchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(2000),
});

export const signatureSchema = z.object({
  signatureName: z.string().trim().min(2, "Type your full legal name to sign"),
});

// Abu Dhabi first: LeaseMatch's launch market (Hub71 is on Al Maryah Island).
export const commonLocations = [
  "Al Maryah Island",
  "Al Reem Island",
  "Abu Dhabi Corniche",
  "Saadiyat Island",
  "Yas Island",
  "Al Raha Beach",
  "Khalifa City",
  "Al Ghadeer",
  "Dubai Marina",
  "Downtown Dubai",
  "Business Bay",
  "Jumeirah Village Circle",
] as const;

export const leaseTermsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the move-in date"),
  months: z.coerce.number().int().min(1, "At least 1 month").max(36),
  deposit: z.coerce.number().min(0).max(10_000_000),
  cheques: z.coerce.number().int().min(1).max(12),
  utilities: z.enum(["tenant", "included"]),
  notes: z.string().max(600).nullable(),
});
