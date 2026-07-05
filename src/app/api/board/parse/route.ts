import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";
import { parseBoardPdf } from "@/lib/parser/board-parser";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const allEntries = [];
  const parseErrors: string[] = [];

  for (const file of files) {
    if (file.type !== "application/pdf") {
      continue;
    }

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const { text } = await extractText(buffer, { mergePages: true });

      console.log(`[board/parse] ${file.name}: extracted ${text.length} chars`);

      const entries = parseBoardPdf(text, file.name);

      console.log(`[board/parse] ${file.name}: parsed ${entries.length} entries`);

      allEntries.push(
        ...entries.map((e) => ({
          ...e,
          sourceFile: file.name,
        }))
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[board/parse] Failed to parse ${file.name}:`, error);
      parseErrors.push(`${file.name}: ${msg}`);
    }
  }

  return NextResponse.json({
    entries: allEntries,
    totalParsed: allEntries.length,
    filesProcessed: files.length,
    ...(parseErrors.length > 0 && { parseErrors }),
  });
}
