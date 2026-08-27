import styles from './TimelineLineSegment.module.css';

interface TimelineLineSegmentProps {
  revealed: boolean;
}

// A sliver of the central vertical line, exactly as tall as its own grid
// row. Every row (quarter heading, month label, task marker) renders one of
// these in the shared center column; because rows stack with no gap, the
// slivers concatenate into one continuous line with no height computed up
// front. Each sliver shares its row's own reveal state, but "extends"
// downward (scaleY) rather than fading -- distinct from the fade/rise used
// for headings/labels/markers, so the line itself visibly draws in.
export const TimelineLineSegment = ({ revealed }: TimelineLineSegmentProps) => (
  <div
    className={styles['wl-line-segment']}
    data-revealed={revealed ? 'true' : undefined}
    aria-hidden="true"
  />
);
