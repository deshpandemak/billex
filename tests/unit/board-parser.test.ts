import { describe, it, expect } from "vitest";
import { parseBoardPdf } from "@/lib/parser/board-parser";

// ──────────────────────────────────────────────────────────────────────────────
// Shared header snippets
// ──────────────────────────────────────────────────────────────────────────────

const DAILY_MAIN_HEADER = `IN THE COURT OF HON'BLE THE CHIEF JUSTICE
AND HON'BLESHRI JUSTICE GAUTAM A. ANKHAD
Page: 1 APPELLATE SIDE - DAILY MAIN 02/12/2025
C.R. No: 46 , , Bench ID: 5822`;

const DAILY_MAIN_MAY = `IN THE COURT OF HON'BLE THE CHIEF JUSTICE
AND HON'BLESHRI JUSTICE GAUTAM A. ANKHAD
Page: 1 APPELLATE SIDE - DAILY MAIN 05/05/2026
C.R. No: 46 , , Bench ID: 5822`;

// ──────────────────────────────────────────────────────────────────────────────
// Date extraction
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — date extraction", () => {
  it("extracts date from DAILY MAIN header", () => {
    const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries[0].boardDate).toBe("2025-12-02");
  });

  it("extracts date from DAILY SUPPLEMENTARY header", () => {
    const text = `Page: 1 APPELLATE SIDE - DAILY SUPPLEMENTARY 19/12/2025
C.R. No: 46 , , Bench ID: 5822
* FOR CIRCULATION *
-------------------
904 WP/17271/2025 Rohit D Joshi SMT. NEHA S. BHIDE, GP`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries[0].boardDate).toBe("2025-12-19");
  });

  it("extracts date from WEEKLY MAIN header", () => {
    const text = `Page: 1 APPELLATE SIDE - WEEKLY MAIN - 1 18/12/2025
C.R. No: 40 , , Bench ID: 5758
* PART-HEARD *
--------------
201 WP/12107/2022 SATYAJEET A RAJESHIRKE SHRI.V.G.BADGUJAR,AGP`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries[0].boardDate).toBe("2025-12-18");
  });

  it("extracts date from SUPPLY BOARD DT header", () => {
    const text = `Page: 1 APPELLATE SIDE - SUPPLY BOARD DT 05/05/2026
C.R. No: 46 , , Bench ID: 5822
* FOR CIRCULATION *
-------------------
901 WP/5100/2026 SOME ADVOCATE SMT. NEHA S. BHIDE, GP`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries[0].boardDate).toBe("2026-05-05");
  });

  it("extracts date from SUPPLY BOARD header (without DT)", () => {
    const text = `Page: 1 APPELLATE SIDE - SUPPLY BOARD 05/05/2026
C.R. No: 46 , , Bench ID: 5822
* FOR DISPOSAL *
----------------
902 PIL/168/2022 LAW GLOBAL ADVOCATES SMT.NEHA.S.BHIDE,GP`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries[0].boardDate).toBe("2026-05-05");
    expect(entries[0].boardType).toBe("SUPPLY BOARD");
  });

  it("extracts date from SUPPLY BOARD DT. header with period after DT and dot-separated date", () => {
    const text = `Page: 1 APPELLATE SIDE - SUPPLY BOARD DT. 07.05.2026
C.R. No: 46 , , Bench ID: 5916
* FOR HEARING *
---------------
12 WP/4292/2026 Vishal Jain SMT. NEHA BHIDE, GP`;

    const entries = parseBoardPdf(text, "SUPPLY BOARD DT. 07.05.2026 copy.pdf");
    expect(entries).toHaveLength(1);
    expect(entries[0].boardDate).toBe("2026-05-07");
    expect(entries[0].boardType).toBe("SUPPLY BOARD DT.");
  });

  it("falls back to dot-separated DD.MM.YYYY date when no board-type header matches", () => {
    const text = `HIGH COURT OF BOMBAY
APPELLATE SIDE
Date: 03.03.2026
Court Room No: 46

* FOR DISPOSAL *
----------------
5 WP/1234/2024 SOME ADVOCATE SMT. NEHA S. BHIDE, GP`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries[0].boardDate).toBe("2026-03-03");
  });

  it("falls back to any DD/MM/YYYY date in first 30 lines when no board-type header found", () => {
    const text = `HIGH COURT OF BOMBAY
APPELLATE SIDE
Date: 03/03/2026
Court Room No: 46

* FOR DISPOSAL *
----------------
5 WP/1234/2024 SOME ADVOCATE SMT. NEHA S. BHIDE, GP`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries[0].boardDate).toBe("2026-03-03");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Case number parsing
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — case number parsing", () => {
  it("parses WP case type", () => {
    const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.caseType).toBe("WP");
    expect(e.caseNo).toBe("15299");
    expect(e.caseYear).toBe("2025");
    expect(e.fullCaseNumber).toBe("WP/15299/2025");
  });

  it("parses PIL case type", () => {
    const text = `${DAILY_MAIN_HEADER}
* DUE ADMISSION - 1 *
----------------------
56 PIL/25/2025 Vijay Kurle SMT. NEHA BHIDE, GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.caseType).toBe("PIL");
    expect(e.caseNo).toBe("25");
  });

  it("parses PIL(ST) case type", () => {
    const text = `${DAILY_MAIN_HEADER}
* DUE ADMISSION - 1 *
----------------------
17 PIL(ST)/95657/2020 NITIN PADMAKAR DESHPANDE SMT. NEHA S. BHIDE GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.caseType).toBe("PIL(ST)");
    expect(e.caseNo).toBe("95657");
    expect(e.caseYear).toBe("2020");
  });

  it("parses WP(ST) case type", () => {
    const text = `${DAILY_MAIN_HEADER}
* FOR ADMISSION *
------------------
20 WP(ST)/12078/2025 VAIDYA MAHADU BHAGVAT SMT.R.A.SALUNKHE,AGP N/S`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.caseType).toBe("WP(ST)");
  });

  it("parses LPA case type", () => {
    const text = `${DAILY_MAIN_HEADER}
* FOR HEARING *
---------------
401 LPA/151/2009 MR. BHAVESH PARMAR MS.KAVITA N. SOLUNKE,ADDIL.GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.caseType).toBe("LPA");
  });

  it("parses IA case type", () => {
    const text = `${DAILY_MAIN_HEADER}
* INTERIM APPLICATION *
-----------------------
53 IA/38423/2025 ULSHAH SMT.NEHA.S.BHIDE,GP
IN WP/11231/2014 WITH SHRI.S.H.KANKAL,AGP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.caseType).toBe("IA");
    expect(e.caseNo).toBe("38423");
  });

  it("parses CP case type", () => {
    const text = `${DAILY_MAIN_HEADER}
* DUE ADMISSION - 1 *
----------------------
22 CP/688/2025 SACHIN ULHAS DHAKEPHALKAR SMT. NEHA S. BHIDE GP
IN WP/13177/2022 WITH SHRI. A. A. ALASPURKAR, AGP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.caseType).toBe("CP");
    expect(e.fullCaseNumber).toBe("CP/688/2025");
  });

  it("parses CAW case type (not in previous fixed list, now accepted)", () => {
    const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
10 CAW/999/2026 ADVOCATE X SMT. NEHA S. BHIDE, GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.caseType).toBe("CAW");
    expect(e.caseNo).toBe("999");
  });

  it("parses RPW case type", () => {
    const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
7 RPW/200/2024 ADVOCATE Y SMT. NEHA S. BHIDE, GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.caseType).toBe("RPW");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Party name & GP advocate extraction
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — party name extraction", () => {
  it("extracts petitioner advocate name (mixed case)", () => {
    const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.partyName).toBe("Pooja A Dongre");
  });

  it("extracts uppercase petitioner advocate name", () => {
    const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
18 WP/6352/2021 PRATHAMESH B BHARGUDE SMT. NEHA S. BHIDE GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.partyName).toBe("PRATHAMESH B BHARGUDE");
  });

  it("extracts petitioner from sample format: LAW GLOBAL ADVOCATES SMT.NEHA.S.BHIDE,GP", () => {
    const text = `${DAILY_MAIN_MAY}
* FOR DISPOSAL *
----------------
3 PIL/168/2022 LAW GLOBAL ADVOCATES SMT.NEHA.S.BHIDE,GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.partyName).toBe("LAW GLOBAL ADVOCATES");
    expect(e.gpAdvocate).toContain("NEHA");
  });

  it("extracts petitioner from sample format: Advocate Hitesh Dabhi SMT.NEHA S. BHIDE , GP. N/S", () => {
    const text = `${DAILY_MAIN_MAY}
* FRESH ADMISSION *
-------------------
15 WP/5761/2026 Advocate Hitesh Dabhi SMT.NEHA S. BHIDE , GP. N/S`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.partyName).toBe("Advocate Hitesh Dabhi");
    expect(e.gpAdvocate).toMatch(/NEHA/);
  });

  it("handles N/S (not served) entries with no GP advocate", () => {
    const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
22 WP/15960/2025 Chaitanya Nikte N/S`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.partyName).toBe("Chaitanya Nikte N/S");
    expect(e.gpAdvocate).toBe("");
  });

  it("handles MR. petitioner advocate with MS. respondent", () => {
    const text = `${DAILY_MAIN_HEADER}
* FOR HEARING *
---------------
401 LPA/151/2009 MR. BHAVESH PARMAR MS.KAVITA N. SOLUNKE,ADDIL.GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.partyName).toBe("MR. BHAVESH PARMAR");
    expect(e.gpAdvocate).toContain("KAVITA");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Section / remarks
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — section/remarks extraction", () => {
  it("captures HIGH ON BOARD section", () => {
    const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.remarks).toBe("HIGH ON BOARD (HOB)");
  });

  it("captures DUE ADMISSION section", () => {
    const text = `${DAILY_MAIN_HEADER}
* DUE ADMISSION - 1 *
----------------------
17 PIL(ST)/95657/2020 NITIN PADMAKAR DESHPANDE SMT. NEHA S. BHIDE GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.remarks).toBe("DUE ADMISSION - 1");
  });

  it("captures FRESH ADMISSION section", () => {
    const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
19 WP/5206/2025 Minal Chandnani SHRI.V.G.BADGUJAR,AGP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.remarks).toBe("FRESH ADMISSION");
  });

  it("captures time-based section headers", () => {
    const text = `${DAILY_MAIN_HEADER}
* AT 12.30 P.M. *
-----------------
49 WP/14907/2022 Sumit S Kate SMT. NEHA S. BHIDE GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.remarks).toBe("AT 12.30 P.M.");
  });

  it("assigns correct section when multiple sections exist", () => {
    const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP
* DUE ADMISSION - 1 *
----------------------
17 PIL(ST)/95657/2020 NITIN PADMAKAR DESHPANDE SMT. NEHA S. BHIDE GP`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries[0].remarks).toBe("HIGH ON BOARD (HOB)");
    expect(entries[1].remarks).toBe("DUE ADMISSION - 1");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GP advocate extraction
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — GP advocate extraction", () => {
  it("extracts AGP advocate", () => {
    const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
19 WP/5206/2025 Minal Chandnani SHRI.V.G.BADGUJAR,AGP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.gpAdvocate).toContain("BADGUJAR");
  });

  it("extracts ADDIL.GP advocate", () => {
    const text = `${DAILY_MAIN_HEADER}
* FOR HEARING *
---------------
401 LPA/151/2009 MR. BHAVESH PARMAR MS.KAVITA N. SOLUNKE,ADDIL.GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.gpAdvocate).toContain("SOLUNKE");
  });

  it("captures advocates from WITH continuation lines (case refs)", () => {
    const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP
WITH WP/11880/2025 WITH SHRI.O.A.CHANDURKAR, ADDIL.GP.`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.gpAdvocate).toContain("NEHA");
    expect(e.gpAdvocate).toContain("CHANDURKAR");
  });

  it("captures advocate from WITH continuation line (advocate only, no case)", () => {
    const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
15 WP/5761/2026 Advocate Hitesh Dabhi SMT.NEHA S. BHIDE , GP. N/S
WITH SMT S D VYAS ADDL GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.gpAdvocate).toContain("VYAS");
  });

  it("captures advocate from plain continuation line (no WITH prefix)", () => {
    const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP
SHRI.O.A.CHANDURKAR, ADDIL.GP.`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.gpAdvocate).toContain("CHANDURKAR");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Linked cases
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — linked cases", () => {
  it("extracts WITH linked case", () => {
    const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP
WITH WP/11880/2025 WITH SHRI.O.A.CHANDURKAR, ADDIL.GP.`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.linkedCases).toContain("WP/11880/2025");
  });

  it("extracts multiple linked cases", () => {
    const text = `${DAILY_MAIN_HEADER}
* AT 12.30 P.M. *
-----------------
49 WP/14907/2022 Sumit S Kate SMT. NEHA S. BHIDE GP
WITH IA/10138/2024 IA/7889/2023 WP/6994/2023 WITH SHRI.O.A.CHANDURKAR, ADDIL.GP.`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.linkedCases).toContain("IA/10138/2024");
    expect(e.linkedCases).toContain("IA/7889/2023");
    expect(e.linkedCases).toContain("WP/6994/2023");
  });

  it("extracts IN linked case reference", () => {
    const text = `${DAILY_MAIN_HEADER}
* INTERIM APPLICATION *
-----------------------
53 IA/38423/2025 ULSHAH SMT.NEHA.S.BHIDE,GP
IN WP/11231/2014 WITH SHRI.S.H.KANKAL,AGP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.linkedCases).toContain("WP/11231/2014");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Serial numbers
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — serial numbers", () => {
  it("parses regular serial number", () => {
    const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
49 WP/14907/2022 Sumit S Kate SMT. NEHA S. BHIDE GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.srNo).toBe(49);
  });

  it("handles high serial numbers from supplementary boards (900s)", () => {
    const text = `Page: 1 APPELLATE SIDE - DAILY SUPPLEMENTARY 19/12/2025
C.R. No: 46 , , Bench ID: 5822
* FOR CIRCULATION *
-------------------
904 WP/17271/2025 Rohit D Joshi SMT. NEHA S. BHIDE, GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.srNo).toBe(904);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Court and bench extraction
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — court and bench", () => {
  it("extracts court name", () => {
    const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.courtName).toContain("CHIEF JUSTICE");
  });

  it("extracts bench ID", () => {
    const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

    const [e] = parseBoardPdf(text, "test.pdf");
    expect(e.benchId).toBe("5822");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Multi-court board
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — multi-court board", () => {
  it("tracks court changes within a single PDF", () => {
    const text = `IN THE COURT OF HON'BLE THE CHIEF JUSTICE
AND HON'BLESHRI JUSTICE GAUTAM A. ANKHAD
Page: 1 APPELLATE SIDE - DAILY MAIN 02/12/2025
C.R. No: 46 , , Bench ID: 5822
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP
IN THE COURT OF HON'BLE SHRI JUSTICE RAVINDRA V. GHUGE
AND HON'BLESHRI JUSTICE ASHWIN D. BHOBE
Page: 1 APPELLATE SIDE - DAILY MAIN 02/12/2025
C.R. No: 40 , , Bench ID: 5758
* AT 3.00 P.M. *
----------------
2 WP/8533/2025 Ranjana Todankar SMT. D. S. DESHMUKH, AGP.`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries).toHaveLength(2);
    expect(entries[0].courtName).toContain("CHIEF JUSTICE");
    expect(entries[0].benchId).toBe("5822");
    expect(entries[1].courtName).toContain("RAVINDRA V. GHUGE");
    expect(entries[1].benchId).toBe("5758");
  });

  it("parses all entries across multiple sections", () => {
    const text = `${DAILY_MAIN_MAY}
* FOR DISPOSAL *
----------------
3 PIL/168/2022 LAW GLOBAL ADVOCATES SMT.NEHA.S.BHIDE,GP
15 WP/5761/2026 Advocate Hitesh Dabhi SMT.NEHA S. BHIDE , GP. N/S
* FRESH ADMISSION *
-------------------
7 WP/100/2026 SOME ADVOCATE SMT. NEHA S. BHIDE, GP`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries).toHaveLength(3);
    expect(entries[0].srNo).toBe(3);
    expect(entries[1].srNo).toBe(15);
    expect(entries[2].srNo).toBe(7);
    expect(entries[2].remarks).toBe("FRESH ADMISSION");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Real PDF text format (actual extracted output from Bombay HC board)
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — real PDF text format", () => {
  // Verbatim text as it comes out of pdfjs text extraction:
  // - Multiple spaces between columns (PDF column layout preserved)
  // - Section header dashes on the same line as the * header *
  // - WITH continuation lines indented with leading spaces
  const REAL_FORMAT = `IN THE COURT OF HON'BLE THE CHIEF JUSTICE
AND HON'BLESHRI JUSTICE SUMAN SHYAM
Page: 1                    APPELLATE SIDE - DAILY MAIN              08/05/2026
C.R.  No: 46                  , ,  Bench ID: 5916

* DUE ADMISSION  - 1 * ----------------------

9    WP/4292/2026       Vishal Jain                      SMT. NEHA BHIDE, GP
       WITH SMT.S.D.VYAS,ADDL.GP
       WITH SMT. G. R. RAGHUWANSHI, AGP `;

  it("extracts board date from multi-space header", () => {
    const entries = parseBoardPdf(REAL_FORMAT, "board.pdf");
    expect(entries[0].boardDate).toBe("2026-05-08");
  });

  it("extracts board type from multi-space header", () => {
    const entries = parseBoardPdf(REAL_FORMAT, "board.pdf");
    expect(entries[0].boardType).toBe("DAILY MAIN");
  });

  it("extracts bench ID", () => {
    const entries = parseBoardPdf(REAL_FORMAT, "board.pdf");
    expect(entries[0].benchId).toBe("5916");
  });

  it("extracts section header with trailing dashes on same line", () => {
    const entries = parseBoardPdf(REAL_FORMAT, "board.pdf");
    // Double-space between ADMISSION and - should be collapsed to single space
    expect(entries[0].remarks).toBe("DUE ADMISSION - 1");
  });

  it("extracts serial number", () => {
    const entries = parseBoardPdf(REAL_FORMAT, "board.pdf");
    expect(entries[0].srNo).toBe(9);
  });

  it("extracts full case number", () => {
    const entries = parseBoardPdf(REAL_FORMAT, "board.pdf");
    expect(entries[0].fullCaseNumber).toBe("WP/4292/2026");
    expect(entries[0].caseType).toBe("WP");
    expect(entries[0].caseNo).toBe("4292");
    expect(entries[0].caseYear).toBe("2026");
  });

  it("extracts petitioner advocate name from wide-spaced column", () => {
    const entries = parseBoardPdf(REAL_FORMAT, "board.pdf");
    expect(entries[0].partyName).toBe("Vishal Jain");
  });

  it("captures all three pleaders from WITH continuation lines", () => {
    const entries = parseBoardPdf(REAL_FORMAT, "board.pdf");
    expect(entries[0].gpAdvocate).toContain("NEHA BHIDE");
    expect(entries[0].gpAdvocate).toContain("S.D.VYAS");
    expect(entries[0].gpAdvocate).toContain("RAGHUWANSHI");
  });

  it("captures designations for all three pleaders", () => {
    const entries = parseBoardPdf(REAL_FORMAT, "board.pdf");
    const gp = entries[0].gpAdvocate;
    expect(gp).toMatch(/GP/i);
    expect(gp).toMatch(/ADDL/i);
    expect(gp).toMatch(/AGP/i);
  });

  // ── IN <case-ref>  WITH <pleader> pattern ──────────────────────────────────
  // Real example: "IN WP/9693/2025       WITH SMT.A.A.NADKARNI,AGP"
  // The "WITH" keyword after the case ref must not appear in gpAdvocate.

  const IN_WITH_FORMAT = `${DAILY_MAIN_MAY}
* DUE ADMISSION - 1 *
----------------------
7    CP(ST)/12255/2026  SHAKIL AHMED                     SMT. K. N. SOLUNKE, ADDL. GP.
     IN WP/9693/2025       WITH SMT.A.A.NADKARNI,AGP `;

  it("parses CP(ST) case type", () => {
    const entries = parseBoardPdf(IN_WITH_FORMAT, "board.pdf");
    expect(entries[0].caseType).toBe("CP(ST)");
    expect(entries[0].caseNo).toBe("12255");
    expect(entries[0].caseYear).toBe("2026");
    expect(entries[0].fullCaseNumber).toBe("CP(ST)/12255/2026");
  });

  it("extracts petitioner advocate from CP(ST) entry", () => {
    const entries = parseBoardPdf(IN_WITH_FORMAT, "board.pdf");
    expect(entries[0].partyName).toBe("SHAKIL AHMED");
  });

  it("records the IN-linked related case", () => {
    const entries = parseBoardPdf(IN_WITH_FORMAT, "board.pdf");
    expect(entries[0].linkedCases).toContain("WP/9693/2025");
  });

  it("captures ADDL.GP pleader from main line", () => {
    const entries = parseBoardPdf(IN_WITH_FORMAT, "board.pdf");
    expect(entries[0].gpAdvocate).toContain("SOLUNKE");
    expect(entries[0].gpAdvocate).toContain("ADDL");
  });

  it("captures AGP pleader from IN...WITH continuation line without stray WITH keyword", () => {
    const entries = parseBoardPdf(IN_WITH_FORMAT, "board.pdf");
    expect(entries[0].gpAdvocate).toContain("NADKARNI");
    expect(entries[0].gpAdvocate).toContain("AGP");
    // "WITH" must not appear as a bare word in the gpAdvocate text
    expect(entries[0].gpAdvocate).not.toMatch(/\bWITH\b/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────────────────────────────────────

describe("parseBoardPdf — edge cases", () => {
  it("returns empty array for empty text", () => {
    expect(parseBoardPdf("", "test.pdf")).toEqual([]);
  });

  it("returns empty array for text without case entries", () => {
    const text = `Some random text
without any case numbers
or board structure`;
    expect(parseBoardPdf(text, "test.pdf")).toEqual([]);
  });

  it("ignores entries before a date is found", () => {
    // No date anywhere in the text — nothing parsed
    const text = `4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;
    expect(parseBoardPdf(text, "test.pdf")).toEqual([]);
  });

  it("does not parse entries that look like page headers", () => {
    const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
3 WP/100/2026 SOME ADVOCATE SMT. NEHA S. BHIDE, GP
Page: 2 APPELLATE SIDE - DAILY MAIN 05/05/2026
C.R. No: 46
5 WP/200/2026 OTHER ADVOCATE SMT. NEHA S. BHIDE, GP`;

    const entries = parseBoardPdf(text, "test.pdf");
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.every((e) => e.srNo !== undefined && e.caseType !== undefined)).toBe(true);
  });
});
