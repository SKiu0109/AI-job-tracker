// pdfjs-dist ESM expects browser DOM APIs
if (!("DOMMatrix" in globalThis)) {
  (globalThis as Record<string, unknown>).DOMMatrix = class {
    static fromMatrix() { return new (this as new () => unknown)(); }
  };
}

const MAX_RESUME_FILE_SIZE = 5 * 1024 * 1024;
const MAX_RESUME_TEXT_LENGTH = 18000;
const MIN_RESUME_TEXT_LENGTH = 80;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

export type ResumeTextExtractionCode =
  | "resume_too_large"
  | "unsupported_file_type"
  | "resume_text_empty";

export class ResumeTextExtractionError extends Error {
  constructor(
    readonly code: ResumeTextExtractionCode,
    message: string
  ) {
    super(message);
    this.name = "ResumeTextExtractionError";
  }
}

export async function extractResumeText(file: File) {
  if (file.size > MAX_RESUME_FILE_SIZE) {
    throw new ResumeTextExtractionError(
      "resume_too_large",
      "Resume file is too large. Please upload a file under 5 MB."
    );
  }

  const fileName = file.name || "resume";
  const fileType = detectResumeFileType(file);

  if (!fileType) {
    throw new ResumeTextExtractionError(
      "unsupported_file_type",
      "Unsupported resume format. Please upload a .docx or text-based .pdf file."
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawText =
    fileType === "docx"
      ? await extractDocxText(buffer)
      : await extractPdfText(buffer);
  const text = normalizeExtractedText(rawText);

  if (text.length < MIN_RESUME_TEXT_LENGTH) {
    throw new ResumeTextExtractionError(
      "resume_text_empty",
      "Could not extract enough text from this resume. Scanned PDFs are not supported yet."
    );
  }

  return {
    fileName,
    fileType,
    text: text.slice(0, MAX_RESUME_TEXT_LENGTH),
    wasTruncated: text.length > MAX_RESUME_TEXT_LENGTH
  };
}

function detectResumeFileType(file: File): "docx" | "pdf" | null {
  const name = file.name.toLowerCase();

  if (file.type === DOCX_MIME || name.endsWith(".docx")) {
    return "docx";
  }

  if (file.type === PDF_MIME || name.endsWith(".pdf")) {
    return "pdf";
  }

  return null;
}

async function extractDocxText(buffer: Buffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");

  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
