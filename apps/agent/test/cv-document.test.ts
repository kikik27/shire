import assert from "node:assert/strict";
import test from "node:test";

import {
  CvDocumentError,
  extractCvDocument,
} from "../src/runtime/cv/document";

const pdf = Buffer.from("%PDF-1.7\nfake");
const docx = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from("[Content_Types].xml word/document.xml"),
]);

test("extracts and sanitizes PDF text", async () => {
  const text = await extractCvDocument(
    { buffer: pdf, mimetype: "application/pdf", size: pdf.length },
    {
      maxFileBytes: 1024,
      extractPdf: async () => "Senior\u0000   Engineer",
      extractDocx: async () => "",
    },
  );

  assert.equal(text, "Senior Engineer");
});

test("extracts DOCX text after ZIP entry validation", async () => {
  const text = await extractCvDocument(
    {
      buffer: docx,
      mimetype:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: docx.length,
    },
    {
      maxFileBytes: 1024,
      extractPdf: async () => "",
      extractDocx: async () => "TypeScript developer",
    },
  );

  assert.equal(text, "TypeScript developer");
});

test("rejects unsupported, oversized, invalid, empty, and excessive documents", async () => {
  const cases: Array<{
    file: { buffer: Buffer; mimetype: string; size: number };
    text?: string;
    code: string;
  }> = [
    {
      file: { buffer: Buffer.from("txt"), mimetype: "text/plain", size: 3 },
      code: "CV_FILE_TYPE_UNSUPPORTED",
    },
    {
      file: { buffer: pdf, mimetype: "application/pdf", size: 2048 },
      code: "CV_FILE_TOO_LARGE",
    },
    {
      file: {
        buffer: Buffer.from("not-pdf"),
        mimetype: "application/pdf",
        size: 7,
      },
      code: "CV_FILE_SIGNATURE_INVALID",
    },
    {
      file: { buffer: pdf, mimetype: "application/pdf", size: pdf.length },
      text: "  ",
      code: "CV_TEXT_EMPTY",
    },
    {
      file: { buffer: pdf, mimetype: "application/pdf", size: pdf.length },
      text: "x".repeat(100_001),
      code: "CV_TEXT_TOO_LARGE",
    },
  ];

  for (const item of cases) {
    await assert.rejects(
      extractCvDocument(item.file, {
        maxFileBytes: 1024,
        extractPdf: async () => item.text ?? "ok",
        extractDocx: async () => item.text ?? "ok",
      }),
      (error: unknown) =>
        error instanceof CvDocumentError && error.code === item.code,
    );
  }
});
