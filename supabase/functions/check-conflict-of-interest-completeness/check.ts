// The actual Conflict of Interest Form completeness logic, split out from
// index.ts so it can be unit tested (see check.test.ts) against synthetic
// fixtures instead of only ever being exercised by a real, billed Document
// AI call.
//
// Grounded in a real correctly-filled example (provided by Christopher,
// September 2026) rather than a guess from the blank template alone. That
// example revealed "Individual submitting the form via the NUPortal" is
// left entirely blank -- name, signature, and date -- on a genuinely
// complete submission; only "Individual(s) who selected or directed the
// vendor" was filled in (alongside its own signature and date). An earlier
// version of this check required both name fields and would have wrongly
// flagged that real, complete example as missing one -- this only checks
// the one field the real example actually confirms matters.
//
// The two name fields use checkLabeledFieldsRobust (see its own header
// comment in _shared/documentAi.ts) rather than a plain formFields lookup,
// on the assumption that this form -- also Northwestern-designed, also run
// through the same generic Document AI processor -- has the same
// unreliable formFields pairing a real Contracted Services Form upload
// confirmed (its Name and Address fields never got paired at all). Not
// independently confirmed for this specific form yet, but cheap insurance
// against the same class of false positive.
//
// The three Yes/No questions are also checked, per Christopher: each row
// needs SOME mark (Yes or No, doesn't matter which) or it's flagged as
// unanswered -- deliberately not trying to tell Yes apart from No, only
// "was this touched at all," which needs far less precision than
// distinguishing the two. There's no printed checkbox glyph here the way
// the W-9's tax classification has (see checkTaxClassificationChecked in
// check-w9-completeness/check.ts) -- these are blank table cells a person
// marks by hand -- so this can't use Document AI's own checkbox
// classification either. Instead it locates each row by its own printed
// question text (via Document AI's line-level OCR, not a fixed Y
// position, so it isn't thrown off by the questions' text wrapping across
// several lines each) and checks whether any token exists in a
// Yes/No-column-shaped region around that row. The column X-range
// (YES_NO_COLUMNS_X below) IS a guess read off the page's visual layout,
// same caveat as everything else in this file: no real Document AI sample
// to calibrate against, and no confirmation yet of how Document AI even
// represents a handwritten checkmark (as OCR'd text, or not at all) --
// this is the single least-tested piece of any of the three newer checks
// and the most likely to need adjusting once it runs against a real
// upload.
//
// Still deliberately NOT checked: the Comments column (free text, no
// static label to check against), both signature/date pairs (see above),
// and the conditional COI Manager sign-off (only required when a question
// is answered "Yes," which this doesn't distinguish).
import {
  centerOf,
  checkLabeledFieldsRobust,
  extractText,
  FormField,
  Line,
  PresenceFlag,
  Token,
} from '../_shared/documentAi.ts';

// A short, unique substring of each question's printed text -- enough to
// find the right OCR'd line without matching the other two questions or
// any of the surrounding paragraphs.
const YES_NO_ROWS: { anchorText: string; label: string }[] = [
  {
    anchorText: 'employed by',
    label: 'Question 1 (Employed by / Financial Interest)',
  },
  { anchorText: 'received any gifts', label: 'Question 2 (Received Gifts)' },
  { anchorText: 'given a gift', label: 'Question 3 (Given Gifts)' },
];

// The YES/NO columns' combined horizontal span, as a fraction of page
// width -- an estimate from the page's visual layout (question column
// wide on the left, YES then NO narrow columns, Comments wide on the
// right), not measured Document AI output. See the header comment.
const YES_NO_COLUMNS_X = { xMin: 0.5, xMax: 0.67 };
// How far above/below the anchor line's own center to look for a mark --
// generous, since each question wraps across several lines and the
// matched anchor phrase may not fall exactly in the vertical middle of
// its row.
const ROW_Y_BAND = 0.035;

function checkYesNoAnswered(
  documentText: string,
  lines: Line[],
  tokens: Token[],
): PresenceFlag[] {
  const flags: PresenceFlag[] = [];
  for (const row of YES_NO_ROWS) {
    const anchorLine = lines.find((l) =>
      extractText(documentText, l.layout?.textAnchor)
        .toLowerCase()
        .includes(row.anchorText),
    );
    const center = centerOf(anchorLine?.layout?.boundingPoly);
    if (!center) {
      // Couldn't even locate the question itself -- something's more
      // wrong than "unanswered" (a non-standard copy of the form, a bad
      // scan), so this says as much rather than guessing a position.
      flags.push({
        label: row.label,
        message: "Couldn't locate this question on the page to check it.",
        box: null,
      });
      continue;
    }

    const answered = tokens.some((t) => {
      const tokenCenter = centerOf(t.layout?.boundingPoly);
      return (
        tokenCenter &&
        tokenCenter.x >= YES_NO_COLUMNS_X.xMin &&
        tokenCenter.x <= YES_NO_COLUMNS_X.xMax &&
        tokenCenter.y >= center.y - ROW_Y_BAND &&
        tokenCenter.y <= center.y + ROW_Y_BAND
      );
    });
    if (!answered) {
      flags.push({
        label: row.label,
        message: 'This question looks unanswered -- neither Yes nor No is marked.',
        box: null,
      });
    }
  }
  return flags;
}

export function checkConflictOfInterest(
  documentText: string,
  formFields: FormField[],
  lines: Line[],
  tokens: Token[],
): PresenceFlag[] {
  return [
    ...checkLabeledFieldsRobust(documentText, formFields, lines, [
      {
        matchFieldName: (n) => n.includes('proposed vendor name'),
        lineLabel: 'proposed vendor name',
        valueLocation: 'sameLine',
        label: 'Vendor Name',
        message: 'Proposed Vendor Name looks blank.',
      },
      {
        matchFieldName: (n) => n.includes('selected or directed the vendor'),
        lineLabel: 'selected or directed the vendor',
        valueLocation: 'sameLine',
        label: 'Selected/Directed By',
        message:
          'The name of the individual(s) who selected or directed the vendor looks blank.',
      },
    ]),
    ...checkYesNoAnswered(documentText, lines, tokens),
  ];
}
