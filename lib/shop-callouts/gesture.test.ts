import { describe, expect, it } from 'vitest';
import {
  DOUBLE_RIGHT_CLICK_MS,
  DOUBLE_RIGHT_CLICK_PX,
  isDoubleRightClick,
  stepRightClick,
  type RightClickMark,
} from './gesture';

const mark = (x: number, y: number, at: number): RightClickMark => ({ x, y, at });

describe('the double-right-click gesture', () => {
  it('uses the numbers the prompt specified', () => {
    // Asserted rather than left as a literal, so a future "feels better at
    // 600ms" change is a decision somebody has to make here on purpose.
    expect(DOUBLE_RIGHT_CLICK_MS).toBe(400);
    expect(DOUBLE_RIGHT_CLICK_PX).toBe(8);
  });

  it('fires for two clicks inside 400ms and 8px', () => {
    expect(isDoubleRightClick(mark(100, 100, 1000), mark(103, 102, 1250))).toBe(true);
  });

  it('is inclusive at exactly 400ms and exactly 8px', () => {
    expect(isDoubleRightClick(mark(100, 100, 1000), mark(100, 100, 1400))).toBe(true);
    expect(isDoubleRightClick(mark(100, 100, 1000), mark(108, 100, 1100))).toBe(true);
  });

  it('does not fire at 401ms', () => {
    expect(isDoubleRightClick(mark(100, 100, 1000), mark(100, 100, 1401))).toBe(false);
  });

  it('does not fire when the hand moved more than 8px', () => {
    // 9px straight, and 8.06px diagonally — the diagonal case is the one an
    // axis-only check would wrongly accept.
    expect(isDoubleRightClick(mark(100, 100, 1000), mark(109, 100, 1100))).toBe(false);
    expect(isDoubleRightClick(mark(100, 100, 1000), mark(106, 106, 1100))).toBe(false);
  });

  it('never fires on the first click', () => {
    expect(isDoubleRightClick(null, mark(10, 10, 1))).toBe(false);
  });

  it('refuses a backwards timestamp instead of accepting it', () => {
    // dt = -100. A naive `dt > windowMs` check passes this, and a synthesised
    // or clock-shifted event would place a note nobody asked for.
    expect(isDoubleRightClick(mark(100, 100, 2000), mark(100, 100, 1900))).toBe(false);
  });

  it('remembers the latest click when it was not a double', () => {
    const step = stepRightClick(mark(0, 0, 0), mark(500, 500, 5000));
    expect(step.place).toBe(false);
    expect(step.next).toEqual(mark(500, 500, 5000));
  });

  it('clears its memory after placing, so three clicks place one note', () => {
    const first = stepRightClick(null, mark(10, 10, 100));
    expect(first.place).toBe(false);

    const second = stepRightClick(first.next, mark(11, 10, 300));
    expect(second.place).toBe(true);
    expect(second.next).toBeNull();

    // The third click 200ms later must not pair with the second.
    const third = stepRightClick(second.next, mark(11, 10, 500));
    expect(third.place).toBe(false);
  });
});
