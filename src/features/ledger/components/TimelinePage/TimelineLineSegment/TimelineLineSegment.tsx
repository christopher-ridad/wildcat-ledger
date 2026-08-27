import styles from './TimelineLineSegment.module.css';

interface TimelineLineSegmentProps {
  revealed: boolean;
}

// A sliver of the central vertical line, exactly as tall as its own grid
// row. Every row (quarter heading, month label, task marker) renders one of
// these in the shared center column; because rows stack with no gap, the
// slivers concatenate into one continuous line with no height computed up
// front.
//
// Two layers: a thin, always-visible base line (never gated by `revealed`)
// keeps the chronological path visually continuous everywhere, even before
// a section has scrolled into view -- so the reveal animation never reads
// as a gap in the timeline itself. A thicker purple overlay "extends"
// downward (scaleY) on top of it once revealed, distinct from the
// fade/rise used for headings/labels/markers, so the line's own motion
// reads as drawing itself in rather than appearing.
export const TimelineLineSegment = ({ revealed }: TimelineLineSegmentProps) => (
  <>
    <div className={styles['wl-line-segment-base']} aria-hidden="true" />
    <div
      className={styles['wl-line-segment']}
      data-revealed={revealed ? 'true' : undefined}
      aria-hidden="true"
    />
  </>
);
