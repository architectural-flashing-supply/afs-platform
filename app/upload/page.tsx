'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';

const MM_PER_INCH = 25.4;
const DEFAULT_DIMENSIONS_IN = { width: 12, legA: 2, legB: 2 };

// The AI takeoff extracts width/height/legA/legB per line item, not a
// linked machine_profile record — there is no "matched profile" to look
// up. This builds an illustrative 3-segment, two-90°-bend cross-section
// from the item's own extracted dimensions (falling back to generic
// defaults when a dimension wasn't captured), the same 90°-corner
// assumption lib/utils/profile-svg.ts already makes for these fields.
function buildBendsFromItem(item: TakeoffItem): { bends: ProfileBend[]; blankWidthMm: number } {
  const legAIn = item.legA ?? DEFAULT_DIMENSIONS_IN.legA;
  const legBIn = item.legB ?? DEFAULT_DIMENSIONS_IN.legB;
  const widthIn = item.width ?? item.height ?? DEFAULT_DIMENSIONS_IN.width;

  const legAMm = legAIn * MM_PER_INCH;
  const legBMm = legBIn * MM_PER_INCH;
  const widthMm = widthIn * MM_PER_INCH;

  const bends: ProfileBend[] = [
    { leftLeg: legAMm, rightLeg: 0, angle: 90, radius: 0 },
    { leftLeg: widthMm, rightLeg: legBMm, angle: 90, radius: 0 },
  ];

  return { bends, blankWidthMm: legAMm + widthMm + legBMm };
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'results' | 'submitting' | 'submitted' | 'failed';
type Confidence = 'high' | 'medium' | 'low';

interface TakeoffItem {
  profileType: string;
  material: string | null;
  gauge: string | null;
  finish: string | null;
  width: number | null;
  height: number | null;
  legA: number | null;
  legB: number | null;
  lengthFt: number;
  quantity: number;
  unit: string;
  confidence: Confidence;
  aiNote: string | null;
}

interface TakeoffResult {
  items: TakeoffItem[];
  processingNotes: string | null;
  overallConfidence: Confidence;
  status: 'success' | 'partial' | 'failed';
}

interface QuoteRequestSuccessResponse {
  requestId: string;
  requestNumber: string;
}

interface QuoteRequestErrorResponse {
  error: string;
}

export default function UploadPage() {
  const [state, setState] = useState<UploadState>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<TakeoffResult | null>(null);
  const [items, setItems] = useState<TakeoffItem[]>([]);
  const [stage, setStage] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFilename(file.name);
    setState('uploading');
    setStage(0);

    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds 50MB.');
      setState('failed');
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const accepted = ['.dwg', '.dxf', '.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.webp'];
    if (!accepted.includes(ext)) {
      setError(`${ext.toUpperCase()} is not supported.`);
      setState('failed');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) { setError(uploadData.error); setState('failed'); return; }

    setState('processing');
    setStage(1);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setStage(2);
      const takeoffRes = await fetch('/api/takeoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, fileType: ext, filename: file.name }),
      });
      setStage(3);
      const takeoffData: TakeoffResult = await takeoffRes.json();
      if (!takeoffRes.ok) { setError('AI processing failed.'); setState('failed'); return; }
      setResult(takeoffData);
      setItems(takeoffData.items);
      setState(takeoffData.items?.length === 0 ? 'failed' : 'results');
    };
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const updateItem = <K extends keyof TakeoffItem>(index: number, field: K, value: TakeoffItem[K]) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const submitQuoteRequest = useCallback(async (email?: string) => {
    setSubmitError(null);
    setState('submitting');
    try {
      const res = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, isRush: false, guestEmail: email }),
      });
      const data = (await res.json()) as QuoteRequestSuccessResponse | QuoteRequestErrorResponse;
      if (!res.ok) {
        setSubmitError('error' in data ? data.error : 'Submission failed. Please try again.');
        setState('results');
        return;
      }
      const success = data as QuoteRequestSuccessResponse;
      setRequestNumber(success.requestNumber);
      setShowEmailCapture(false);
      setState('submitted');
    } catch {
      setSubmitError('Submission failed. Please try again.');
      setState('results');
    }
  }, [items]);

  const handleSubmitClick = () => {
    if (items.length === 0) {
      setSubmitError('Add at least one item before submitting your request.');
      return;
    }
    if (isAuthenticated) {
      submitQuoteRequest();
    } else {
      setSubmitError(null);
      setShowEmailCapture(true);
    }
  };

  const handleGuestSubmit = () => {
    const trimmed = guestEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setSubmitError('Enter a valid email address.');
      return;
    }
    submitQuoteRequest(trimmed);
  };

  const resetToIdle = () => {
    setState('idle');
    setResult(null);
    setItems([]);
    setSubmitError(null);
    setShowEmailCapture(false);
    setGuestEmail('');
    setRequestNumber(null);
  };

  const stages = [
    'Reading your drawing...',
    'Identifying flashing profiles...',
    'Calculating quantities...',
    'Building your specification...',
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--afs-bg-base)', padding: '64px 32px 32px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ fontFamily: 'var(--font-barlow)', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase', color: 'var(--afs-crimson)', marginBottom: '12px' }}>
            BLUEPRINT TAKEOFF AI
          </p>
          <h1 style={{ fontFamily: 'var(--font-bebas)', fontSize: '72px', lineHeight: 1, color: 'var(--afs-chrome-high)', marginBottom: '16px' }}>
            UPLOAD YOUR DRAWING
          </h1>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '16px', color: 'var(--afs-chrome-mid)', maxWidth: '520px', margin: '0 auto' }}>
            Upload a construction drawing and our AI extracts every flashing profile, dimension, and quantity automatically.
          </p>
        </div>

        {/* IDLE */}
        {state === 'idle' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => document.getElementById('file-input')?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--afs-crimson)' : 'var(--afs-chrome-dim)'}`,
              borderRadius: '8px',
              padding: '80px 40px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: dragOver ? 'var(--afs-crimson-ghost)' : 'var(--afs-bg-raised)',
              transition: 'all 0.2s',
            }}
          >
            <input
              id="file-input"
              type="file"
              style={{ display: 'none' }}
              accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <svg style={{ width: '56px', height: '56px', margin: '0 auto 24px', color: 'var(--afs-chrome-base)', display: 'block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '24px', color: 'var(--afs-chrome-high)', marginBottom: '8px' }}>
              Drop your drawing here
            </p>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'var(--afs-chrome-base)', marginBottom: '32px' }}>
              or click to browse
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              {['DWG', 'DXF', 'PDF', 'PNG', 'JPG', 'TIFF'].map(f => (
                <span key={f} style={{
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--afs-chrome-high)',
                  backgroundColor: 'var(--afs-bg-overlay)',
                  border: '1px solid var(--afs-chrome-dim)',
                  borderRadius: '4px',
                  padding: '6px 12px',
                }}>
                  {f}
                </span>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'var(--afs-chrome-dim)' }}>
              Maximum 50MB
            </p>
          </div>
        )}

        {/* UPLOADING */}
        {state === 'uploading' && (
          <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', padding: '48px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-barlow)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--afs-chrome-mid)', marginBottom: '24px' }}>
              Uploading {filename}...
            </p>
            <div style={{ backgroundColor: 'var(--afs-bg-base)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: 'var(--afs-crimson)', height: '100%', width: '66%', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
            </div>
          </div>
        )}

        {/* PROCESSING */}
        {state === 'processing' && (
          <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', padding: '48px', maxWidth: '520px', margin: '0 auto' }}>
            <p style={{ fontFamily: 'var(--font-barlow)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--afs-chrome-mid)', marginBottom: '32px', textAlign: 'center' }}>
              AI Processing — {filename}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {stages.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: i <= stage ? 'var(--afs-crimson)' : 'transparent',
                    border: i <= stage ? 'none' : '1px solid var(--afs-bg-overlay)',
                  }} />
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: i <= stage ? 'var(--afs-chrome-high)' : 'var(--afs-chrome-dim)' }}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'var(--afs-chrome-dim)', textAlign: 'center', marginTop: '32px' }}>
              Usually takes 30–90 seconds. Do not close this tab.
            </p>
          </div>
        )}

        {/* RESULTS */}
        {(state === 'results' || state === 'submitting') && result && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '32px', color: 'var(--afs-chrome-high)', marginBottom: '4px' }}>
                  Extraction Results
                </h2>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'var(--afs-chrome-base)' }}>
                  {items.length} items identified from {filename}
                </p>
              </div>
              <span style={{
                fontFamily: 'var(--font-barlow)',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '4px',
                border: `1px solid ${result.overallConfidence === 'high' ? 'var(--afs-success)' : result.overallConfidence === 'medium' ? 'var(--afs-warning)' : 'var(--afs-crimson)'}`,
                color: result.overallConfidence === 'high' ? 'var(--afs-success)' : result.overallConfidence === 'medium' ? 'var(--afs-warning)' : 'var(--afs-crimson)',
              }}>
                {result.overallConfidence.toUpperCase()} CONFIDENCE
              </span>
            </div>

            {result.processingNotes && (
              <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '6px', padding: '16px', marginBottom: '24px' }}>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'var(--afs-chrome-mid)' }}>{result.processingNotes}</p>
              </div>
            )}

            <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--afs-bg-surface)' }}>
                    {['#', 'Profile', 'Material', 'Gauge', 'Dimensions', 'Length (ft)', 'Qty', 'Confidence', ''].map(h => (
                      <th key={h} style={{ fontFamily: 'var(--font-barlow)', fontSize: '11px', color: 'var(--afs-chrome-base)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--afs-bg-overlay)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--afs-bg-surface)', borderLeft: item.confidence === 'low' ? '3px solid var(--afs-warning)' : '3px solid transparent' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--afs-chrome-dim)', fontFamily: 'var(--font-jetbrains)' }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input value={item.profileType} disabled={state === 'submitting'} onChange={(e) => updateItem(i, 'profileType', e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-inter)', fontSize: '13px', width: '100%', outline: 'none' }} />
                          <button onClick={() => setViewingIndex(i)} type="button"
                            style={{ background: 'none', border: '1px solid var(--afs-chrome-dim)', borderRadius: '4px', color: 'var(--afs-chrome-mid)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-barlow)', padding: '3px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            View 3D
                          </button>
                        </div>
                        {item.aiNote && <p style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'var(--afs-chrome-dim)', marginTop: '2px' }}>{item.aiNote}</p>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <input value={item.material ?? ''} disabled={state === 'submitting'} onChange={(e) => updateItem(i, 'material', e.target.value)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--afs-chrome-mid)', fontFamily: 'var(--font-inter)', fontSize: '13px', width: '100%', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <input value={item.gauge ?? ''} disabled={state === 'submitting'} onChange={(e) => updateItem(i, 'gauge', e.target.value)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--afs-chrome-mid)', fontFamily: 'var(--font-jetbrains)', fontSize: '12px', width: '80px', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-jetbrains)', fontSize: '12px', color: 'var(--afs-chrome-mid)' }}>
                        {[item.width ? `W:${item.width}"` : null, item.height ? `H:${item.height}"` : null, item.legA ? `A:${item.legA}"` : null, item.legB ? `B:${item.legB}"` : null].filter(Boolean).join(' ')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <input type="number" value={item.lengthFt} disabled={state === 'submitting'} onChange={(e) => updateItem(i, 'lengthFt', parseFloat(e.target.value))}
                          style={{ background: 'transparent', border: 'none', color: 'var(--afs-chrome-mid)', fontFamily: 'var(--font-jetbrains)', fontSize: '13px', width: '60px', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <input type="number" value={item.quantity} disabled={state === 'submitting'} onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value))}
                          style={{ background: 'transparent', border: 'none', color: 'var(--afs-chrome-mid)', fontFamily: 'var(--font-jetbrains)', fontSize: '13px', width: '50px', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontFamily: 'var(--font-barlow)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: '3px',
                          border: `1px solid ${item.confidence === 'high' ? 'var(--afs-success)' : item.confidence === 'medium' ? 'var(--afs-warning)' : 'var(--afs-crimson)'}`,
                          color: item.confidence === 'high' ? 'var(--afs-success)' : item.confidence === 'medium' ? 'var(--afs-warning)' : 'var(--afs-crimson)',
                        }}>
                          {item.confidence}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => removeItem(i)} disabled={state === 'submitting'}
                          style={{ background: 'none', border: 'none', color: 'var(--afs-chrome-dim)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-inter)' }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {submitError && (
              <div style={{ backgroundColor: 'var(--afs-crimson-ghost)', border: '1px solid var(--afs-crimson)', borderRadius: '6px', padding: '14px 16px', marginBottom: '16px' }}>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'var(--afs-crimson-hover)' }}>{submitError}</p>
              </div>
            )}

            {showEmailCapture && (
              <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', padding: '20px', marginBottom: '16px', maxWidth: '480px' }}>
                <p style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '18px', color: 'var(--afs-chrome-high)', marginBottom: '6px' }}>
                  Enter your email to submit
                </p>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'var(--afs-chrome-base)', marginBottom: '14px' }}>
                  We&apos;ll send your quote request confirmation to this address.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="you@company.com"
                    style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--afs-bg-base)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '6px', padding: '10px 12px', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-inter)', fontSize: '14px', outline: 'none' }}
                  />
                  <button onClick={handleGuestSubmit} disabled={state === 'submitting'}
                    style={{ backgroundColor: 'var(--afs-crimson)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                    Submit
                  </button>
                  <button onClick={() => setShowEmailCapture(false)} disabled={state === 'submitting'}
                    style={{ backgroundColor: 'transparent', color: 'var(--afs-chrome-base)', fontFamily: 'var(--font-barlow)', fontSize: '14px', padding: '10px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button onClick={handleSubmitClick} disabled={state === 'submitting'}
                style={{ backgroundColor: state === 'submitting' ? 'var(--afs-crimson-dim)' : 'var(--afs-crimson)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 32px', borderRadius: '6px', border: 'none', cursor: state === 'submitting' ? 'default' : 'pointer', letterSpacing: '1px' }}>
                {state === 'submitting' ? 'Submitting...' : 'Submit Quote Request'}
              </button>
              <button onClick={resetToIdle} disabled={state === 'submitting'}
                style={{ backgroundColor: 'var(--afs-bg-overlay)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 24px', borderRadius: '6px', border: '1px solid var(--afs-chrome-dim)', cursor: 'pointer' }}>
                Start Over
              </button>
              <a href="/quote"
                style={{ backgroundColor: 'var(--afs-bg-overlay)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 24px', borderRadius: '6px', border: '1px solid var(--afs-chrome-dim)', textDecoration: 'none', display: 'inline-block' }}>
                Build Quote Manually
              </a>
            </div>
          </div>
        )}

        {/* SUBMITTED */}
        {state === 'submitted' && requestNumber && (
          <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', padding: '48px', maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--afs-crimson-ghost)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg style={{ width: '28px', height: '28px', color: 'var(--afs-crimson)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '28px', color: 'var(--afs-chrome-high)', marginBottom: '12px' }}>
              Quote Request Submitted
            </h2>
            <p style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '20px', color: 'var(--afs-crimson)', marginBottom: '16px' }}>
              {requestNumber}
            </p>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'var(--afs-chrome-mid)', marginBottom: '32px' }}>
              AFS will review your specifications and deliver a formal quote to your account. You&apos;ll receive an email when it&apos;s ready.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/account/quotes"
                style={{ backgroundColor: 'var(--afs-crimson)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 28px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block' }}>
                View Your Requests
              </a>
              <button onClick={resetToIdle}
                style={{ backgroundColor: 'var(--afs-bg-overlay)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 24px', borderRadius: '6px', border: '1px solid var(--afs-chrome-dim)', cursor: 'pointer' }}>
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* FAILED */}
        {state === 'failed' && (
          <div style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-crimson)', borderRadius: '8px', padding: '40px', maxWidth: '520px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '24px', color: 'var(--afs-chrome-high)', marginBottom: '8px' }}>Upload Failed</h2>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'var(--afs-chrome-mid)', marginBottom: '24px' }}>{error ?? 'Something went wrong.'}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setState('idle'); setError(null); }}
                style={{ backgroundColor: 'var(--afs-crimson)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '12px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                Try Again
              </button>
              <a href="/quote"
                style={{ backgroundColor: 'var(--afs-bg-overlay)', color: 'var(--afs-chrome-high)', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '12px 24px', borderRadius: '6px', border: '1px solid var(--afs-chrome-dim)', textDecoration: 'none', display: 'inline-block' }}>
                Build Quote Manually
              </a>
            </div>
          </div>
        )}

      </div>

      {viewingIndex !== null && items[viewingIndex] && (
        <div
          onClick={() => setViewingIndex(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: 'var(--afs-bg-raised)', border: '1px solid var(--afs-bg-overlay)', borderRadius: '8px', width: '800px', maxWidth: '100%', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--afs-bg-overlay)' }}>
              <h3 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '20px', color: 'var(--afs-chrome-high)' }}>
                {items[viewingIndex].profileType || 'Custom Profile'}
              </h3>
              <button onClick={() => setViewingIndex(null)} type="button"
                style={{ background: 'none', border: 'none', color: 'var(--afs-chrome-dim)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '4px' }}>
                ×
              </button>
            </div>
            {(() => {
              const item = items[viewingIndex];
              const { bends, blankWidthMm } = buildBendsFromItem(item);
              return (
                <ProfileViewer3D
                  bends={bends}
                  blankWidth={blankWidthMm}
                  material={item.material || 'Galvanized Steel'}
                  gauge={item.gauge || '24 ga'}
                  thicknessMm={gaugeToThicknessMm(item.gauge)}
                  profileName={item.profileType || 'Custom Profile'}
                  className="w-full h-[600px]"
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
