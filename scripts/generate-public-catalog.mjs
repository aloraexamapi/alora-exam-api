import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LEVELS = new Set(["GCSE", "A-Level"]);
const EXAM_BOARDS = [
  "Pearson Edexcel",
  "Edexcel",
  "AQA",
  "OCR",
  "WJEC",
  "Eduqas",
  "CCEA",
  "SQA",
];
const DOCUMENT_TYPE_LABELS = {
  question_paper: "Question paper",
  mark_scheme: "Mark scheme",
};
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const papersRoot = path.resolve(process.env.PAPERS_ROOT || projectRoot);
const outputPath = path.resolve(
  process.env.CATALOG_OUTPUT || path.join(projectRoot, "dist", "catalog.json")
);
const publicBaseUrl = String(process.env.PUBLIC_PAPERS_BASE_URL || "").replace(/\/+$/, "");

if (!publicBaseUrl) {
  console.error("Missing PUBLIC_PAPERS_BASE_URL, for example https://papers.yourdomain.com");
  process.exit(1);
}

const catalog = buildCatalog(papersRoot);
const publicCatalog = {
  generatedAt: catalog.generatedAt,
  baseUrl: publicBaseUrl,
  counts: catalog.metadata.counts,
  metadata: catalog.metadata,
  papers: catalog.papers.map(toPublicPaper),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(publicCatalog, null, 2)}\n`);

console.log(`Wrote ${publicCatalog.papers.length} paper records to ${outputPath}`);

function toPublicPaper(paper) {
  const questionPapers = paper.documents
    .filter((document) => document.type === "question_paper")
    .map(toPublicDocument);
  const markSchemes = paper.documents
    .filter((document) => document.type === "mark_scheme")
    .map(toPublicDocument);

  return {
    id: paper.id,
    level: paper.level,
    subject: paper.subject,
    examBoard: paper.examBoard,
    collection: paper.collection,
    qualificationVariant: paper.qualificationVariant,
    examCode: paper.examCode,
    title: paper.title,
    paper: paper.paper,
    year: paper.year,
    session: paper.session,
    isPaired: paper.hasQuestionPaper && paper.hasMarkScheme,
    questionPaperUrl: questionPapers[0]?.url || null,
    markSchemeUrl: markSchemes[0]?.url || null,
    files: {
      questionPaper: questionPapers[0] || null,
      markScheme: markSchemes[0] || null,
      questionPapers,
      markSchemes,
    },
  };
}

function toPublicDocument(document) {
  return {
    id: document.id,
    type: document.type,
    typeLabel: document.typeLabel,
    fileName: document.fileName,
    sizeBytes: document.sizeBytes,
    path: document.relativePath,
    url: `${publicBaseUrl}/${encodePath(document.relativePath)}`,
  };
}

function buildCatalog(rootDir) {
  const papersById = new Map();
  const documentsById = new Map();
  const paperFolders = new Map();
  const files = findPdfFiles(rootDir);

  for (const absolutePath of files) {
    const relativePath = toPosix(path.relative(rootDir, absolutePath));
    const parts = relativePath.split("/");

    if (parts.length < 5 || !LEVELS.has(parts[0])) {
      continue;
    }

    const [level, rawSubject, collection, paperFolder] = parts;
    const subject = parseSubject(rawSubject, collection);
    const relativePaperPath = parts.slice(0, 4).join("/");
    const documentType = parseDocumentType(parts[parts.length - 1]);
    const documentId = makeId("doc", relativePath);
    const paperId = makeId("paper", relativePaperPath);
    const stat = fs.statSync(absolutePath);

    if (!paperFolders.has(relativePaperPath)) {
      const parsed = parsePaperFolder(paperFolder);
      const paper = {
        id: paperId,
        level,
        subject,
        examBoard: parseExamBoard(collection),
        collection,
        examCode: parsed.examCode,
        title: parsed.title,
        paper: parsed.paper,
        year: parsed.year,
        session: parsed.session,
        qualificationVariant: parseQualificationVariant(level, paperFolder),
        path: relativePaperPath,
        documentTypes: [],
        hasQuestionPaper: false,
        hasMarkScheme: false,
        documents: [],
      };

      paperFolders.set(relativePaperPath, paper);
      papersById.set(paper.id, paper);
    }

    const paper = paperFolders.get(relativePaperPath);
    const document = {
      id: documentId,
      paperId: paper.id,
      type: documentType,
      typeLabel: DOCUMENT_TYPE_LABELS[documentType] || toTitleCase(documentType),
      fileName: parts[parts.length - 1],
      relativePath,
      sizeBytes: stat.size,
    };

    paper.documents.push(document);
    paper.documentTypes = Array.from(new Set([...paper.documentTypes, document.type]));
    paper.hasQuestionPaper = paper.hasQuestionPaper || document.type === "question_paper";
    paper.hasMarkScheme = paper.hasMarkScheme || document.type === "mark_scheme";
    documentsById.set(document.id, document);
  }

  const papers = Array.from(papersById.values())
    .map((paper) => ({
      ...paper,
      documents: paper.documents.sort(compareDocuments),
      documentTypes: paper.documentTypes.sort(collator.compare),
    }))
    .sort(comparePapers);

  return {
    generatedAt: new Date().toISOString(),
    rootDir,
    papers,
    papersById,
    documentsById,
    metadata: buildMetadata(papers),
  };
}

function findPdfFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }

      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort(collator.compare);
}

function buildMetadata(papers) {
  const documents = papers.flatMap((paper) => paper.documents);

  return {
    counts: {
      papers: papers.length,
      pairedPapers: papers.filter((paper) => paper.hasQuestionPaper && paper.hasMarkScheme).length,
      unpairedPapers: papers.filter((paper) => !paper.hasQuestionPaper || !paper.hasMarkScheme)
        .length,
      documents: documents.length,
      questionPapers: documents.filter((document) => document.type === "question_paper").length,
      markSchemes: documents.filter((document) => document.type === "mark_scheme").length,
    },
    levels: makeFacet(papers, "level"),
    subjects: makeFacet(papers, "subject"),
    boards: makeFacet(papers, "examBoard"),
    years: makeFacet(papers, "year").sort((a, b) => Number(b.value) - Number(a.value)),
    sessions: makeFacet(papers, "session"),
    documentTypes: makeFacet(documents, "type"),
    subjectsByLevel: groupFacet(papers, "level", "subject"),
    boardsByLevel: groupFacet(papers, "level", "examBoard"),
  };
}

function makeFacet(items, key) {
  const counts = new Map();

  for (const item of items) {
    const value = item[key];

    if (value === null || value === undefined || value === "") {
      continue;
    }

    counts.set(String(value), (counts.get(String(value)) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => collator.compare(a.value, b.value));
}

function groupFacet(items, groupKey, facetKey) {
  const grouped = {};

  for (const item of items) {
    const group = item[groupKey];
    const value = item[facetKey];

    if (!group || !value) {
      continue;
    }

    grouped[group] ||= new Map();
    grouped[group].set(value, (grouped[group].get(value) || 0) + 1);
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([group, counts]) => [
      group,
      Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => collator.compare(a.value, b.value)),
    ])
  );
}

function parseExamBoard(collection) {
  const lower = collection.toLowerCase();
  const board = EXAM_BOARDS.find((candidate) => lower.startsWith(candidate.toLowerCase()));

  return board || collection.split(" ")[0];
}

function parseSubject(subjectFolder, collection) {
  const normalizedCollection = normalizeSubjectSource(collection);
  const normalizedSubject = normalizeSubjectSource(subjectFolder);

  if (
    normalizedCollection.includes("furthermaths") ||
    normalizedCollection.includes("furthermathematics")
  ) {
    return "Further Maths";
  }

  if (normalizedCollection.includes("statistics")) {
    return "Statistics";
  }

  return canonicalSubjectFolder(subjectFolder, normalizedSubject);
}

function canonicalSubjectFolder(subjectFolder, normalizedSubject) {
  const aliases = {
    businessstudies: "Business",
    dramaandtheatre: "Drama",
    math: "Maths",
    maths: "Maths",
    mathematics: "Maths",
    mathsfurthermathsandstatistics: "Maths",
    pe: "Physical Education",
    physicaleducation: "Physical Education",
    physicaleducationpe: "Physical Education",
    religiousstudies: "Religious Studies",
    religiousstudiesrs: "Religious Studies",
    rs: "Religious Studies",
  };

  return aliases[normalizedSubject] || subjectFolder;
}

function parsePaperFolder(folderName) {
  const normalized = normalizeDashes(folderName);
  const examCode =
    normalized.match(/^([A-Za-z0-9]+(?:[_/][A-Za-z0-9]+)?(?:-[A-Za-z0-9]+)?)/)?.[1] ||
    null;
  const sessionYear = parseSessionYear(normalized);
  const year = sessionYear.year;
  const session = sessionYear.session;
  const title = parsePaperTitle(normalized, examCode, year, session);
  const paper = parsePaperName(title);

  return {
    examCode,
    title,
    paper,
    year,
    session,
  };
}

function parseSessionYear(text) {
  for (const month of MONTHS) {
    const monthThenYear = text.match(new RegExp(`\\b(${month})\\s+(19\\d{2}|20\\d{2})\\b`, "i"));

    if (monthThenYear) {
      return {
        session: toCanonicalMonth(monthThenYear[1]),
        year: Number(monthThenYear[2]),
      };
    }

    const yearThenMonth = text.match(new RegExp(`\\b(19\\d{2}|20\\d{2})\\s+(${month})\\b`, "i"));

    if (yearThenMonth) {
      return {
        session: toCanonicalMonth(yearThenMonth[2]),
        year: Number(yearThenMonth[1]),
      };
    }
  }

  if (/\bspecimen\b/i.test(text)) {
    return {
      session: "Specimen",
      year: null,
    };
  }

  if (/\bsample\b/i.test(text)) {
    return {
      session: "Sample",
      year: null,
    };
  }

  return {
    session: null,
    year: null,
  };
}

function toCanonicalMonth(value) {
  const month = MONTHS.find((candidate) => candidate.toLowerCase() === String(value).toLowerCase());

  return month || value;
}

function parsePaperTitle(folderName, examCode, year, session) {
  let title = folderName;

  if (examCode) {
    title = title.replace(new RegExp(`^${escapeRegex(examCode)}\\s*-?\\s*`, "i"), "");
  }

  if (session && year) {
    title = title.replace(new RegExp(`^${escapeRegex(session)}\\s+${year}\\s*-?\\s*`, "i"), "");
  } else if (year) {
    title = title.replace(new RegExp(`^${year}\\s*-?\\s*`, "i"), "");
  } else if (session) {
    title = title.replace(new RegExp(`^${escapeRegex(session)}\\s*-?\\s*`, "i"), "");
  }

  title = title.replace(/\s+-\s+/g, " - ");
  title = title.replace(/\s+/g, " ").trim();

  return title || folderName;
}

function parsePaperName(title) {
  const match = title.match(/\b(?:Paper|Unit|Component)\s+[A-Za-z0-9]+[A-Za-z]?\b/i);

  return match ? match[0].replace(/\s+/g, " ") : null;
}

function parseQualificationVariant(level, paperFolder) {
  if (level === "A-Level" && /\bAS(?:-|\s)?Level\b|\bAS\b/.test(paperFolder)) {
    return "AS";
  }

  return level;
}

function parseDocumentType(fileName) {
  const baseName = path.basename(fileName, path.extname(fileName));
  const type = baseName
    .split(" - ")[0]
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

  return type || "document";
}

function comparePapers(a, b) {
  const yearA = a.year || 0;
  const yearB = b.year || 0;

  if (yearA !== yearB) {
    return yearB - yearA;
  }

  return (
    collator.compare(a.level, b.level) ||
    collator.compare(a.subject, b.subject) ||
    collator.compare(a.examBoard, b.examBoard) ||
    collator.compare(a.title, b.title)
  );
}

function compareDocuments(a, b) {
  const order = {
    question_paper: 0,
    mark_scheme: 1,
  };

  return (order[a.type] ?? 99) - (order[b.type] ?? 99) || collator.compare(a.fileName, b.fileName);
}

function normalizeDashes(value) {
  return value.replace(/[–—]/g, "-");
}

function normalizeSubjectSource(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function makeId(prefix, value) {
  return `${prefix}_${crypto.createHash("sha1").update(value).digest("hex").slice(0, 14)}`;
}

function toTitleCase(value) {
  return value
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function encodePath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}
