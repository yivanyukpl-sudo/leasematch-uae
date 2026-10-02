import { NextRequest, NextResponse } from "next/server";
import { signupSchema } from "@/lib/schemas";
import { createProfile, getProfileByEmail } from "@/lib/db";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { fullName, email, password, role, companyName } = parsed.data;

  if (getProfileByEmail(email)) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const profile = createProfile({
    email,
    passwordHash,
    role,
    fullName,
    companyName: companyName ?? null,
  });

  const token = await createSessionToken({
    sub: profile.id,
    role: profile.role,
    email: profile.email,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, role: profile.role });
}
