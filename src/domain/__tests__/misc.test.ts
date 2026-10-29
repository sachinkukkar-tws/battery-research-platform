import { amplifiPaperId, extractCitationIds, libraryPaperId, splitCitedText } from "../citations";
import { formulaParts } from "../chemistry";
import { validatePdf } from "../upload";
import { filterLibrary, DEFAULT_LIBRARY_FILTERS } from "../library";
import { MOCK_LIBRARY } from "@/data/mockData";

describe("citations", () => {
  it("splits text around citation markers", () => {
    expect(splitCitedText("A [CP07] and [I2].")).toEqual([
      { kind: "text", text: "A " },
      { kind: "cite", paperId: "CP07" },
      { kind: "text", text: " and " },
      { kind: "cite", paperId: "I2" },
      { kind: "text", text: "." },
    ]);
    expect(extractCitationIds("[C12] [C12] [N1]")).toEqual(["C12", "N1"]);
  });

  it("reads citations that have extra words, several IDs or a file name inside the brackets", () => {
    const text = "A [CP01, laboratory measurement], [CP02; lab study], [CP03, CP04], [CP05_Huang_2026.pdf] and [lab study; client paper].";
    expect(extractCitationIds(text)).toEqual(["CP01", "CP02", "CP03", "CP04", "CP05"]);
    expect(splitCitedText("94.8% [CP01, laboratory measurement].")).toEqual([
      { kind: "text", text: "94.8% " },
      { kind: "cite", paperId: "CP01" },
      { kind: "text", text: " (laboratory measurement)" },
      { kind: "text", text: "." },
    ]);
  });

  it("treats Amplifi's zero-padded C01 to C09 as the library's C1 to C9", () => {
    expect(extractCitationIds("[C01] [C01_Edge_2021.pdf, p. 3] [C10, C02] [CP01]")).toEqual(["C1", "C10", "C2", "CP01"]);
    expect(["C1", "C9", "C10", "CP01", "N1"].map(amplifiPaperId)).toEqual(["C01", "C09", "C10", "CP01", "N1"]);
    expect(["C01", "C10", "CP01"].map(libraryPaperId)).toEqual(["C1", "C10", "CP01"]);
  });
});

describe("chemical formulae", () => {
  it("subscripts digits after letters and brackets only", () => {
    const parts = formulaParts("Na3V2(PO4)3");
    expect(parts.filter((p) => p.sub).map((p) => p.text)).toEqual(["3", "2", "4", "3"]);
  });
});

describe("PDF validation", () => {
  const MB = 1024 * 1024;
  it("accepts PDFs within the limit, including a blank MIME type", () => {
    expect(validatePdf({ name: "a.pdf", size: MB, type: "application/pdf" }, 50 * MB).ok).toBe(true);
    expect(validatePdf({ name: "a.PDF", size: MB, type: "" }, 50 * MB).ok).toBe(true);
  });
  it("rejects other types, empty files and oversized files with a reason", () => {
    expect(validatePdf({ name: "a.docx", size: MB, type: "" }, 50 * MB)).toMatchObject({ ok: false, reason: expect.stringMatching(/isn’t a PDF/) });
    expect(validatePdf({ name: "a.pdf", size: MB, type: "text/html" }, 50 * MB).ok).toBe(false);
    expect(validatePdf({ name: "a.pdf", size: 0, type: "application/pdf" }, 50 * MB)).toMatchObject({ ok: false, reason: expect.stringMatching(/empty/) });
    expect(validatePdf({ name: "a.pdf", size: 60 * MB, type: "application/pdf" }, 50 * MB)).toMatchObject({ ok: false, reason: expect.stringMatching(/limit is 50\.0 MB/) });
  });
});

describe("library filtering", () => {
  it("searches ID, authors and title case-insensitively", () => {
    expect(filterLibrary(MOCK_LIBRARY, { ...DEFAULT_LIBRARY_FILTERS, query: "severson" }).map((p) => p.id)).toEqual(["C2"]);
    expect(filterLibrary(MOCK_LIBRARY, { ...DEFAULT_LIBRARY_FILTERS, status: "Extracted" }).map((p) => p.id)).toEqual(["CP02"]);
  });
});
