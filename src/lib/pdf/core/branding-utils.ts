import { jsPDF } from "jspdf";
import { REPORT_COLORS } from "./base-styles";
import { logoPdf } from "@/assets/icons/logo_pdf";

interface BrandingOptions {
  reportName: string;
  farmName: string;
  gender?: string;
  totalItems?: number;
  systemName: string;
  reportDate: string;
}

const LAYOUT_CONFIG = {
  fonts: {
    base: "helvetica",
    bold: "bold",
    normal: "normal",
  },
  sizes: {
    headerDept: 10,
    headerOrg: 11,
    title: 12,
    infoLabel: 9,
    infoValue: 9,
    footer: 7.5,
  },
};

function drawNeloreLogo(doc: jsPDF, x: number, y: number): void {
  try {
    doc.addImage(logoPdf, "PNG", x, y, 36, 12, undefined, "FAST");
  } catch (error) {
    console.error("Erro ao carregar logo no PDF:", error);
  }
}

export const drawHeader = (doc: jsPDF, options: BrandingOptions) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  const marginLeft = 10;
  const marginRight = 10;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // 1. Blue Background Header Bar
    doc.setFillColor(...REPORT_COLORS.PRIMARY);
    doc.rect(0, 0, pageWidth, 23, "F");

    // 2. Logo
    drawNeloreLogo(doc, marginLeft, 4.5);

    // 3. Centralized Institutional Text
    doc.setTextColor(255, 255, 255);
    doc.setFont(LAYOUT_CONFIG.fonts.base, LAYOUT_CONFIG.fonts.bold);

    doc.setFontSize(LAYOUT_CONFIG.sizes.title);
    doc.text(options.reportName.toUpperCase(), centerX, 9, {
      align: "center",
    });

    doc.setFontSize(LAYOUT_CONFIG.sizes.headerDept);
    doc.text(
      `${
        options.farmName !== "GERAL"
          ? "Fazenda: " + options.farmName.toUpperCase()
          : "Geral"
      }`,
      centerX,
      14,
      {
        align: "center",
      }
    );

    doc.setFontSize(LAYOUT_CONFIG.sizes.infoValue);

    let unitLabel = options.gender || "";
    if (unitLabel === "M") unitLabel = "machos";
    else if (unitLabel === "F") unitLabel = "fêmeas";
    else if (unitLabel === "Ambos" || unitLabel === "Machos e Fêmeas") {
      unitLabel = options.reportName.includes("SÊMEN") ? "touros" : "animais";
    } else if (unitLabel.toUpperCase().includes("IATF")) {
      unitLabel = options.totalItems === 1 ? "IATF" : "IATFs";
    } else {
      unitLabel = unitLabel.toLowerCase();
    }

    doc.text(
      `Quantidade: ${options.totalItems} ${unitLabel}`,
      centerX,
      19,
      {
        align: "center",
      }
    );

    const isDescriptivePeriod =
      options.reportDate.toLowerCase().startsWith("todas") ||
      options.reportDate.toLowerCase().includes("datas selecionadas");

    const dateLabel = isDescriptivePeriod ? "" : "Data: ";
    doc.setFont(LAYOUT_CONFIG.fonts.base, LAYOUT_CONFIG.fonts.normal);
    const dateLabelWidth = dateLabel ? doc.getTextWidth(dateLabel) : 0;
    const dateValueWidth = doc.getTextWidth(options.reportDate);
    const totalDateWidth = dateLabelWidth + dateValueWidth;

    if (dateLabel) {
      doc.text(dateLabel, pageWidth - marginRight - totalDateWidth, 14);
    }
    doc.setFont(LAYOUT_CONFIG.fonts.base, LAYOUT_CONFIG.fonts.bold);
    doc.text(options.reportDate, pageWidth - marginRight - dateValueWidth, 14);
  }
};

export const drawFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 10;
  const marginRight = 10;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(LAYOUT_CONFIG.fonts.base, LAYOUT_CONFIG.fonts.normal);
    doc.setFontSize(LAYOUT_CONFIG.sizes.footer);
    doc.setTextColor(80, 80, 80);

    const footerY = pageHeight - 8;

    doc.text(`Nelore INDI OURO - Valoriza rebanhos`, marginLeft, footerY);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginRight, footerY, {
      align: "right",
    });
  }
};

export const generateCoverPage = (doc: jsPDF, options: BrandingOptions) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  // Center Content
  doc.setFont(LAYOUT_CONFIG.fonts.base, LAYOUT_CONFIG.fonts.bold);
  doc.setFontSize(24);
  doc.setTextColor(...REPORT_COLORS.PRIMARY);
  doc.text(options.reportName.toUpperCase(), centerX, pageHeight / 3, {
    align: "center",
  });

  doc.setFontSize(16);
  doc.setTextColor(80, 80, 80);
  doc.text(options.farmName, centerX, pageHeight / 3 + 15, { align: "center" });

  doc.setFontSize(12);
  if (options.gender) {
    doc.setFont(LAYOUT_CONFIG.fonts.base, LAYOUT_CONFIG.fonts.normal);
    doc.text(`Filtro Sexo: ${options.gender}`, centerX, pageHeight / 2, {
      align: "center",
    });
  }

  if (options.totalItems !== undefined) {
    doc.setFont(LAYOUT_CONFIG.fonts.base, LAYOUT_CONFIG.fonts.normal);
    doc.text(
      `Total de Registros: ${options.totalItems}`,
      centerX,
      pageHeight / 2 + 10,
      { align: "center" }
    );
  }

  doc.setFont(LAYOUT_CONFIG.fonts.base, LAYOUT_CONFIG.fonts.normal);
  doc.setFontSize(10);
  doc.text(`Data de Emissão: ${options.reportDate}`, centerX, pageHeight - 30, {
    align: "center",
  });
  doc.text(options.systemName, centerX, pageHeight - 20, { align: "center" });

  doc.addPage();
};
