import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import { sanitizeCvText } from "./normalizer";

export type CvDocumentErrorCode =
  | "CV_FILE_REQUIRED"
  | "CV_FILE_TOO_LARGE"
  | "CV_FILE_TYPE_UNSUPPORTED"
  | "CV_FILE_SIGNATURE_INVALID"
  | "CV_TEXT_EMPTY"
  | "CV_TEXT_TOO_LARGE";

export class CvDocumentError extends Error {
  constructor(
    public readonly code: CvDocumentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CvDocumentError";
  }
}

export type CvDocumentFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

type CvDocumentDependencies = {
  maxFileBytes: number;
  extractPdf: (buffer: Buffer) => Promise<string>;
  extractDocx: (buffer: Buffer) => Promise<string>;
};

async function extractPdf(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer) {
  return (await mammoth.extractRawText({ buffer })).value;
}

function isPdf(buffer: Buffer) {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function isDocx(buffer: Buffer) {
  const entries = buffer.toString("latin1");
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    entries.includes("[Content_Types].xml") &&
    entries.includes("word/document.xml")
  );
}

export async function extractCvDocument(
  file: CvDocumentFile | undefined,
  dependencies: CvDocumentDependencies,
) {
  if (!file) {
    throw new CvDocumentError("CV_FILE_REQUIRED", "A CV file is required.");
  }
  if (file.size > dependencies.maxFileBytes) {
    throw new CvDocumentError(
      "CV_FILE_TOO_LARGE",
      "The CV file exceeds the configured size limit.",
    );
  }

  let extracted: string;
  if (file.mimetype === "application/pdf") {
    if (!isPdf(file.buffer)) {
      throw new CvDocumentError(
        "CV_FILE_SIGNATURE_INVALID",
        "The PDF signature is invalid.",
      );
    }
    extracted = await dependencies.extractPdf(file.buffer);
  } else if (
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    if (!isDocx(file.buffer)) {
      throw new CvDocumentError(
        "CV_FILE_SIGNATURE_INVALID",
        "The DOCX signature is invalid.",
      );
    }
    extracted = await dependencies.extractDocx(file.buffer);
  } else {
    throw new CvDocumentError(
      "CV_FILE_TYPE_UNSUPPORTED",
      "Only PDF and DOCX CV files are supported.",
    );
  }

  const text = sanitizeCvText(extracted);
  if (!text) {
    throw new CvDocumentError(
      "CV_TEXT_EMPTY",
      "The CV does not contain extractable text.",
    );
  }
  if (text.length > 100_000) {
    throw new CvDocumentError(
      "CV_TEXT_TOO_LARGE",
      "The extracted CV text exceeds 100,000 characters.",
    );
  }
  return text;
}

export function createDefaultCvDocumentDependencies(maxFileBytes: number) {
  return { maxFileBytes, extractPdf, extractDocx };
}
