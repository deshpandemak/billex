import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { parseBoardPdf } from "@/lib/parser/board-parser";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const allEntries = [];

    for (const file of files) {
      if (file.type !== "application/pdf") {
        continue;
      }

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
    }

    return NextResponse.json({
      entries: allEntries,
      totalParsed: allEntries.length,
      filesProcessed: files.length,
    });
  } catch (error) {
    console.error("PDF parse error:", error);
    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}
