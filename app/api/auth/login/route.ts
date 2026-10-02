import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas";
import { getProfileByEmail } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;

  const profile = getProfileByEmail(email);
  if (!profile || !(await verifyPassword(password, profile.password_hash))) {
    return NextResponse.json(
      { error: "Incorrect email or password" },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    sub: profile.id,
    role: profile.role,
    email: profile.email,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, role: profile.role });
}
