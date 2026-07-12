'use client';

import { useState, useCallback } from 'react';

type UploadState = 'idle' | 'uploading' | 'processing' | 'results' | 'failed';
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

export default function UploadPage() {
  const [state, setState] = useState<UploadState>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<TakeoffResult | null>(null);
  const [items, setItems] = useState<TakeoffItem[]>([]);
  const [stage, setStage] = useState(0);

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

  const updateItem = (index: number, field: keyof TakeoffItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const stages = [
    'Reading your drawing...',
    'Identifying flashing profiles...',
    'Calculating quantities...',
    'Building your specification...',
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#2A2D35', padding: '64px 32px 32px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ fontFamily: 'var(--font-barlow)', fontSize: '11px', letterSpacing: '4px', textTransform: 'uppercase', color: '#C0001A', marginBottom: '12px' }}>
            BLUEPRINT TAKEOFF AI
          </p>
          <h1 style={{ fontFamily: 'var(--font-bebas)', fontSize: '72px', lineHeight: 1, color: '#FFFFFF', marginBottom: '16px' }}>
            UPLOAD YOUR DRAWING
          </h1>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '16px', color: '#B8BFD0', maxWidth: '520px', margin: '0 auto' }}>
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
              border: `2px dashed ${dragOver ? '#C0001A' : '#7A8299'}`,
              borderRadius: '8px',
              padding: '80px 40px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: dragOver ? 'rgba(192,0,26,0.08)' : '#363C4A',
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
            <svg style={{ width: '56px', height: '56px', margin: '0 auto 24px', color: '#9AA0B8', display: 'block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '24px', color: '#FFFFFF', marginBottom: '8px' }}>
              Drop your drawing here
            </p>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: '#9AA0B8', marginBottom: '32px' }}>
              or click to browse
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              {['DWG', 'DXF', 'PDF', 'PNG', 'JPG', 'TIFF'].map(f => (
                <span key={f} style={{
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  backgroundColor: '#4E5568',
                  border: '1px solid #7A8299',
                  borderRadius: '4px',
                  padding: '6px 12px',
                }}>
                  {f}
                </span>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: '#7A8299' }}>
              Maximum 50MB
            </p>
          </div>
        )}

        {/* UPLOADING */}
        {state === 'uploading' && (
          <div style={{ backgroundColor: '#363C4A', border: '1px solid #4E5568', borderRadius: '8px', padding: '48px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-barlow)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', color: '#B8BFD0', marginBottom: '24px' }}>
              Uploading {filename}...
            </p>
            <div style={{ backgroundColor: '#2A2D35', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#C0001A', height: '100%', width: '66%', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
            </div>
          </div>
        )}

        {/* PROCESSING */}
        {state === 'processing' && (
          <div style={{ backgroundColor: '#363C4A', border: '1px solid #4E5568', borderRadius: '8px', padding: '48px', maxWidth: '520px', margin: '0 auto' }}>
            <p style={{ fontFamily: 'var(--font-barlow)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', color: '#B8BFD0', marginBottom: '32px', textAlign: 'center' }}>
              AI Processing — {filename}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {stages.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: i <= stage ? '#C0001A' : 'transparent',
                    border: i <= stage ? 'none' : '1px solid #4E5568',
                  }} />
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: i <= stage ? '#FFFFFF' : '#7A8299' }}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: '#7A8299', textAlign: 'center', marginTop: '32px' }}>
              Usually takes 30–90 seconds. Do not close this tab.
            </p>
          </div>
        )}

        {/* RESULTS */}
        {state === 'results' && result && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '32px', color: '#FFFFFF', marginBottom: '4px' }}>
                  Extraction Results
                </h2>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#9AA0B8' }}>
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
                border: `1px solid ${result.overallConfidence === 'high' ? '#1E8A52' : result.overallConfidence === 'medium' ? '#C48A00' : '#C0001A'}`,
                color: result.overallConfidence === 'high' ? '#1E8A52' : result.overallConfidence === 'medium' ? '#C48A00' : '#C0001A',
              }}>
                {result.overallConfidence.toUpperCase()} CONFIDENCE
              </span>
            </div>

            {result.processingNotes && (
              <div style={{ backgroundColor: '#363C4A', border: '1px solid #4E5568', borderRadius: '6px', padding: '16px', marginBottom: '24px' }}>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#B8BFD0' }}>{result.processingNotes}</p>
              </div>
            )}

            <div style={{ backgroundColor: '#363C4A', border: '1px solid #4E5568', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#404858' }}>
                    {['#', 'Profile', 'Material', 'Gauge', 'Dimensions', 'Length (ft)', 'Qty', 'Confidence', ''].map(h => (
                      <th key={h} style={{ fontFamily: 'var(--font-barlow)', fontSize: '11px', color: '#9AA0B8', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #4E5568' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #404858', borderLeft: item.confidence === 'low' ? '3px solid #C48A00' : '3px solid transparent' }}>
                      <td style={{ padding: '12px 16px', color: '#7A8299', fontFamily: 'var(--font-jetbrains)' }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <input value={item.profileType} onChange={(e) => updateItem(i, 'profileType', e.target.value)}
                          style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontFamily: 'var(--font-inter)', fontSize: '13px', width: '100%', outline: 'none' }} />
                        {item.aiNote && <p style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: '#7A8299', marginTop: '2px' }}>{item.aiNote}</p>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <input value={item.material ?? ''} onChange={(e) => updateItem(i, 'material', e.target.value)}
                          style={{ background: 'transparent', border: 'none', color: '#B8BFD0', fontFamily: 'var(--font-inter)', fontSize: '13px', width: '100%', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <input value={item.gauge ?? ''} onChange={(e) => updateItem(i, 'gauge', e.target.value)}
                          style={{ background: 'transparent', border: 'none', color: '#B8BFD0', fontFamily: 'var(--font-jetbrains)', fontSize: '12px', width: '80px', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-jetbrains)', fontSize: '12px', color: '#B8BFD0' }}>
                        {[item.width ? `W:${item.width}"` : null, item.height ? `H:${item.height}"` : null, item.legA ? `A:${item.legA}"` : null, item.legB ? `B:${item.legB}"` : null].filter(Boolean).join(' ')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <input type="number" value={item.lengthFt} onChange={(e) => updateItem(i, 'lengthFt', parseFloat(e.target.value))}
                          style={{ background: 'transparent', border: 'none', color: '#B8BFD0', fontFamily: 'var(--font-jetbrains)', fontSize: '13px', width: '60px', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value))}
                          style={{ background: 'transparent', border: 'none', color: '#B8BFD0', fontFamily: 'var(--font-jetbrains)', fontSize: '13px', width: '50px', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontFamily: 'var(--font-barlow)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: '3px',
                          border: `1px solid ${item.confidence === 'high' ? '#1E8A52' : item.confidence === 'medium' ? '#C48A00' : '#C0001A'}`,
                          color: item.confidence === 'high' ? '#1E8A52' : item.confidence === 'medium' ? '#C48A00' : '#C0001A',
                        }}>
                          {item.confidence}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => removeItem(i)}
                          style={{ background: 'none', border: 'none', color: '#7A8299', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-inter)' }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button style={{ backgroundColor: '#C0001A', color: '#FFFFFF', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 32px', borderRadius: '6px', border: 'none', cursor: 'pointer', letterSpacing: '1px' }}>
                Submit Quote Request
              </button>
              <button onClick={() => { setState('idle'); setResult(null); setItems([]); }}
                style={{ backgroundColor: '#4E5568', color: '#FFFFFF', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 24px', borderRadius: '6px', border: '1px solid #7A8299', cursor: 'pointer' }}>
                Start Over
              </button>
              <a href="/quote"
                style={{ backgroundColor: '#4E5568', color: '#FFFFFF', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '14px 24px', borderRadius: '6px', border: '1px solid #7A8299', textDecoration: 'none', display: 'inline-block' }}>
                Build Quote Manually
              </a>
            </div>
          </div>
        )}

        {/* FAILED */}
        {state === 'failed' && (
          <div style={{ backgroundColor: '#363C4A', border: '1px solid #C0001A', borderRadius: '8px', padding: '40px', maxWidth: '520px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-barlow-condensed)', fontSize: '24px', color: '#FFFFFF', marginBottom: '8px' }}>Upload Failed</h2>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: '#B8BFD0', marginBottom: '24px' }}>{error ?? 'Something went wrong.'}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setState('idle'); setError(null); }}
                style={{ backgroundColor: '#C0001A', color: '#FFFFFF', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '12px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                Try Again
              </button>
              <a href="/quote"
                style={{ backgroundColor: '#4E5568', color: '#FFFFFF', fontFamily: 'var(--font-barlow)', fontWeight: 600, fontSize: '14px', padding: '12px 24px', borderRadius: '6px', border: '1px solid #7A8299', textDecoration: 'none', display: 'inline-block' }}>
                Build Quote Manually
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
