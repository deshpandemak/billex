import { describe, it, expect } from "vitest";
import { parseBoardPdf } from "@/lib/parser/board-parser";

const DAILY_MAIN_HEADER = `IN THE COURT OF HON'BLE THE CHIEF JUSTICE
AND HON'BLESHRI JUSTICE GAUTAM A. ANKHAD
Page: 1 APPELLATE SIDE - DAILY MAIN 02/12/2025
C.R. No: 46 , , Bench ID: 5822`;

describe("parseBoardPdf", () => {
  describe("date extraction", () => {
    it("extracts board date from DAILY MAIN header", () => {
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
  });

  describe("case number parsing", () => {
    it("parses WP case type", () => {
      const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].caseType).toBe("WP");
      expect(entries[0].caseNo).toBe("15299");
      expect(entries[0].caseYear).toBe("2025");
      expect(entries[0].fullCaseNumber).toBe("WP/15299/2025");
    });

    it("parses PIL case type", () => {
      const text = `${DAILY_MAIN_HEADER}
* DUE ADMISSION - 1 *
----------------------
56 PIL/25/2025 Vijay Kurle SMT. NEHA BHIDE, GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].caseType).toBe("PIL");
      expect(entries[0].caseNo).toBe("25");
    });

    it("parses PIL(ST) case type", () => {
      const text = `${DAILY_MAIN_HEADER}
* DUE ADMISSION - 1 *
----------------------
17 PIL(ST)/95657/2020 NITIN PADMAKAR DESHPANDE SMT. NEHA S. BHIDE GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].caseType).toBe("PIL(ST)");
      expect(entries[0].caseNo).toBe("95657");
      expect(entries[0].caseYear).toBe("2020");
    });

    it("parses CP case type with IN reference", () => {
      const text = `${DAILY_MAIN_HEADER}
* DUE ADMISSION - 1 *
----------------------
22 CP/688/2025 SACHIN ULHAS DHAKEPHALKAR SMT. NEHA S. BHIDE GP
IN WP/13177/2022 WITH SHRI. A. A. ALASPURKAR, AGP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].caseType).toBe("CP");
      expect(entries[0].fullCaseNumber).toBe("CP/688/2025");
    });

    it("parses IA case type", () => {
      const text = `${DAILY_MAIN_HEADER}
* INTERIM APPLICATION *
-----------------------
53 IA/38423/2025 ULSHAH SMT.NEHA.S.BHIDE,GP
IN WP/11231/2014 WITH SHRI.S.H.KANKAL,AGP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].caseType).toBe("IA");
      expect(entries[0].caseNo).toBe("38423");
    });

    it("parses WP(ST) case type", () => {
      const text = `${DAILY_MAIN_HEADER}
* FOR ADMISSION *
------------------
20 WP(ST)/12078/2025 VAIDYA MAHADU BHAGVAT SMT.R.A.SALUNKHE,AGP N/S`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].caseType).toBe("WP(ST)");
    });

    it("parses LPA case type", () => {
      const text = `${DAILY_MAIN_HEADER}
* FOR HEARING *
---------------
401 LPA/151/2009 MR. BHAVESH PARMAR MS.KAVITA N. SOLUNKE,ADDIL.GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].caseType).toBe("LPA");
    });
  });

  describe("party name extraction", () => {
    it("extracts petitioner advocate name", () => {
      const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].partyName).toBe("Pooja A Dongre");
    });

    it("extracts uppercase party name", () => {
      const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
18 WP/6352/2021 PRATHAMESH B BHARGUDE SMT. NEHA S. BHIDE GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].partyName).toBe("PRATHAMESH B BHARGUDE");
    });
  });

  describe("section/remarks extraction", () => {
    it("captures HIGH ON BOARD section", () => {
      const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].remarks).toBe("HIGH ON BOARD (HOB)");
    });

    it("captures DUE ADMISSION section", () => {
      const text = `${DAILY_MAIN_HEADER}
* DUE ADMISSION - 1 *
----------------------
17 PIL(ST)/95657/2020 NITIN PADMAKAR DESHPANDE SMT. NEHA S. BHIDE GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].remarks).toBe("DUE ADMISSION - 1");
    });

    it("captures FRESH ADMISSION section", () => {
      const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
19 WP/5206/2025 Minal Chandnani SHRI.V.G.BADGUJAR,AGP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].remarks).toBe("FRESH ADMISSION");
    });

    it("captures time-based section headers", () => {
      const text = `${DAILY_MAIN_HEADER}
* AT 12.30 P.M. *
-----------------
49 WP/14907/2022 Sumit S Kate SMT. NEHA S. BHIDE GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].remarks).toBe("AT 12.30 P.M.");
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

  describe("GP/advocate extraction", () => {
    it("extracts single GP advocate", () => {
      const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
19 WP/5206/2025 Minal Chandnani SHRI.V.G.BADGUJAR,AGP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].gpAdvocate).toContain("SHRI.V.G.BADGUJAR,AGP");
    });

    it("extracts multiple advocates across lines", () => {
      const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP
WITH SHRI.O.A.CHANDURKAR, ADDIL.GP.
WITH SHRI. V.G. BADGUJAR, AGP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].gpAdvocate).toContain("NEHA S. BHIDE");
      expect(entries[0].gpAdvocate).toContain("CHANDURKAR");
      expect(entries[0].gpAdvocate).toContain("BADGUJAR");
    });
  });

  describe("linked cases", () => {
    it("extracts WITH linked cases", () => {
      const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP
WITH WP/11880/2025 WITH SHRI.O.A.CHANDURKAR, ADDIL.GP.`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].linkedCases).toContain("WP/11880/2025");
    });

    it("extracts multiple linked cases", () => {
      const text = `${DAILY_MAIN_HEADER}
* AT 12.30 P.M. *
-----------------
49 WP/14907/2022 Sumit S Kate SMT. NEHA S. BHIDE GP
WITH IA/10138/2024 IA/7889/2023 WP/6994/2023 WITH SHRI.O.A.CHANDURKAR, ADDIL.GP.`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].linkedCases).toContain("IA/10138/2024");
      expect(entries[0].linkedCases).toContain("IA/7889/2023");
      expect(entries[0].linkedCases).toContain("WP/6994/2023");
    });
  });

  describe("serial number", () => {
    it("parses serial number correctly", () => {
      const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
49 WP/14907/2022 Sumit S Kate SMT. NEHA S. BHIDE GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].srNo).toBe(49);
    });

    it("handles high serial numbers from supplementary boards", () => {
      const text = `Page: 1 APPELLATE SIDE - DAILY SUPPLEMENTARY 19/12/2025
C.R. No: 46 , , Bench ID: 5822
* FOR CIRCULATION *
-------------------
904 WP/17271/2025 Rohit D Joshi SMT. NEHA S. BHIDE, GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].srNo).toBe(904);
    });
  });

  describe("court and bench extraction", () => {
    it("extracts court name", () => {
      const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].courtName).toContain("CHIEF JUSTICE");
    });

    it("extracts bench ID", () => {
      const text = `${DAILY_MAIN_HEADER}
* HIGH ON BOARD (HOB) *
-----------------------
4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].benchId).toBe("5822");
    });
  });

  describe("multi-court board", () => {
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
  });

  describe("edge cases", () => {
    it("returns empty array for empty text", () => {
      const entries = parseBoardPdf("", "test.pdf");
      expect(entries).toEqual([]);
    });

    it("returns empty array for text without case entries", () => {
      const text = `Some random text
without any case numbers
or board structure`;
      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries).toEqual([]);
    });

    it("ignores entries before a date is found", () => {
      const text = `4 WP/15299/2025 Pooja A Dongre SMT. NEHA S. BHIDE GP`;
      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries).toEqual([]);
    });

    it("handles N/S (not served) entries", () => {
      const text = `${DAILY_MAIN_HEADER}
* FRESH ADMISSION *
-------------------
22 WP/15960/2025 Chaitanya Nikte N/S`;

      const entries = parseBoardPdf(text, "test.pdf");
      expect(entries[0].partyName).toBe("Chaitanya Nikte N/S");
    });
  });
});
