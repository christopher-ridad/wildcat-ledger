import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { Modal } from './Modal';

// A trigger button plus the modal, matching how every real consumer wires
// this up -- lets tests exercise "focus was on the trigger before opening"
// and "focus should return to the trigger on close" the way it actually
// happens in the app, not just in isolation.
const Harness = ({
  children = <button type="button">Inside</button>,
}: {
  children?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} titleId="t" title="Title">
        {children}
      </Modal>
    </>
  );
};

describe('Modal', () => {
  test('moves focus into the dialog when it opens', () => {
    render(<Harness />);
    screen.getByText('Open').focus();
    fireEvent.click(screen.getByText('Open'));

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  test('returns focus to the triggering element when it closes', () => {
    render(<Harness />);
    const openButton = screen.getByText('Open');
    openButton.focus();
    fireEvent.click(openButton);
    expect(screen.getByRole('dialog')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(openButton).toHaveFocus();
  });

  // Regression test: onClose is passed inline by every real consumer
  // (`onClose={() => setOpen(false)}`), a new function every render.
  // Reading it through a ref (rather than as an effect dependency) keeps
  // the focus-restoration effect from re-running -- and yanking focus
  // back out of the dialog -- on every parent re-render while the modal
  // stays open, not just when it actually closes.
  test('a parent re-render (new onClose reference) does not steal focus back out of the dialog', () => {
    const Wrapper = () => {
      const [open, setOpen] = useState(false);
      const [, forceRerender] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <button type="button" onClick={() => forceRerender((n) => n + 1)}>
            Re-render parent
          </button>
          <Modal isOpen={open} onClose={() => setOpen(false)} titleId="t" title="Title">
            <input aria-label="field" />
          </Modal>
        </>
      );
    };
    render(<Wrapper />);
    fireEvent.click(screen.getByText('Open'));

    const field = screen.getByLabelText('field');
    field.focus();
    expect(field).toHaveFocus();

    fireEvent.click(screen.getByText('Re-render parent'));

    expect(field).toHaveFocus();
  });

  // The dialog's own "×" close button is also a real focusable element and
  // sits before any children in DOM order (it's part of the header, which
  // renders before the body), so it -- not a child button -- is the true
  // first element in the tab cycle.
  test('Tab from the last focusable element wraps to the first (the close button)', () => {
    render(
      <Harness>
        <button type="button">Last</button>
      </Harness>,
    );
    fireEvent.click(screen.getByText('Open'));
    screen.getByText('Last').focus();

    fireEvent.keyDown(document, { key: 'Tab' });

    // jsdom doesn't actually move focus on Tab -- this only asserts the
    // handler intervened (preventDefault) and moved focus itself.
    expect(screen.getByRole('button', { name: 'Close modal' })).toHaveFocus();
  });

  test('Shift+Tab from the first focusable element (the close button) wraps to the last', () => {
    render(
      <Harness>
        <button type="button">Last</button>
      </Harness>,
    );
    fireEvent.click(screen.getByText('Open'));
    screen.getByRole('button', { name: 'Close modal' }).focus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(screen.getByText('Last')).toHaveFocus();
  });

  test('Shift+Tab from the dialog container itself (initial focus target) wraps to the last focusable element', () => {
    render(
      <Harness>
        <>
          <button type="button">First</button>
          <button type="button">Last</button>
        </>
      </Harness>,
    );
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('dialog')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(screen.getByText('Last')).toHaveFocus();
  });

  test('Escape closes the modal', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} titleId="t" title="Title">
        <button type="button">Inside</button>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
