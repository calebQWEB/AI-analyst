import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("Received config on API:", body);
    const config = {};
    const errors = [];

    // --- Validate & collect config inputs ---
    if (typeof body.csv === "string") {
      config.csvPath = body.csv; // Can be .csv or .xlsx
    }

    if (typeof body.posthogApiKey === "string") {
      config.posthogApiKey = body.posthogApiKey;
    } else if (body.posthogApiKey !== undefined) {
      errors.push("Invalid PostHog API key format.");
    }

    if (typeof body.emailServer === "string") {
      config.emailServer = body.emailServer;
    }

    // --- Return early if validation fails ---
    if (errors.length > 0) {
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    // --- Parse uploaded spreadsheet if present ---
    let dataPreview = null;

    if (config.csvPath) {
      const { parseSpreadsheetFromSupabase } = await import(
        "@/lib/parseSpreadsheetFromSupabase"
      );
      dataPreview = await parseSpreadsheetFromSupabase(config.csvPath);
    }

    const fileParsed = !!dataPreview;
    const dataReady =
      fileParsed || !!config.posthogApiKey || !!config.emailServer;

    return NextResponse.json({
      success: true,
      config,
      dataPreview,
      fileParsed,
      dataReady,
    });
  } catch (err) {
    console.error("❌ Config Save Error:", err);
    return NextResponse.json(
      { error: "Failed to save config." },
      { status: 500 }
    );
  }
}
