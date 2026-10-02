import { NextRequest, NextResponse } from "next/server";
import { propertySchema } from "@/lib/schemas";
import { createProperty, listPropertiesByProvider } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const PROVIDER_ROLES = new Set(["owner", "broker", "pm"]);

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!PROVIDER_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Not a provider account" }, { status: 403 });
  }
  const properties = listPropertiesByProvider(session.sub);
  return NextResponse.json({ properties });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!PROVIDER_ROLES.has(session.role)) {
    return NextResponse.json(
      { error: "Only owners, brokers and property managers can list properties" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = propertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const property = createProperty({
    providerId: session.sub,
    title: parsed.data.title,
    propertyType: parsed.data.propertyType,
    location: parsed.data.location,
    price: parsed.data.price,
    beds: parsed.data.beds,
    baths: parsed.data.baths,
    sqft: parsed.data.sqft ?? null,
    furnished: parsed.data.furnished,
    description: parsed.data.description ?? null,
    amenities: parsed.data.amenities,
  });

  return NextResponse.json({ property }, { status: 201 });
}
