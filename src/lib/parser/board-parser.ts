export interface ParsedBoardEntry {
  boardDate: string;
  boardType: string;
  srNo: number;
  caseType: string;
  caseNo: string;
  caseYear: string;
  fullCaseNumber: string;
  /** Petitioner advocate name (column 3 of the board — not the litigant party name) */
  partyName: string;
  /** Section header at the time of this entry (e.g. "FRESH ADMISSION") */
  remarks: string;
  /** All pleader names for this matter: GP / AGP / Addl GP / B'PNL — may span multiple lines */
  gpAdvocate: string;
  courtName: string;
  benchId: string;
  linkedCases: string[];
}

// Accepts any case type: 2–8 uppercase letters with optional parenthetical suffix like (ST), (DB)
const CASE_NUMBER_REGEX = /^(\d+)\s+([A-Z]{2,8}(?:\([A-Z]+\))?)\/([\d]+)\/([\d]{4})/;

// Match case references in continuation lines (same flexible case-type pattern)
const CASE_REF_REGEX = /([A-Z]{2,8}(?:\([A-Z]+\))?)\/([\d]+)\/([\d]{4})/g;

// Match various Bombay HC board header formats that include the date:
//   Page: 1    APPELLATE SIDE - DAILY MAIN              08/05/2026
//   APPELLATE SIDE - DAILY SUPPLEMENTARY 19/12/2025
//   WEEKLY MAIN - 1 18/12/2025
//   SUPPLY BOARD DT 05/05/2026
//   BOARD DT 05/05/2026
const DATE_REGEX =
  /(?:DAILY\s+(?:MAIN|SUPPLEMENTARY)|WEEKLY\s+MAIN(?:\s*-\s*\d+)?|SUPPLY\s+BOARD(?:\s+DT)?|BOARD(?:\s+DT)?)\s+(\d{2}\/\d{2}\/\d{4})/;

// Fallback: any DD/MM/YYYY date when the header pattern above doesn't match
const ANY_DATE_REGEX = /\b(\d{2}\/\d{2}\/\d{4})\b/;

const BOARD_TYPE_REGEX =
  /(DAILY\s+(?:MAIN|SUPPLEMENTARY)|WEEKLY\s+MAIN(?:\s*-\s*\d+)?|SUPPLY\s+BOARD(?:\s+DT)?|BOARD(?:\s+DT)?)/;

// Section headers appear as either:
//   * FRESH ADMISSION *               (old format, line ends with *)
//   * DUE ADMISSION  - 1 * --------- (actual PDF: dashes follow on the same line)
// The $ anchor is intentionally absent — we stop at the FIRST closing * and ignore trailing content.
const SECTION_HEADER_REGEX = /^\*\s+(.+?)\s+\*/;

const COURT_REGEX = /IN THE COURT OF HON'BLE\s+(.+?)$/;

const BENCH_ID_REGEX = /Bench\s+ID:\s*(\d+)/;

// Advocate title prefixes (optionally followed by a dot)
const TITLE_REGEX_G = /\b(?:SMT|SHRI|MS|DR|MR)\.?/gi;

// GP designations — with or without a leading comma, with or without ADDL/ADDIL prefix.
// Must be a whole word so "NAGPUR" doesn't match "GP" inside it.
const GP_DESIGNATION_REGEX = /\b(?:ADDIL?\.?\s*|ADDL\.?\s*)?(?:GP|AGP|B['`]PNL)\b/i;

function parseDate(raw: string): string {
  const [dd, mm, yyyy] = raw.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Split the text after the case number into petitioner advocate and respondent advocate.
 *
 * Algorithm:
 *  1. Find the first GP designation (GP / AGP / ADDL GP / B'PNL) in the text.
 *  2. Scan backwards through the text up to that point for the LAST advocate title
 *     (SMT / SHRI / MS / DR / MR). That title marks where the respondent section begins.
 *  3. If no title is found, fall back to double-space splitting (PDF column separator).
 *  4. If neither applies, treat everything as the petitioner name.
 */
function splitAdvocates(afterCase: string): { partyName: string; resAdvocateText: string } {
  const gpMatch = afterCase.match(GP_DESIGNATION_REGEX);

  if (!gpMatch || gpMatch.index === undefined) {
    // No GP designation — the whole text is the petitioner advocate (or N/S)
    return { partyName: afterCase.trim(), resAdvocateText: "" };
  }

  // Text from the start up to and including the GP designation
  const scopeText = afterCase.substring(0, gpMatch.index + gpMatch[0].length);

  // Find the LAST advocate title within that scope
  let lastTitleIdx = -1;
  const titlePattern = new RegExp(TITLE_REGEX_G.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = titlePattern.exec(scopeText)) !== null) {
    lastTitleIdx = m.index;
  }

  if (lastTitleIdx > 0) {
    return {
      partyName: afterCase.substring(0, lastTitleIdx).trim(),
      resAdvocateText: afterCase.substring(lastTitleIdx).trim(),
    };
  }

  if (lastTitleIdx === 0) {
    // The entire text starts with a title — whole string is respondent
    return { partyName: "", resAdvocateText: afterCase.trim() };
  }

  // No title found — try double-space (PDF column separator)
  const doubleSpaceIdx = afterCase.lastIndexOf("  ", gpMatch.index);
  if (doubleSpaceIdx > 0) {
    return {
      partyName: afterCase.substring(0, doubleSpaceIdx).trim(),
      resAdvocateText: afterCase.substring(doubleSpaceIdx).trim(),
    };
  }

  // Cannot determine split — treat everything as petitioner
  return { partyName: afterCase.trim(), resAdvocateText: "" };
}

export function parseBoardPdf(text: string, sourceFile: string): ParsedBoardEntry[] {
  const entries: ParsedBoardEntry[] = [];
  const lines = text.split("\n");

  let currentDate = "";
  let currentBoardType = "";
  let currentCourt = "";
  let currentBenchId = "";
  let currentSection = "";
  let fallbackDateSearchDone = false;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // ── Date / board type ────────────────────────────────────────────────────
    const dateMatch = line.match(DATE_REGEX);
    if (dateMatch) {
      currentDate = parseDate(dateMatch[1]);
      const btMatch = line.match(BOARD_TYPE_REGEX);
      if (btMatch) currentBoardType = btMatch[1].trim();
      i++;
      continue;
    }

    // Fallback: scan first 30 lines for any DD/MM/YYYY date if header not matched yet
    if (!currentDate && !fallbackDateSearchDone) {
      if (i >= 30) {
        fallbackDateSearchDone = true;
      } else {
        const anyDate = line.match(ANY_DATE_REGEX);
        if (anyDate) {
          currentDate = parseDate(anyDate[1]);
          const btMatch = line.match(BOARD_TYPE_REGEX);
          if (btMatch) currentBoardType = btMatch[1].trim();
        }
      }
    }

    // ── Court heading ────────────────────────────────────────────────────────
    const courtMatch = line.match(COURT_REGEX);
    if (courtMatch) {
      currentCourt = courtMatch[1].trim();
      i++;
      if (i < lines.length) {
        const nextLine = lines[i].trim();
        if (nextLine.startsWith("AND HON'BLE")) {
          currentCourt += " " + nextLine;
          i++;
        }
      }
      continue;
    }

    // ── Bench ID ─────────────────────────────────────────────────────────────
    const benchMatch = line.match(BENCH_ID_REGEX);
    if (benchMatch) {
      currentBenchId = benchMatch[1];
      i++;
      continue;
    }

    // ── Section header (e.g. * FRESH ADMISSION *) ────────────────────────────
    const sectionMatch = line.match(SECTION_HEADER_REGEX);
    if (sectionMatch) {
      // Collapse multiple spaces that PDF extraction preserves from the original layout
      currentSection = sectionMatch[1].trim().replace(/\s+/g, " ");
      i++;
      continue;
    }

    // ── Case entry ───────────────────────────────────────────────────────────
    const caseMatch = line.match(CASE_NUMBER_REGEX);
    if (caseMatch && currentDate) {
      const srNo = parseInt(caseMatch[1], 10);
      const caseType = caseMatch[2];
      const caseNo = caseMatch[3];
      const caseYear = caseMatch[4];
      const fullCaseNumber = `${caseType}/${caseNo}/${caseYear}`;

      const afterCase = line.substring(line.indexOf(fullCaseNumber) + fullCaseNumber.length).trim();
      const { partyName, resAdvocateText } = splitAdvocates(afterCase);

      const linkedCases: string[] = [];
      let extraRes = resAdvocateText;

      // Process continuation lines (WITH / IN and standalone advocate lines)
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (!nextLine) { j++; continue; }

        // Stop on lines that begin a new section, entry, or page
        if (nextLine.match(CASE_NUMBER_REGEX)) break;
        if (nextLine.match(SECTION_HEADER_REGEX)) break;
        if (nextLine.match(COURT_REGEX)) break;
        if (nextLine.match(DATE_REGEX)) break;
        if (nextLine.match(BENCH_ID_REGEX)) break;
        if (
          nextLine.startsWith("Page:") ||
          nextLine.startsWith("C.R.") ||
          nextLine.startsWith("Sr.") ||
          nextLine.startsWith("HEADER NOTE") ||
          nextLine.startsWith("---") ||
          nextLine.startsWith("***")
        ) break;

        if (nextLine.startsWith("WITH ") || nextLine.startsWith("IN ")) {
          // Extract linked case references
          const refs = [...nextLine.matchAll(CASE_REF_REGEX)];
          refs.forEach((r) => linkedCases.push(r[0]));

          // Remove structural keywords (WITH / IN) and case refs; keep advocate text.
          // Example: "IN WP/9693/2025  WITH SMT.A.A.NADKARNI,AGP"
          //   → strip leading "IN "  → "WP/9693/2025  WITH SMT.A.A.NADKARNI,AGP"
          //   → strip case refs     → "  WITH SMT.A.A.NADKARNI,AGP"
          //   → strip remaining WITH→ "  SMT.A.A.NADKARNI,AGP"
          //   → trim               → "SMT.A.A.NADKARNI,AGP"
          const stripped = nextLine
            .replace(/^(?:WITH|IN)\s+/, "")
            .replace(CASE_REF_REGEX, "")
            .replace(/\bWITH\s+/g, " ")
            .trim();

          if (
            stripped &&
            (stripped.match(TITLE_REGEX_G) ||
              stripped.match(/\b(?:AGP|GP|ADDL|ADDIL|B['`]PNL)\b/i))
          ) {
            extraRes += " " + stripped;
          }
        } else if (
          nextLine.match(TITLE_REGEX_G) ||
          nextLine.match(/\b(?:AGP|GP|ADDL|ADDIL|B['`]PNL)\b/i)
        ) {
          // Standalone advocate continuation line
          extraRes += " " + nextLine;
        }
        j++;
      }

      entries.push({
        boardDate: currentDate,
        boardType: currentBoardType,
        srNo,
        caseType,
        caseNo,
        caseYear,
        fullCaseNumber,
        partyName: partyName.replace(/\s+/g, " ").replace(/,$/, "").trim(),
        remarks: currentSection,
        gpAdvocate: extraRes.replace(/\s+/g, " ").trim(),
        courtName: currentCourt,
        benchId: currentBenchId,
        linkedCases: [...new Set(linkedCases)],
      });

      i = j;
      continue;
    }

    i++;
  }

  return entries;
}
