export type CatalogDocument = {
  id: string;
  type: string;
  typeLabel: string;
  fileName: string;
  sizeBytes: number;
  path: string;
  url: string;
};

export type CatalogPaper = {
  id: string;
  level: string;
  subject: string;
  examBoard: string;
  collection: string;
  qualificationVariant: string;
  examCode: string | null;
  title: string;
  paper: string | null;
  year: number | null;
  session: string | null;
  isPaired: boolean;
  questionPaperUrl: string | null;
  markSchemeUrl: string | null;
  files: {
    questionPaper: CatalogDocument | null;
    markScheme: CatalogDocument | null;
    questionPapers: CatalogDocument[];
    markSchemes: CatalogDocument[];
  };
};

export type Catalog = {
  generatedAt: string;
  baseUrl: string;
  counts: Record<string, number>;
  metadata: Record<string, unknown>;
  papers: CatalogPaper[];
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function getCatalog(): Promise<Catalog> {
  const catalogUrl =
    process.env.PAPERS_CATALOG_URL || process.env.NEXT_PUBLIC_PAPERS_CATALOG_URL;

  if (!catalogUrl) {
    throw new Error("Missing PAPERS_CATALOG_URL environment variable.");
  }

  const revalidate = Number(process.env.CATALOG_REVALIDATE_SECONDS || 3600);
  const response = await fetch(catalogUrl, {
    next: {
      revalidate: Number.isFinite(revalidate) ? revalidate : 3600,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch catalog: ${response.status}`);
  }

  return response.json();
}

export function filterPapers(papers: CatalogPaper[], searchParams: URLSearchParams) {
  const q = String(searchParams.get("q") || "").trim().toLowerCase();
  const type = searchParams.get("type") || searchParams.get("documentType");
  const paired = truthy(searchParams.get("paired")) || truthy(searchParams.get("complete"));

  return papers.filter((paper) => {
    if (q && !searchText(paper).includes(q)) {
      return false;
    }

    if (!matchesExactFilter(paper.level, searchParams.get("level"))) {
      return false;
    }

    if (!matchesSubjectFilter(paper.subject, searchParams.get("subject"))) {
      return false;
    }

    if (
      !matchesBoardFilter(
        paper.examBoard,
        searchParams.get("board") || searchParams.get("examBoard")
      )
    ) {
      return false;
    }

    if (!matchesExactFilter(paper.year, searchParams.get("year"))) {
      return false;
    }

    if (!matchesExactFilter(paper.session, searchParams.get("session"))) {
      return false;
    }

    if (paired && !paper.isPaired) {
      return false;
    }

    if (type && !hasDocumentType(paper, type)) {
      return false;
    }

    return true;
  });
}

export function paginatePapers(papers: CatalogPaper[], searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = clamp(
    Number(searchParams.get("pageSize") || searchParams.get("limit") || DEFAULT_PAGE_SIZE),
    1,
    MAX_PAGE_SIZE
  );
  const total = papers.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;

  return {
    data: papers.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

function searchText(paper: CatalogPaper) {
  return [
    paper.level,
    paper.subject,
    paper.examBoard,
    paper.collection,
    paper.qualificationVariant,
    paper.examCode,
    paper.title,
    paper.paper,
    paper.year,
    paper.session,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();
}

function hasDocumentType(paper: CatalogPaper, type: string) {
  const documentTypes = [
    ...paper.files.questionPapers.map((document) => document.type),
    ...paper.files.markSchemes.map((document) => document.type),
  ];

  return documentTypes.some((documentType) => matchesExactFilter(documentType, type));
}

function matchesExactFilter(actual: unknown, expected: string | null) {
  if (!expected) {
    return true;
  }

  if (actual === null || actual === undefined) {
    return false;
  }

  const normalizedActual = normalizeFilterValue(actual);
  const normalizedExpected = normalizeFilterValue(expected);

  return normalizedActual === normalizedExpected;
}

function matchesSubjectFilter(actual: unknown, expected: string | null) {
  if (!expected) {
    return true;
  }

  if (actual === null || actual === undefined) {
    return false;
  }

  return canonicalSubject(actual) === canonicalSubject(expected);
}

function matchesBoardFilter(actual: unknown, expected: string | null) {
  if (!expected) {
    return true;
  }

  if (actual === null || actual === undefined) {
    return false;
  }

  return canonicalBoard(actual) === canonicalBoard(expected);
}

function normalizeFilterValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function canonicalSubject(value: unknown) {
  const normalized = normalizeFilterValue(value);
  const aliases: Record<string, string> = {
    math: "maths",
    maths: "maths",
    mathematics: "maths",
    furthermaths: "furthermaths",
    furthermathematics: "furthermaths",
    statistics: "statistics",
    stats: "statistics",
    businessstudies: "business",
    business: "business",
    physicaleducationpe: "physicaleducation",
    physicaleducation: "physicaleducation",
    pe: "physicaleducation",
    religiousstudiesrs: "religiousstudies",
    religiousstudies: "religiousstudies",
    rs: "religiousstudies",
    dramaandtheatre: "drama",
    drama: "drama",
  };

  return aliases[normalized] || normalized;
}

function canonicalBoard(value: unknown) {
  const normalized = normalizeFilterValue(value);
  const aliases: Record<string, string> = {
    edexcel: "edexcel",
    pearsonedexcel: "edexcel",
    pearson: "edexcel",
    cie: "cambridge",
    caie: "cambridge",
    cambridge: "cambridge",
    cambridgeinternational: "cambridge",
  };

  return aliases[normalized] || normalized;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function truthy(value: string | null) {
  return ["1", "true", "yes", "y"].includes(String(value || "").toLowerCase());
}
