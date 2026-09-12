// Builds synthetic Document AI page data (formFields/tokens/lines, each
// with correctly-offset textAnchors into one running document string) for
// unit tests, so the check logic in check-w9-completeness/check.ts and
// check-rso-agreement-completeness/check.ts can be tested without a real,
// billed Document AI call. Positions passed in are arbitrary unless a
// test specifically cares about them (TIN presence, tax-classification
// checkbox matching, Section 3/5 y-range disambiguation).
import type { Box, FormField, Line, Token, VisualElement } from './documentAi.ts';

export class FixtureDoc {
  text = '';

  private append(value: string) {
    const startIndex = String(this.text.length);
    this.text += value;
    return { textSegments: [{ startIndex, endIndex: String(this.text.length) }] };
  }

  // A formField's fieldName/fieldValue pairing. Omit `value` to simulate a
  // field Document AI never paired at all (what happens when that part of
  // a form is genuinely blank -- the same case FALLBACK_BOXES exists for).
  field(name: string, value?: string, nameBox?: Box, valueBox?: Box): FormField {
    const fieldName = { textAnchor: this.append(name), boundingPoly: nameBox };
    if (value === undefined) return { fieldName };
    return {
      fieldName,
      fieldValue: { textAnchor: this.append(value), boundingPoly: valueBox },
    };
  }

  token(text: string, box: Box): Token {
    return { layout: { textAnchor: this.append(text), boundingPoly: box } };
  }

  line(text: string, box: Box): Line {
    return { layout: { textAnchor: this.append(text), boundingPoly: box } };
  }

  visualElement(type: string, box: Box): VisualElement {
    return { type, layout: { boundingPoly: box } };
  }
}
