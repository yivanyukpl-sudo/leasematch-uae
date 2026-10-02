// Mailgun inbound webhook — fires when a reply lands on a
// inquiry-<id>@yourdomain address (set up as a Mailgun Route pointing here).
// This is what turns "AI emails an external listing" into a real two-way
// conversation inside the app instead of a one-shot message into the void.

import { NextResponse } from "next/server";
import {
  addExternalInquiryMessage,
  getExternalInquiryById,
} from "@/lib/db";
import { inquiryIdFromRecipient, verifyMailgunSignature } from "@/lib/email";

export async function POST(req: Request) {
  const form = await req.formData();

  const timestamp = String(form.get("timestamp") || "");
  const token = String(form.get("token") || "");
  const signature = String(form.get("signature") || "");

  if (!verifyMailgunSignature({ timestamp, token, signature })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const recipient = String(form.get("recipient") || "");
  const inquiryId = inquiryIdFromRecipient(recipient);
  if (!inquiryId) {
    // Not an address we recognize — acknowledge so Mailgun doesn't retry,
    // but do nothing with it.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const inquiry = getExternalInquiryById(inquiryId);
  if (!inquiry) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const sender = String(form.get("sender") || form.get("from") || "the listing contact");
  const body =
    String(form.get("stripped-text") || "") || String(form.get("body-plain") || "");

  if (body.trim()) {
    addExternalInquiryMessage({
      inquiryId,
      direction: "inbound",
      senderLabel: sender,
      body: body.trim(),
    });
  }

  return NextResponse.json({ ok: true });
}
