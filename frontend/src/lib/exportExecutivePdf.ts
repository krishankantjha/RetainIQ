import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { Overview, SavePlayStat } from "@/lib/api";
import { formatCurrency, formatModelSignal, formatNumber, formatPercent } from "@/lib/format";
import { actionableHighCount } from "@/lib/riskBands";

type ExecutivePdfInput = {
  overview: Overview;
  totalMrr: number;
  savePlays: SavePlayStat[];
};

type Rgb = { r: number; g: number; b: number };

const COLORS = {
  brand: { r: 91, g: 95, b: 246 } satisfies Rgb,
  brandDark: { r: 55, g: 48, b: 163 } satisfies Rgb,
  text: { r: 24, g: 28, b: 36 } satisfies Rgb,
  muted: { r: 107, g: 114, b: 128 } satisfies Rgb,
  border: { r: 226, g: 232, b: 240 } satisfies Rgb,
  surface: { r: 248, g: 250, b: 252 } satisfies Rgb,
  low: { r: 45, g: 157, b: 120 } satisfies Rgb,
  medium: { r: 217, g: 119, b: 6 } satisfies Rgb,
  high: { r: 220, g: 38, b: 38 } satisfies Rgb,
};

const MARGIN = 54;
const CONTENT_WIDTH = 612 - MARGIN * 2;

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

function setTextColor(doc: jsPDF, color: Rgb): void {
  doc.setTextColor(color.r, color.g, color.b);
}

function shareOf(part: number, total: number): string {
  if (total <= 0) return "0%";
  return formatPercent(part / total, 1);
}

function formatReportDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatGeneratedAt(date = new Date()): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function drawHeaderBand(doc: jsPDF): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(COLORS.brandDark.r, COLORS.brandDark.g, COLORS.brandDark.b);
  doc.rect(0, 0, pageWidth, 88, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("RetainIQ", MARGIN, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Predict · Prevent · Retain", MARGIN, 58);

  doc.setFontSize(9);
  doc.setTextColor(230, 232, 255);
  doc.text("Executive portfolio report", pageWidth - MARGIN, 40, { align: "right" });
  doc.text(formatReportDate(), pageWidth - MARGIN, 56, { align: "right" });

  return 108;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string, subtitle?: string): number {
  setTextColor(doc, COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, MARGIN, y);

  let nextY = y + 18;
  if (subtitle) {
    setTextColor(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(subtitle, CONTENT_WIDTH);
    doc.text(lines, MARGIN, nextY);
    nextY += lines.length * 12 + 6;
  }

  doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, nextY, MARGIN + CONTENT_WIDTH, nextY);
  return nextY + 14;
}

function drawExecutiveSummary(
  doc: jsPDF,
  y: number,
  total: number,
  actionableHigh: number,
  avgChurn: number,
): number {
  const thresholdShare = shareOf(actionableHigh, total);
  const summary = [
    `This report summarizes ${formatNumber(total)} scored subscribers from your most recent upload.`,
    `Average predicted churn is ${formatPercent(avgChurn, 1)}. ${formatNumber(actionableHigh)} subscribers (${thresholdShare}) are at or above the 15% decision threshold.`,
    "Figures reflect model scores — not observed churn or guaranteed financial outcomes.",
  ].join(" ");

  setTextColor(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(summary, CONTENT_WIDTH);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 13 + 8;
}

function drawKpiStrip(
  doc: jsPDF,
  y: number,
  items: { label: string; value: string; hint?: string }[],
): number {
  const gap = 10;
  const cardWidth = (CONTENT_WIDTH - gap * (items.length - 1)) / items.length;
  const cardHeight = 62;

  items.forEach((item, index) => {
    const x = MARGIN + index * (cardWidth + gap);
    doc.setFillColor(COLORS.surface.r, COLORS.surface.g, COLORS.surface.b);
    doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
    doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "FD");

    doc.setFillColor(COLORS.brand.r, COLORS.brand.g, COLORS.brand.b);
    doc.rect(x, y, cardWidth, 3, "F");

    setTextColor(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const labelLines = doc.splitTextToSize(item.label.toUpperCase(), cardWidth - 16);
    doc.text(labelLines, x + 10, y + 18);

    setTextColor(doc, COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(item.value, x + 10, y + 40);

    if (item.hint) {
      setTextColor(doc, COLORS.muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      const hintLines = doc.splitTextToSize(item.hint, cardWidth - 16);
      doc.text(hintLines, x + 10, y + 54);
    }
  });

  return y + cardHeight + 18;
}

function tableStyles() {
  const textColor: [number, number, number] = [COLORS.text.r, COLORS.text.g, COLORS.text.b];
  const lineColor: [number, number, number] = [COLORS.border.r, COLORS.border.g, COLORS.border.b];
  const headFill: [number, number, number] = [COLORS.brandDark.r, COLORS.brandDark.g, COLORS.brandDark.b];
  const altFill: [number, number, number] = [COLORS.surface.r, COLORS.surface.g, COLORS.surface.b];

  return {
    theme: "grid" as const,
    styles: {
      fontSize: 9.5,
      cellPadding: 7,
      textColor,
      lineColor,
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: headFill,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold" as const,
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: altFill,
    },
    margin: { left: MARGIN, right: MARGIN },
  };
}

function addFooters(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(COLORS.border.r, COLORS.border.g, COLORS.border.b);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, pageHeight - 40, pageWidth - MARGIN, pageHeight - 40);

    setTextColor(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      "RetainIQ · Scores from your last upload · Save plays are SHAP-based suggestions, not campaigns",
      MARGIN,
      pageHeight - 26,
    );
    doc.text(`Generated ${formatGeneratedAt()}`, MARGIN, pageHeight - 14);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - MARGIN, pageHeight - 14, { align: "right" });
  }
}

export function downloadExecutivePdf({
  overview,
  totalMrr,
  savePlays,
}: ExecutivePdfInput): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const risk = overview.risk_distribution;
  const total = overview.total_customers;
  const actionableHigh = overview.risk_bands?.actionable_high ?? actionableHighCount(risk);

  let y = drawHeaderBand(doc);
  y = drawExecutiveSummary(doc, y, total, actionableHigh, overview.average_churn_probability);

  y = drawSectionTitle(
    doc,
    y,
    "Key metrics",
    "Snapshot of predicted churn and monthly charges for the scored portfolio.",
  );

  y = drawKpiStrip(doc, y, [
    {
      label: "Subscribers scored",
      value: formatNumber(total),
    },
    {
      label: "Above threshold",
      value: formatNumber(actionableHigh),
      hint: "Predicted churn ≥ 15%",
    },
    {
      label: "Avg predicted churn",
      value: formatPercent(overview.average_churn_probability, 1),
    },
  ]);

  y = drawKpiStrip(doc, y, [
    {
      label: "Flagged MRR",
      value: formatCurrency(overview.total_value_at_risk),
      hint: "Monthly charges · flagged, non-churned",
    },
    {
      label: "Total MRR",
      value: formatCurrency(totalMrr),
      hint: "All scored subscribers",
    },
  ]);

  y = drawSectionTitle(
    doc,
    y,
    "Risk distribution",
    "Low (<15%), medium band (15–25%), and elevated (≥25%) tiers based on predicted probability.",
  );

  autoTable(doc, {
    startY: y,
    head: [["Risk tier", "Subscribers", "Share of portfolio"]],
    body: [
      ["Low risk (<15%)", formatNumber(risk.low), shareOf(risk.low, total)],
      ["Medium band (15–25%)", formatNumber(risk.medium), shareOf(risk.medium, total)],
      ["Elevated (≥25%)", formatNumber(risk.high), shareOf(risk.high, total)],
      ["Total", formatNumber(total), total > 0 ? "100%" : "0%"],
    ],
    ...tableStyles(),
    columnStyles: {
      0: { cellWidth: 200 },
      1: { halign: "right" },
      2: { halign: "right" },
    },
    didParseCell(data) {
      if (data.section === "body" && data.row.index === 3) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [COLORS.surface.r, COLORS.surface.g, COLORS.surface.b] as [
          number,
          number,
          number,
        ];
      }
      const tier = data.row.index;
      if (data.section === "body" && data.column.index === 0 && tier < 3) {
        const colors = [COLORS.low, COLORS.medium, COLORS.high][tier];
        data.cell.styles.textColor = [colors.r, colors.g, colors.b] as [number, number, number];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? y) + 24;

  if (savePlays.length > 0) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y > pageHeight - 180) {
      doc.addPage();
      y = MARGIN + 12;
    }

    y = drawSectionTitle(
      doc,
      y,
      "Suggested save plays",
      "Top rule-based ideas from positive SHAP drivers. These are model-generated recommendations — not launched campaigns.",
    );

    autoTable(doc, {
      startY: y,
      head: [["Save play", "Subscribers", "Avg SHAP signal"]],
      body: savePlays.slice(0, 12).map((play, index) => [
        `${index + 1}. ${play.campaign}`,
        formatNumber(play.recommendation_count),
        formatModelSignal(play.average_estimated_impact),
      ]),
      ...tableStyles(),
      styles: { ...tableStyles().styles, fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 280 },
        1: { halign: "right", cellWidth: 90 },
        2: { halign: "right", cellWidth: 90 },
      },
    });

    y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? y) + 12;
    setTextColor(doc, COLORS.muted);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(
      "SHAP signal measures model explanation strength — not expected churn reduction from running a play.",
      MARGIN,
      y,
    );
  }

  addFooters(doc);

  const filename = `retainiq-portfolio-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
