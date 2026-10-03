/**
 * generateReconciliationPdf.ts
 * Fills in SOFO's "Student Organization Debit Card Reconciliation" form
 * (public/forms/debit-card-reconciliation.pdf) with the computed numbers
 * from debitCardReconciliationForm.ts, and triggers a browser download.
 *
 * The template has no AcroForm fields (confirmed: zero annotations on
 * either page) -- it's a flat, print-and-sign form, so every value is
 * drawn as text at a fixed coordinate rather than filled into a named
 * field. Coordinates below were read directly off the template's own text
 * layer (each label's x/y), not eyeballed from a rendered image, and are
 * in PDF point space (origin at the bottom-left of a 612x792 Letter page).
 * Filled-in text is drawn in blue, distinct from the template's black
 * printed text, so it's obvious at a glance what was auto-filled versus
 * what's part of the original form -- worth a careful look before
 * printing and signing, same spirit as the Document AI completeness
 * checks being advisory rather than silently trusted.
 */

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

import { formatCurrency } from '../utils/calculations';
import { ReconciliationFormData } from './debitCardReconciliationForm';

const TEMPLATE_URL = '/forms/debit-card-reconciliation.pdf';
const FILLED_COLOR = rgb(0, 0, 0.55);
const FONT_SIZE = 10;

function money(amount: number): string {
  // Values are drawn after a pre-printed "$"/"-"/"+" on the template, so
  // this omits the currency symbol and any sign -- just the number itself.
  return formatCurrency(Math.abs(amount)).replace('$', '');
}

interface DrawOptions {
  size?: number;
}

function draw(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  options: DrawOptions = {},
) {
  if (!text) return;
  page.drawText(text, {
    x,
    y,
    size: options.size ?? FONT_SIZE,
    font,
    color: FILLED_COLOR,
  });
}

export async function generateReconciliationPdf(
  data: ReconciliationFormData,
  reload: 'please-reload' | 'do-not-reload',
): Promise<Blob> {
  const existingPdfBytes = await fetch(TEMPLATE_URL).then((res) => {
    if (!res.ok) throw new Error('Could not load the reconciliation form template.');
    return res.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];

  draw(page, font, data.orgName, 110, 696);

  if (data.accountNumber) {
    // Template already prints "2 0 ____ ____ - ____ ____ ____" -- draw the
    // two halves (after stripping the pre-printed "20") into their own
    // blanks either side of the template's own dash, not as one string
    // (which visually collided with that dash).
    const [acctFirst, acctSecond] = data.accountNumber.replace(/^20/, '').split('-');
    draw(page, font, acctFirst ?? '', 168, 672);
    draw(page, font, acctSecond ?? '', 234, 672);
  }
  draw(page, font, data.lastFourDigits ?? '', 437, 672);

  if (data.inventoryControlNumber) {
    const [first, second] = data.inventoryControlNumber.split('-');
    draw(page, font, first ?? '', 201, 650.4);
    draw(page, font, second ?? '', 360, 650.4);
  }

  // Reimbursements table: only 2 blank rows on the template itself, so
  // only the first 2 line items are itemized -- matching the real paper
  // form's own physical limit (a treasurer with more than that already
  // has to continue on a separate sheet). Row y's are hand-calibrated
  // against a rendered proof, not evenly interpolated -- an even split
  // landed row 2's baseline right on the grid line under row 1.
  const REIMBURSEMENT_ROW_YS = [558, 524];
  data.reimbursements.slice(0, 2).forEach((r, i) => {
    const y = REIMBURSEMENT_ROW_YS[i];
    draw(page, font, r.date ?? '', 100.8, y, { size: 9 });
    draw(page, font, r.description, 245.6, y, { size: 9 });
    draw(page, font, money(r.amount), 484, y);
  });
  draw(page, font, money(data.totalReimbursed), 484, 511.2);

  // Activity Summary
  draw(page, font, money(data.loadBalance), 220, 438.4);
  draw(page, font, money(data.balanceAsOf), 224, 412.8);
  draw(page, font, money(data.completedReconciliationsPendingReload), 223, 388);
  draw(page, font, money(data.pendingTransactions), 224, 356.8);
  draw(page, font, money(data.totalExpenditures), 220, 331.2);

  // Documentation Totals
  draw(page, font, money(data.authorizedCharges), 472, 438.4);
  draw(page, font, money(data.serviceFees), 472, 412.8);
  draw(page, font, money(data.totalReimbursed), 478, 387.2);
  draw(page, font, money(data.reconciliationSubtotal), 472, 362.4);

  // Debit Card Reload checkbox -- an X just to the left of whichever
  // option applies (the checkbox squares are vector graphics, not text,
  // so there's no label-derived coordinate for them the way everything
  // else above has).
  draw(page, font, 'X', reload === 'please-reload' ? 202 : 368, 300);

  draw(page, font, money(data.reconciliationSubtotal), 457, 267.2);
  draw(page, font, money(data.completedReconciliationsPendingReload), 461, 241.6);
  draw(page, font, money(data.reloadAmount), 457, 216);

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

export function downloadReconciliationPdf(blob: Blob, orgName: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${orgName.replace(/[^a-z0-9]+/gi, '-')}-debit-card-reconciliation.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);
}
