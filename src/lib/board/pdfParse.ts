import type * as PdfJs from "pdfjs-dist";

export interface ParsedBoardRow {
  caseType: string;
  caseNo: string;
  year: string;
  partyName: string;
}

const CASE_PATTERN = /\b([A-Za-z][A-Za-z.]{0,8})\.?\s*No\.?\s*(\d+)\s*\/\s*(\d{4})\b/;

export function parseBoardRowsFromLines(lines: string[]): ParsedBoardRow[] {
  const rows: ParsedBoardRow[] = [];
  for (const line of lines) {
    const match = CASE_PATTERN.exec(line);
    if (!match) continue;
    const caseType = match[1].replace(/\./g, "").toUpperCase();
    const caseNo = match[2];
    const year = match[3];
    const partyName = line
      .slice(match.index + match[0].length)
      .replace(/^[\s\-:.,]+/, "")
      .trim();
    rows.push({ caseType, caseNo, year, partyName });
  }
  return rows;
}

export async function extractLinesFromPdf(file: File): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buffer = await file.arrayBuffer();
  const doc: PdfJs.PDFDocumentProxy = await pdfjsLib.getDocument({ data: buffer }).promise;

  const lines: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    let currentY: number | null = null;
    let currentLine: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (currentY !== null && Math.abs(y - currentY) > 2) {
        lines.push(currentLine.join(" ").trim());
        currentLine = [];
      }
      currentY = y;
      if (item.str.trim()) currentLine.push(item.str);
    }
    if (currentLine.length) lines.push(currentLine.join(" ").trim());
  }

  return lines.filter(Boolean);
}
