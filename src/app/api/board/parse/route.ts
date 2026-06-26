import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { parseBoardPdf } from "@/lib/parser/board-parser";

export async function POST(request: NextRequest) {
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

  for (const file of files) {
    if (file.type !== "application/pdf") {
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      const text = textResult.text;
      await parser.destroy();

      const entries = parseBoardPdf(text, file.name);

      allEntries.push(
        ...entries.map((e) => ({
          ...e,
          sourceFile: file.name,
        }))
      );
    } catch (error) {
      console.error(`Failed to parse ${file.name}:`, error);
    }
  }

  return NextResponse.json({
    entries: allEntries,
    totalParsed: allEntries.length,
    filesProcessed: files.length,
  });
}
