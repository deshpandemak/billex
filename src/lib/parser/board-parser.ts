export interface ParsedBoardEntry {
  boardDate: string;
  boardType: string;
  srNo: number;
  caseType: string;
  caseNo: string;
  caseYear: string;
  fullCaseNumber: string;
  partyName: string;
  remarks: string;
  gpAdvocate: string;
  courtName: string;
  benchId: string;
  linkedCases: string[];
}

const CASE_NUMBER_REGEX = /^(\d+)\s+((?:WP|PIL|CP|IA|CAW|LPA|RPW|CRR|FA|CAF|CAL|XOB|CAI|SMPIL)(?:\(ST\))?)\/([\d]+)\/([\d]{4})/;

const WITH_CASE_REGEX = /WITH\s+((?:WP|PIL|CP|IA|CAW|LPA|RPW|CRR|FA|CAF|CAL|XOB|CAI|SMPIL)(?:\(ST\))?\/[\d]+\/[\d]{4})/g;

const IN_CASE_REGEX = /IN\s+((?:WP|PIL|CP|IA|CAW|LPA|RPW|CRR|FA|CAF|CAL|XOB|CAI|SMPIL)(?:\(ST\))?\/[\d]+\/[\d]{4})/;

const DATE_REGEX = /(?:DAILY\s+(?:MAIN|SUPPLEMENTARY)|WEEKLY\s+MAIN)\s+(\d{2}\/\d{2}\/\d{4})/;

const BOARD_TYPE_REGEX = /(DAILY\s+(?:MAIN|SUPPLEMENTARY)|WEEKLY\s+MAIN(?:\s*-\s*\d+)?)/;

const SECTION_HEADER_REGEX = /^\*\s+(.+?)\s+\*$/;

const COURT_REGEX = /IN THE COURT OF HON'BLE\s+(.+?)$/;

const BENCH_ID_REGEX = /Bench\s+ID:\s*(\d+)/;

const GP_PATTERNS = [
  /SMT\.?\s*NEHA\.?\s*S\.?\s*BHIDE\s*,?\s*GP/i,
  /GP\b/i,
  /ADDL?\.?\s*GP/i,
  /AGP/i,
  /ADDIL?\.?\s*GP/i,
];

function extractGpAdvocate(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.join(" | ");
}

function splitCaseNumber(fullCase: string): { caseType: string; caseNo: string; caseYear: string } {
  const match = fullCase.match(/^((?:WP|PIL|CP|IA|CAW|LPA|RPW|CRR|FA|CAF|CAL|XOB|CAI|SMPIL)(?:\(ST\))?)\/([\d]+)\/([\d]{4})$/);
  if (match) {
    return { caseType: match[1], caseNo: match[2], caseYear: match[3] };
  }
  return { caseType: "", caseNo: "", caseYear: "" };
}

export function parseBoardPdf(text: string, sourceFile: string): ParsedBoardEntry[] {
  const entries: ParsedBoardEntry[] = [];
  const lines = text.split("\n");

  let currentDate = "";
  let currentBoardType = "";
  let currentCourt = "";
  let currentBenchId = "";
  let currentSection = "";

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    const dateMatch = line.match(DATE_REGEX);
    if (dateMatch) {
      const rawDate = dateMatch[1];
      const [dd, mm, yyyy] = rawDate.split("/");
      currentDate = `${yyyy}-${mm}-${dd}`;
      const boardTypeMatch = line.match(BOARD_TYPE_REGEX);
      if (boardTypeMatch) {
        currentBoardType = boardTypeMatch[1].trim();
      }
      i++;
      continue;
    }

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

    const benchMatch = line.match(BENCH_ID_REGEX);
    if (benchMatch) {
      currentBenchId = benchMatch[1];
      i++;
      continue;
    }

    const sectionMatch = line.match(SECTION_HEADER_REGEX);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      i++;
      continue;
    }

    const caseMatch = line.match(CASE_NUMBER_REGEX);
    if (caseMatch && currentDate) {
      const srNo = parseInt(caseMatch[1], 10);
      const caseType = caseMatch[2];
      const caseNo = caseMatch[3];
      const caseYear = caseMatch[4];
      const fullCaseNumber = `${caseType}/${caseNo}/${caseYear}`;

      const afterCase = line.substring(line.indexOf(fullCaseNumber) + fullCaseNumber.length).trim();

      let partyName = "";
      let resAdvocateText = "";

      const gpIndex = afterCase.search(/\b(?:SMT|SHRI|MS|DR)\b\.?/i);
      if (gpIndex > 0) {
        partyName = afterCase.substring(0, gpIndex).trim();
        resAdvocateText = afterCase.substring(gpIndex).trim();
      } else if (gpIndex === 0) {
        resAdvocateText = afterCase.trim();
      } else {
        partyName = afterCase.trim();
      }

      const linkedCases: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (!nextLine) { j++; continue; }
        if (nextLine.match(CASE_NUMBER_REGEX)) break;
        if (nextLine.match(SECTION_HEADER_REGEX)) break;
        if (nextLine.match(COURT_REGEX)) break;
        if (nextLine.match(DATE_REGEX)) break;
        if (nextLine.match(BENCH_ID_REGEX)) break;
        if (nextLine.startsWith("Page:") || nextLine.startsWith("C.R.") || nextLine.startsWith("Sr.") || nextLine.startsWith("HEADER NOTE") || nextLine.startsWith("---")) break;

        if (nextLine.startsWith("WITH ") || nextLine.startsWith("IN ")) {
          const withMatches = [...nextLine.matchAll(/(?:WP|PIL|CP|IA|CAW|LPA|RPW|CRR|FA|CAF|CAL|XOB|CAI|SMPIL)(?:\(ST\))?\/([\d]+)\/([\d]{4})/g)];
          withMatches.forEach((m) => linkedCases.push(m[0]));

          const gpPart = nextLine.replace(/(?:WITH|IN)\s+(?:(?:WP|PIL|CP|IA|CAW|LPA|RPW|CRR|FA|CAF|CAL|XOB|CAI|SMPIL)(?:\(ST\))?\/([\d]+)\/([\d]{4})\s*)*/g, "").trim();
          if (gpPart && gpPart.match(/\b(?:SMT|SHRI|MS|DR|AGP|GP|ADDL|ADDIL)\b/i)) {
            resAdvocateText += " " + gpPart;
          }
        } else if (nextLine.match(/\b(?:SMT|SHRI|MS|DR)\b\.?/i)) {
          resAdvocateText += " " + nextLine;
        } else {
          const caseRefs = [...nextLine.matchAll(/(?:WP|PIL|CP|IA|CAW|LPA|RPW|CRR|FA|CAF|CAL|XOB|CAI|SMPIL)(?:\(ST\))?\/([\d]+)\/([\d]{4})/g)];
          if (caseRefs.length > 0) {
            caseRefs.forEach((m) => linkedCases.push(m[0]));
          }
        }
        j++;
      }

      partyName = partyName.replace(/\s+/g, " ").trim();
      if (partyName.endsWith(",")) partyName = partyName.slice(0, -1).trim();

      entries.push({
        boardDate: currentDate,
        boardType: currentBoardType,
        srNo,
        caseType,
        caseNo,
        caseYear,
        fullCaseNumber,
        partyName,
        remarks: currentSection,
        gpAdvocate: resAdvocateText.replace(/\s+/g, " ").trim(),
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
