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

import { formatCurrency, formatDate } from '../utils/calculations';
import { ReconciliationFormData } from './debitCardReconciliationForm';

const TEMPLATE_URL = '/forms/debit-card-reconciliation.pdf';
const FILLED_COLOR = rgb(0, 0, 0.55);
const FONT_SIZE = 10;

function money(amount: number): string {
  // Values are drawn after a pre-printed "$"/"-"/"+" on the template, so
  // this omits the currency symbol and any sign -- just the number itself.
  return formatCurrency(Math.abs(amount)).replace('$', '');
}

// Only for Total Expenditures: the one "$"-prefixed field (template gives
// no sign character of its own, unlike the "-"/"+"-prefixed fields money()
// is normally used for) whose underlying value can legitimately go
// negative -- e.g. Load Balance not actually set yet in Debit Card
// Settings. That mismatch is exactly what the form's own "*Total
// Expenditures and Reconciliation Subtotal should match" note exists to
// catch, so it has to stay visible rather than silently showing the
// absolute value as if nothing were wrong.
function signedMoney(amount: number): string {
  return amount < 0 ? `-${money(amount)}` : money(amount);
}

// YYYY-MM-DD -> M/D
function monthDay(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${Number(month)}/${Number(day)}`;
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

// The form's own two Debit Card Reload checkboxes.
export type ReloadChoice = 'please-reload' | 'do-not-reload';

export async function generateReconciliationPdf(
  data: ReconciliationFormData,
  reload: ReloadChoice,
): Promise<Blob> {
  const existingPdfBytes = await fetch(TEMPLATE_URL).then((res) => {
    if (!res.ok) throw new Error('Could not load the reconciliation form template.');
    return res.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];

  draw(page, font, data.orgName, 110, 696);
  if (data.lastReconciliationDate) {
    draw(page, font, formatDate(data.lastReconciliationDate), 458, 696);
  }

  if (data.accountNumber) {
    // Template prints "2 0 ____ ____ - ____ ____ ____" -- each "____" is
    // its own single-digit box (confirmed against a rendered proof: an
    // earlier version drew each half as one continuous string starting at
    // the first box, which left the later boxes in each half empty and
    // visibly adrift from where the rest of the digits actually landed).
    // Five boxes for the five digits left after stripping the pre-printed
    // "20" (format is 20XX-XXX): two before the template's own dash, three
    // after. X positions read off each box's own position in the
    // template's text layer, not evenly interpolated.
    const acctDigits = data.accountNumber.replace(/^20/, '').replace('-', '');
    const ACCOUNT_DIGIT_XS = [164.8, 192.1, 230.3, 257.6, 284.9];
    [...acctDigits].slice(0, 5).forEach((digit, i) => {
      draw(page, font, digit, ACCOUNT_DIGIT_XS[i], 672);
    });
  }
  if (data.lastFourDigits) {
    // Same one-digit-per-box layout as the account number above.
    const LAST_FOUR_DIGIT_XS = [440.5, 467.1, 493.6, 516.0];
    [...data.lastFourDigits].slice(0, 4).forEach((digit, i) => {
      draw(page, font, digit, LAST_FOUR_DIGIT_XS[i], 672);
    });
  }

  // Inventory Control No. is left blank: SOFO no longer uses it.

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
  // The "Balance as of ______" blank only fits a month/day.
  draw(page, font, monthDay(data.balanceAsOfDate), 144, 413);
  draw(page, font, money(data.balanceAsOf), 224, 412.8);
  draw(page, font, money(data.completedReconciliationsPendingReload), 223, 388);
  draw(page, font, money(data.pendingTransactions), 224, 356.8);
  draw(page, font, signedMoney(data.totalExpenditures), 220, 331.2);

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

  // The reload amount lines only apply when asking for a reload.
  if (reload === 'please-reload') {
    draw(page, font, money(data.reconciliationSubtotal), 457, 267.2);
    draw(page, font, money(data.completedReconciliationsPendingReload), 461, 241.6);
    draw(page, font, money(data.reloadAmount), 457, 216);
  }

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
