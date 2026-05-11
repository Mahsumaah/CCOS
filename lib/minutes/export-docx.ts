import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatTime,
  type FormatLocale,
} from "@/lib/format";

import type { MinutesData, MinutesVoteResult } from "./types";

const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;
const PAGE_MARGIN_TWIP = 1440;

const LIGHT_BORDER = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "CCCCCC",
} as const;

const CELL_BORDERS = {
  top: LIGHT_BORDER,
  bottom: LIGHT_BORDER,
  left: LIGHT_BORDER,
  right: LIGHT_BORDER,
};

function resolvePublicUrl(maybeUrl: string | null | undefined): string | null {
  if (!maybeUrl?.trim()) return null;
  const t = maybeUrl.trim();
  if (/^https?:\/\//i.test(t)) return t;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (base && t.startsWith("/")) return `${base}${t}`;
  return null;
}

/** Tenant logos are stored as absolute URLs (e.g. ImageKit). */
function resolveTenantLogoUrl(logo: string | null | undefined): string | null {
  const t = logo?.trim();
  if (!t) return null;
  if (/^https:\/\//i.test(t)) return t;
  return resolvePublicUrl(t);
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function detectImageType(buf: Buffer): "png" | "jpg" | "gif" | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (
    buf.length >= 6 &&
    (buf.subarray(0, 6).toString("ascii") === "GIF87a" ||
      buf.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return "gif";
  }
  return null;
}

function decodeDataUrlToImage(
  dataUrl: string,
): { buffer: Buffer; type: "png" | "jpg" | "gif" } | null {
  const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m?.[2]) return null;
  const ext = m[1].toLowerCase();
  try {
    const buffer = Buffer.from(m[2], "base64");
    if (buffer.length < 8) return null;
    const type: "png" | "jpg" | "gif" =
      ext === "png" ? "png" : ext === "gif" ? "gif" : "jpg";
    return { buffer, type };
  } catch {
    return null;
  }
}

async function loadSignatureImage(
  signatureImageUrl: string | null | undefined,
): Promise<{ buffer: Buffer; type: "png" | "jpg" | "gif" } | null> {
  const raw = signatureImageUrl?.trim();
  if (!raw) return null;
  if (raw.startsWith("data:image/")) {
    return decodeDataUrlToImage(raw);
  }
  const url = resolvePublicUrl(raw);
  if (!url) return null;
  const buf = await fetchImageBuffer(url);
  if (!buf) return null;
  const type = detectImageType(buf);
  if (!type) return null;
  return { buffer: buf, type };
}

function voteResultLabel(result: MinutesVoteResult, locale: FormatLocale): string {
  if (locale === "ar") {
    switch (result) {
      case "APPROVED":
        return "موافقة";
      case "REJECTED":
        return "مرفوض";
      case "TIE":
        return "تعادل";
      default:
        return result;
    }
  }
  switch (result) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "TIE":
      return "Tie";
    default:
      return result;
  }
}

function arEn(locale: FormatLocale, ar: string, en: string): string {
  return locale === "ar" ? ar : en;
}

function baseRun(
  text: string,
  locale: FormatLocale,
  opts?: { bold?: boolean; italics?: boolean; size?: number },
): TextRun {
  return new TextRun({
    text,
    font: "Arial",
    size: opts?.size ?? 22,
    bold: opts?.bold,
    italics: opts?.italics,
    rightToLeft: locale === "ar",
  });
}

function sectionParagraph(
  locale: FormatLocale,
  children: (TextRun | ImageRun)[],
  options?: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacing?: { before?: number; after?: number };
  },
) {
  return new Paragraph({
    bidirectional: locale === "ar",
    alignment:
      options?.alignment ??
      (locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT),
    spacing: options?.spacing ?? { after: 160 },
    children,
  });
}

function headingParagraph(locale: FormatLocale, text: string) {
  return new Paragraph({
    bidirectional: locale === "ar",
    alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { before: 280, after: 200 },
    children: [baseRun(text, locale, { bold: true, size: 28 })],
  });
}

function tableCell(
  locale: FormatLocale,
  text: string,
  opts?: { bold?: boolean },
): TableCell {
  return new TableCell({
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    borders: CELL_BORDERS,
    children: [
      new Paragraph({
        bidirectional: locale === "ar",
        alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [baseRun(text, locale, { bold: opts?.bold })],
      }),
    ],
  });
}

function meetingInfoTable(data: MinutesData, locale: FormatLocale): Table {
  const m = data.meeting;
  const dash = locale === "ar" ? "—" : "—";
  const rawLoc = m.location?.trim() ?? "";
  const loc =
    rawLoc && !/^https?:\/\//i.test(rawLoc)
      ? rawLoc
      : arEn(locale, "CCOS مباشر (داخل التطبيق)", "CCOS Live (in-app)");

  const rows: TableRow[] = [
    new TableRow({
      children: [
        tableCell(
          locale,
          arEn(locale, "العنوان", "Title"),
          { bold: true },
        ),
        tableCell(locale, m.title),
      ],
    }),
    new TableRow({
      children: [
        tableCell(locale, arEn(locale, "النوع", "Type"), { bold: true }),
        tableCell(locale, m.typeLabel),
      ],
    }),
    new TableRow({
      children: [
        tableCell(locale, arEn(locale, "التاريخ", "Date"), { bold: true }),
        tableCell(locale, formatDate(m.scheduledAt, locale)),
      ],
    }),
    new TableRow({
      children: [
        tableCell(locale, arEn(locale, "وقت البدء", "Start"), { bold: true }),
        tableCell(
          locale,
          m.startedAt ? formatTime(m.startedAt, locale) : dash,
        ),
      ],
    }),
    new TableRow({
      children: [
        tableCell(locale, arEn(locale, "وقت الانتهاء", "End"), { bold: true }),
        tableCell(locale, m.endedAt ? formatTime(m.endedAt, locale) : dash),
      ],
    }),
    new TableRow({
      children: [
        tableCell(locale, arEn(locale, "المدة", "Duration"), { bold: true }),
        tableCell(locale, formatDuration(m.durationMin, locale)),
      ],
    }),
    new TableRow({
      children: [
        tableCell(locale, arEn(locale, "مكان الاجتماع", "Venue"), { bold: true }),
        tableCell(locale, loc),
      ],
    }),
  ];

  return new Table({
    visuallyRightToLeft: locale === "ar",
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3200, 6200],
    borders: {
      top: LIGHT_BORDER,
      bottom: LIGHT_BORDER,
      left: LIGHT_BORDER,
      right: LIGHT_BORDER,
      insideHorizontal: LIGHT_BORDER,
      insideVertical: LIGHT_BORDER,
    },
    rows,
  });
}

function votingResultsTable(data: MinutesData, locale: FormatLocale): Table {
  const head = new TableRow({
    children: [
      tableCell(locale, arEn(locale, "السؤال", "Question"), { bold: true }),
      tableCell(locale, arEn(locale, "موافق", "Approve"), { bold: true }),
      tableCell(locale, arEn(locale, "مرفوض", "Reject"), { bold: true }),
      tableCell(locale, arEn(locale, "ممتنع", "Abstain"), { bold: true }),
      tableCell(locale, arEn(locale, "النتيجة", "Result"), { bold: true }),
    ],
  });

  const body =
    data.allVotes.length === 0
      ? [
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 5,
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                borders: CELL_BORDERS,
                children: [
                  new Paragraph({
                    bidirectional: locale === "ar",
                    alignment:
                      locale === "ar"
                        ? AlignmentType.RIGHT
                        : AlignmentType.LEFT,
                    children: [
                      baseRun(arEn(locale, "—", "—"), locale),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ]
      : data.allVotes.map(
          (v) =>
            new TableRow({
              children: [
                tableCell(locale, v.question),
                tableCell(locale, String(v.tallies.approve)),
                tableCell(locale, String(v.tallies.reject)),
                tableCell(locale, String(v.tallies.abstain)),
                tableCell(locale, voteResultLabel(v.result, locale)),
              ],
            }),
        );

  return new Table({
    visuallyRightToLeft: locale === "ar",
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3600, 1200, 1200, 1200, 1600],
    borders: {
      top: LIGHT_BORDER,
      bottom: LIGHT_BORDER,
      left: LIGHT_BORDER,
      right: LIGHT_BORDER,
      insideHorizontal: LIGHT_BORDER,
      insideVertical: LIGHT_BORDER,
    },
    rows: [head, ...body],
  });
}

function emptySignatureBoxes(locale: FormatLocale): Table {
  const labels = [
    arEn(locale, "رئيس الاجتماع", "Chairman"),
    arEn(locale, "أمين السر", "Secretary"),
    arEn(locale, "الأعضاء", "Members"),
  ];

  return new Table({
    visuallyRightToLeft: locale === "ar",
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3000, 3000, 3000],
    borders: {
      top: LIGHT_BORDER,
      bottom: LIGHT_BORDER,
      left: LIGHT_BORDER,
      right: LIGHT_BORDER,
      insideHorizontal: LIGHT_BORDER,
      insideVertical: LIGHT_BORDER,
    },
    rows: [
      new TableRow({
        children: labels.map(
          (label) =>
            new TableCell({
              margins: { top: 160, bottom: 160, left: 120, right: 120 },
              borders: CELL_BORDERS,
              children: [
                new Paragraph({
                  bidirectional: locale === "ar",
                  alignment:
                    locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  spacing: { after: 120 },
                  children: [baseRun(label, locale, { bold: true })],
                }),
                new Paragraph({
                  bidirectional: locale === "ar",
                  alignment:
                    locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  children: [baseRun("________________________", locale)],
                }),
              ],
            }),
        ),
      }),
    ],
  });
}

export async function generateMinutesDocxBuffer(
  data: MinutesData,
  locale: "ar" | "en",
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  const logoUrl = resolveTenantLogoUrl(data.tenant.logo);
  let logoRun: ImageRun | null = null;
  if (logoUrl) {
    try {
      const buf = await fetchImageBuffer(logoUrl);
      if (buf) {
        const kind = detectImageType(buf);
        if (kind) {
          logoRun = new ImageRun({
            type: kind,
            data: buf,
            transformation: { width: 1_600_000, height: 550_000 },
          });
        }
      }
    } catch {
      /* skip logo */
    }
  }

  if (logoRun) {
    children.push(
      sectionParagraph(locale, [logoRun], {
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
    );
  }

  children.push(
    sectionParagraph(locale, [baseRun(data.tenant.name, locale, { size: 26 })], {
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  children.push(
    sectionParagraph(
      locale,
      [
        baseRun(
          arEn(locale, "محضر اجتماع", "Meeting Minutes"),
          locale,
          { bold: true, size: 36 },
        ),
      ],
      { alignment: AlignmentType.CENTER, spacing: { after: 120 } },
    ),
  );

  children.push(
    sectionParagraph(
      locale,
      [baseRun(data.meeting.typeLabel, locale, { size: 24 })],
      { alignment: AlignmentType.CENTER, spacing: { after: 280 } },
    ),
  );

  children.push(meetingInfoTable(data, locale));

  children.push(headingParagraph(locale, arEn(locale, "الحضور", "Attendees")));
  data.attendees.forEach((a, i) => {
    children.push(
      new Paragraph({
        bidirectional: locale === "ar",
        alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { after: 100 },
        children: [
          baseRun(`${i + 1}. ${a.name} — ${a.roleLabel}`, locale),
        ],
      }),
    );
  });

  children.push(headingParagraph(locale, arEn(locale, "الغياب", "Absentees")));
  data.absentees.forEach((a, i) => {
    children.push(
      new Paragraph({
        bidirectional: locale === "ar",
        alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { after: 100 },
        children: [
          baseRun(`${i + 1}. ${a.name} — ${a.roleLabel}`, locale),
        ],
      }),
    );
  });

  children.push(
    headingParagraph(locale, arEn(locale, "بنود جدول الأعمال", "Agenda Items")),
  );

  for (const item of data.agenda) {
    const title =
      locale === "en" && item.titleEn?.trim()
        ? item.titleEn
        : item.titleAr;

    children.push(
      new Paragraph({
        bidirectional: locale === "ar",
        alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { before: 200, after: 120 },
        children: [
          baseRun(
            arEn(
              locale,
              `البند ${item.order}: ${title}`,
              `Item ${item.order}: ${title}`,
            ),
            locale,
            { bold: true, size: 24 },
          ),
        ],
      }),
    );

    if (item.notes?.trim()) {
      children.push(
        new Paragraph({
          bidirectional: locale === "ar",
          alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { after: 100 },
          children: [baseRun(item.notes.trim(), locale)],
        }),
      );
    }

    for (const d of item.decisions) {
      const text =
        locale === "en" && d.textEn?.trim() ? d.textEn : d.textAr;
      children.push(
        new Paragraph({
          bidirectional: locale === "ar",
          alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { after: 100 },
          children: [
            baseRun(
              `${arEn(locale, "القرار", "Decision")}: ${text}`,
              locale,
            ),
          ],
        }),
      );
    }

    for (const v of item.votes) {
      children.push(
        new Paragraph({
          bidirectional: locale === "ar",
          alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { after: 100 },
          children: [
            baseRun(
              `${arEn(locale, "نتيجة التصويت", "Vote result")}: ${v.question} — ${voteResultLabel(v.result, locale)}`,
              locale,
            ),
          ],
        }),
      );
    }
  }

  children.push(
    headingParagraph(locale, arEn(locale, "القرارات الصادرة", "Decisions Issued")),
  );
  for (const d of data.allDecisions) {
    const text =
      locale === "en" && d.textEn?.trim() ? d.textEn : d.textAr;
    children.push(
      new Paragraph({
        bidirectional: locale === "ar",
        alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { after: 100 },
        children: [baseRun(`${d.number}. ${text}`, locale)],
      }),
    );
  }

  children.push(
    headingParagraph(locale, arEn(locale, "نتائج التصويت", "Voting Results")),
  );
  children.push(votingResultsTable(data, locale));

  children.push(headingParagraph(locale, arEn(locale, "التوقيعات", "Signatures")));

  if (data.signatures.length === 0) {
    children.push(emptySignatureBoxes(locale));
  } else {
    for (const s of data.signatures) {
      children.push(
        new Paragraph({
          bidirectional: locale === "ar",
          alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { before: 160, after: 80 },
          children: [
            baseRun(`${s.userName} — ${s.roleLabel}`, locale, { bold: true }),
          ],
        }),
      );

      let sigImage: ImageRun | null = null;
      try {
        const loaded = await loadSignatureImage(s.signatureImageUrl ?? undefined);
        if (loaded) {
          sigImage = new ImageRun({
            type: loaded.type,
            data: loaded.buffer,
            transformation: { width: 1_200_000, height: 450_000 },
          });
        }
      } catch {
        /* skip */
      }

      if (sigImage) {
        children.push(
          sectionParagraph(locale, [sigImage], {
            alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { after: 80 },
          }),
        );
      } else if (s.typedName?.trim()) {
        children.push(
          new Paragraph({
            bidirectional: locale === "ar",
            alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { after: 80 },
            children: [
              baseRun(s.typedName.trim(), locale, { italics: true, size: 24 }),
            ],
          }),
        );
      } else {
        children.push(
          new Paragraph({
            bidirectional: locale === "ar",
            alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { after: 80 },
            children: [baseRun("________________________", locale)],
          }),
        );
      }

      children.push(
        new Paragraph({
          bidirectional: locale === "ar",
          alignment: locale === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { after: 200 },
          children: [
            baseRun(formatDateTime(s.signedAt, locale), locale),
          ],
        }),
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: A4_WIDTH_TWIP,
              height: A4_HEIGHT_TWIP,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: PAGE_MARGIN_TWIP,
              right: PAGE_MARGIN_TWIP,
              bottom: PAGE_MARGIN_TWIP,
              left: PAGE_MARGIN_TWIP,
            },
          },
        },
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return Buffer.from(buf);
}
