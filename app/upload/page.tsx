'use client';

import { useState, useCallback } from 'react';

type UploadState = 'idle' | 'uploading' | 'processing' | 'results' | 'partial' | 'failed';
type Confidence = 'high' | 'medium' | 'low';

interface TakeoffItem {
  profileType:  string;
  material:     string | null;
  gauge:        string | null;
  finish:       string | null;
  width:        number | null;
  height:       number | null;
  legA:         number | null;
  legB:         number | null;
  lengthFt:     number;
  quantity:     number;
  unit:         string;
  confidence:   Confidence;
  aiNote:       string | null;
}

interface TakeoffResult {
  items:              TakeoffItem[];
  processingNotes:    string | null;
  overallConfidence:  Confidence;
  status:             'success' | 'partial' | 'failed';
}

export default function UploadPage() {
  const [state, setState]       = useState<UploadState>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult]     = useState<TakeoffResult | null>(null);
  const [items, setItems]       = useState<TakeoffItem[]>([]);
  const [stage, setStage]       = useState(0);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFilename(file.name);
    setState('uploading');
    setStage(0);

    if (file.size > 50 * 1024 * 1024) {
      setError(`File exceeds 50MB.`);
      setState('failed');
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const accepted = ['.dwg','.dxf','.pdf','.png','.jpg','.jpeg','.tiff','.tif','.webp'];
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

      if (!takeoffRes.ok) {
        setError('AI processing failed. Please try a different file.');
        setState('failed');
        return;
      }

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

  const confidenceBadge = (c: Confidence) => {
    const styles = {
      high:   'text-afs-success border-afs-success',
      medium: 'text-afs-warning border-afs-warning',
      low:    'text-afs-crimson border-afs-crimson',
    };
    return `font-label text-xs border px-2 py-0.5 rounded ${styles[c]}`;
  };

  const stages = [
    'Reading your drawing...',
    'Identifying flashing profiles...',
    'Calculating quantities...',
    'Building your specification...',
  ];

  return (
    <main className="min-h-screen bg-afs-bg-base py-16 px-6">
      <div className="max-w-5xl mx-auto">

        <div className="mb-12 text-center">
          <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-4">
            BLUEPRINT TAKEOFF AI
          </p>
          <h1 className="font-display text-7xl text-afs-chrome-high leading-none mb-4">
            UPLOAD YOUR DRAWING
          </h1>
          <p className="font-body text-afs-chrome-mid text-lg max-w-xl mx-auto">
            Upload a construction drawing and our AI extracts every flashing
            profile, dimension, and quantity automatically.
          </p>
        </div>

        {state === 'idle' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => document.getElementById('file-input')?.click()}
            className={`border-2 border-dashed rounded p-20 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-afs-crimson bg-afs-bg-overlay'
                : 'border-afs-chrome-dim hover:border-afs-chrome-base bg-afs-bg-raised'
            }`}
          >
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <svg className="w-16 h-16 mx-auto text-afs-chrome-mid mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="font-heading text-2xl text-afs-chrome-high mb-2">Drop your drawing here</p>
            <p className="font-body text-afs-chrome-mid text-sm mb-8">or click to browse</p>
            <div className="flex gap-3 justify-center flex-wrap mb-4">
              {['DWG','DXF','PDF','PNG','JPG','TIFF'].map(f => (
                <span key={f} className="font-data text-sm text-afs-chrome-high border border-afs-chrome-base bg-afs-bg-surface px-3 py-1.5 rounded font-semibold">
                  {f}
                </span>
              ))}
            </div>
            <p className="font-body text-xs text-afs-chrome-base mt-4">Maximum 50MB</p>
          </div>
        )}

        {state === 'uploading' && (
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-12 text-center">
            <p className="font-label text-afs-chrome-mid text-sm uppercase tracking-wide mb-6">
              Uploading {filename}...
            </p>
            <div className="w-full bg-afs-bg-surface rounded-full h-1">
              <div className="bg-afs-crimson h-1 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {state === 'processing' && (
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-12 max-w-lg mx-auto">
            <p className="font-label text-afs-chrome-mid text-sm uppercase tracking-wide mb-8 text-center">
              AI Processing — {filename}
            </p>
            <div className="space-y-5">
              {stages.map((s, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    i < stage ? 'bg-afs-crimson' :
                    i === stage ? 'bg-afs-crimson animate-pulse' :
                    'border border-afs-chrome-dim'
                  }`} />
                  <span className={`font-body text-sm ${i <= stage ? 'text-afs-chrome-high' : 'text-afs-chrome-dim'}`}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
            <p className="font-body text-xs text-afs-chrome-base text-center mt-8">
              Usually takes 30–90 seconds. Do not close this tab.
            </p>
          </div>
        )}

        {state === 'results' && result && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-heading text-3xl text-afs-chrome-high">Extraction Results</h2>
                <p className="font-body text-afs-chrome-base text-sm mt-1">
                  {items.length} items identified from {filename}
                </p>
              </div>
              <span className={confidenceBadge(result.overallConfidence)}>
                {result.overallConfidence.toUpperCase()} CONFIDENCE
              </span>
            </div>

            {result.processingNotes && (
              <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-4 mb-6 font-body text-sm text-afs-chrome-mid">
                {result.processingNotes}
              </div>
            )}

            <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-afs-bg-surface border-b border-afs-chrome-dim">
                    {['#','Profile','Material','Gauge','Dimensions (in)','Length (ft)','Qty','Confidence',''].map(h => (
                      <th key={h} className="font-heading text-xs text-afs-chrome-mid uppercase tracking-wide text-left px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className={`border-b border-afs-chrome-dim hover:bg-afs-bg-surface transition-colors ${
                      item.confidence === 'low' ? 'border-l-2 border-l-yellow-500' : ''
                    }`}>
                      <td className="font-data text-afs-chrome-base px-4 py-3">{i + 1}</td>
                      <td className="px-4 py-3">
                        <input value={item.profileType} onChange={(e) => updateItem(i, 'profileType', e.target.value)}
                          className="bg-transparent font-body text-afs-chrome-high w-full focus:outline-none" />
                        {item.aiNote && <p className="font-body text-xs text-afs-chrome-base mt-0.5">{item.aiNote}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <input value={item.material ?? ''} onChange={(e) => updateItem(i, 'material', e.target.value)}
                          className="bg-transparent font-body text-afs-chrome-mid w-full focus:outline-none" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={item.gauge ?? ''} onChange={(e) => updateItem(i, 'gauge', e.target.value)}
                          className="bg-transparent font-data text-xs text-afs-chrome-mid w-20 focus:outline-none" />
                      </td>
                      <td className="px-4 py-3 font-data text-xs text-afs-chrome-mid">
                        {[item.width ? `W:${item.width}"` : null, item.height ? `H:${item.height}"` : null,
                          item.legA ? `A:${item.legA}"` : null, item.legB ? `B:${item.legB}"` : null].filter(Boolean).join(' ')}
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" value={item.lengthFt} onChange={(e) => updateItem(i, 'lengthFt', parseFloat(e.target.value))}
                          className="bg-transparent font-data text-afs-chrome-mid w-16 focus:outline-none" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value))}
                          className="bg-transparent font-data text-afs-chrome-mid w-12 focus:outline-none" />
                      </td>
                      <td className="px-4 py-3">
                        <span className={confidenceBadge(item.confidence)}>{item.confidence}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => removeItem(i)}
                          className="text-afs-chrome-base hover:text-afs-crimson text-xs font-body transition-colors">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4 flex-wrap">
              <button className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-8 py-4 rounded text-sm transition-colors">
                Submit Quote Request
              </button>
              <button onClick={() => { setState('idle'); setResult(null); setItems([]); }}
                className="border border-afs-chrome-dim text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-afs-chrome-high font-label font-semibold px-6 py-4 rounded text-sm transition-colors">
                Start Over
              </button>
              <a href="/quote"
                className="border border-afs-chrome-dim text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-afs-chrome-high font-label font-semibold px-6 py-4 rounded text-sm transition-colors">
                Build Quote Manually
              </a>
            </div>
          </div>
        )}

        {state === 'failed' && (
          <div className="bg-afs-bg-raised border border-afs-crimson rounded p-8 max-w-lg mx-auto">
            <h2 className="font-heading text-xl text-afs-chrome-high mb-2">Upload Failed</h2>
            <p className="font-body text-afs-chrome-mid text-sm mb-6">{error ?? 'Something went wrong.'}</p>
            <div className="flex gap-4">
              <button onClick={() => { setState('idle'); setError(null); }}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors">
                Try Again
              </button>
              <a href="/quote"
                className="border border-afs-chrome-dim text-afs-chrome-mid font-label font-semibold px-6 py-3 rounded text-sm transition-colors">
                Build Quote Manually
              </a>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}