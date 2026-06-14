#!/usr/bin/env node
// Build a bundled knowledge base (lib/knowledge.json) for the lightweight RAG.
// Extracts text from the project's .docx files (and policy_sections.json if
// present), splits it into small chunks, and writes a JSON array that the
// /ask function imports and searches lexically at runtime.
//
// Runs locally on your machine (Node.js) — not part of the deployed Worker.
//   node tools/build-knowledge.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import mammoth from "mammoth";

const SOURCES = ["know.docx", "knowledge.docx", "Rayan iofo.docx"];
const OUTPUT = "lib/knowledge.json";
const MAX_CHUNK_CHARS = 750;
const MIN_CHUNK_CHARS = 40;

function looksLikeHeading(line) {
  if (line.length < 4 || line.length > 70) return false;
  if (!/\p{L}/u.test(line)) return false; // must contain letters, not a bare number
  if (/[.!؟?]$/.test(line)) return false;
  return (
    /[:：]$/.test(line) ||
    /^(ماده|تبصره|فصل|بخش|بند|ضمیمه|پیوست|آیین)\b/.test(line) ||
    line.split(/\s+/).length <= 7
  );
}

const GENERIC_TITLES = new Set(["پاسخ", "سوال", "پرسش", "جواب", "answer", "question"]);

function deriveTitle(source, title, body) {
  const stripped = (title || "")
    .replace(/[()（）]/g, " ")
    .replace(/answer|question/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const meaningful =
    stripped.length >= 4 &&
    stripped !== source &&
    /\p{L}/u.test(stripped) &&
    !GENERIC_TITLES.has(stripped.toLowerCase());
  const base = meaningful ? stripped : body.split(/\s+/).slice(0, 10).join(" ");
  return base.slice(0, 120);
}

function chunkText(source, text) {
  const lines = text
    .split(/\r?\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks = [];
  let title = source;
  let buffer = [];
  let bufferLen = 0;

  const flush = () => {
    const body = buffer.join(" ").trim();
    if (body.length >= MIN_CHUNK_CHARS) {
      chunks.push({
        id: `${source}#${chunks.length + 1}`,
        source,
        title: deriveTitle(source, title, body),
        text: body.slice(0, MAX_CHUNK_CHARS * 2),
      });
    }
    buffer = [];
    bufferLen = 0;
  };

  for (const line of lines) {
    if (looksLikeHeading(line)) {
      flush();
      title = line;
      continue;
    }
    buffer.push(line);
    bufferLen += line.length;
    if (bufferLen >= MAX_CHUNK_CHARS) flush();
  }
  flush();
  return chunks;
}

async function extract(source) {
  if (source.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: readFileSync(source) });
    return value || "";
  }
  if (source.endsWith(".json")) {
    const data = JSON.parse(readFileSync(source, "utf8"));
    const items = Array.isArray(data) ? data : data.sections || Object.values(data);
    return items
      .map((it) =>
        typeof it === "string"
          ? it
          : [it.title, it.heading, it.section, it.text, it.content, it.body]
              .filter(Boolean)
              .join("\n"),
      )
      .join("\n\n");
  }
  return "";
}

async function main() {
  const all = [];
  for (const source of [...SOURCES, "policy_sections.json"]) {
    if (!existsSync(source)) continue;
    try {
      const text = await extract(source);
      const chunks = chunkText(source, text);
      all.push(...chunks);
      console.error(`${source}: ${chunks.length} chunks (${text.length} chars)`);
    } catch (err) {
      console.error(`${source}: failed -`, err.message);
    }
  }

  if (!all.length) {
    console.error("No knowledge sources found; writing empty knowledge base.");
  }

  // Re-id sequentially for stable references.
  all.forEach((c, i) => (c.id = String(i + 1)));

  writeFileSync(OUTPUT, JSON.stringify(all), "utf8");
  const bytes = Buffer.byteLength(JSON.stringify(all), "utf8");
  console.error(`Wrote ${all.length} chunks to ${OUTPUT} (${(bytes / 1024).toFixed(0)} KB).`);
}

main();
