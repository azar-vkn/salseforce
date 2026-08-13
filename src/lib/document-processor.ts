/**
 * CRM AI Brain Document Processing Utility
 * Extracts text and splits documents into searchable semantically-rich chunks.
 */

export interface ProcessedDocumentResult {
  title: string;
  fileType: string;
  rawContent: string;
  chunks: string[];
}

/**
 * Clean & chunk text into ~300-500 character segments with sentence overlap
 */
export function chunkTextContent(text: string, maxChunkLength: number = 400): string[] {
  if (!text || !text.trim()) return [];

  const clean = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Split by double line breaks (paragraphs) first
  const paragraphs = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 2 <= maxChunkLength) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If a single paragraph is longer than maxChunkLength, split by sentences
      if (trimmed.length > maxChunkLength) {
        const sentences = trimmed.match(/[^.!?]+[.!?]+/g) || [trimmed];
        let subChunk = "";
        for (const sentence of sentences) {
          if (subChunk.length + sentence.length <= maxChunkLength) {
            subChunk = subChunk ? `${subChunk} ${sentence}` : sentence;
          } else {
            if (subChunk) chunks.push(subChunk.trim());
            subChunk = sentence;
          }
        }
        if (subChunk) currentChunk = subChunk.trim();
        else currentChunk = "";
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk && currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Process uploaded document file or text
 */
export async function processUploadedDocument(
  file: File | { name: string; text: string }
): Promise<ProcessedDocumentResult> {
  const fileName = file.name;
  const ext = fileName.slice(((fileName.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase() || "txt";

  let rawContent = "";

  if ("text" in file && typeof file.text === "string") {
    rawContent = file.text;
  } else if (file instanceof File) {
    rawContent = await file.text();
  }

  const chunks = chunkTextContent(rawContent);

  return {
    title: fileName.replace(/\.[^/.]+$/, ""),
    fileType: ext,
    rawContent,
    chunks,
  };
}
