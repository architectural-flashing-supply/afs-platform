'use client';

import { Component, type ReactNode } from 'react';

/**
 * AN IN-PAGE SECTION BOUNDARY (F-06).
 *
 * Route-segment `error.tsx` files catch a failure by replacing the WHOLE screen.
 * That is right for a page that cannot load at all, and wrong for one panel of a
 * three-column Job screen: if the profile drawing throws, the estimator should
 * still be able to read the request and send the quote. This is the boundary for
 * that case — the panel says what broke, the rest of the screen keeps working.
 *
 * It must be a class component: `componentDidCatch`/`getDerivedStateFromError`
 * are the only React API for catching a render error, and there is no hook
 * equivalent. That is also why it is separate from ErrorScreen, which is a
 * function component for the route boundaries to render.
 *
 * WHAT IT DOES NOT CATCH, so nobody mistakes it for a safety net: errors thrown
 * in event handlers, in `setTimeout`, in promises, or during server rendering of
 * a server component. It catches RENDER errors in the client subtree below it.
 */
interface Props {
  children: ReactNode;
  /** Plain-English name of the panel, e.g. "The profile". Used in the message. */
  label: string;
  /** What the user can still do. One short sentence. */
  guidance?: string;
  tone?: 'light' | 'dark';
  testId?: string;
}

interface State {
  failed: boolean;
}

const TONES = {
  // ink-700 on amber-bg measures 8.1:1; the amber border is the same
  // "something needs your attention" signal the Job screen's unsure-field
  // highlight already uses, so a broken panel reads consistently with it.
  light: 'bg-afs-amber-bg border-afs-amber-ink text-afs-amber-ink',
  // chrome-mid on bg-raised is 5.8:1.
  dark: 'bg-afs-bg-raised border-afs-amber text-afs-chrome-mid',
} as const;

export default class PanelErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // Server-side logging is not available from a client boundary, so this is
    // the browser console — deliberately the real error object, because the
    // operator-facing text below deliberately is not.
    console.error(`[PanelErrorBoundary] ${this.props.label} failed to render:`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { label, guidance, tone = 'light', testId = 'panel-error' } = this.props;
    return (
      <div data-testid={testId} className={`rounded-lg border p-5 ${TONES[tone]}`}>
        <p className="font-heading text-base">{label} could not be shown</p>
        <p className="font-body text-sm mt-2 leading-relaxed">
          {guidance ?? 'Nothing was changed. The rest of this screen still works — reload the page to try again.'}
        </p>
      </div>
    );
  }
}
