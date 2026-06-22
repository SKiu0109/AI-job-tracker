import { readFile } from "fs/promises";
import path from "path";

const MAX_RESUME_FILE_SIZE = 5 * 1024 * 1024;
const MAX_RESUME_TEXT_LENGTH = 18000;
const MIN_RESUME_TEXT_LENGTH = 80;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

let cachedPdfWorkerDataUrl: string | null = null;

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

  PDFParse.setWorker(await getPdfWorkerDataUrl());

  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function getPdfWorkerDataUrl() {
  if (cachedPdfWorkerDataUrl) {
    return cachedPdfWorkerDataUrl;
  }

  const packageRoot = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "node_modules",
    "pdf-parse"
  );
  const workerCandidates = [
    path.join(packageRoot, "dist", "pdf-parse", "esm", "pdf.worker.mjs"),
    path.join(packageRoot, "dist", "pdf-parse", "cjs", "pdf.worker.mjs"),
    path.join(packageRoot, "dist", "worker", "pdf.worker.mjs")
  ];

  for (const candidate of workerCandidates) {
    try {
      const workerSource = await readFile(candidate);
      cachedPdfWorkerDataUrl = `data:text/javascript;base64,${workerSource.toString(
        "base64"
      )}`;
      return cachedPdfWorkerDataUrl;
    } catch {
      // Try the next package layout; pnpm and npm place this file differently.
    }
  }

  throw new ResumeTextExtractionError(
    "resume_text_empty",
    "Could not load the PDF parser worker. Please try uploading a .docx resume instead."
  );
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
