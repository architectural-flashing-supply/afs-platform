import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = '', ...rest },
  ref
) {
  return (
    <div>
      {label && (
        <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`w-full bg-afs-bg-overlay border rounded px-3 py-2.5 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-50 disabled:pointer-events-none ${
          error ? 'border-afs-crimson' : 'border-afs-border'
        } ${className}`}
        {...rest}
      />
      {error && <p className="font-body text-xs text-afs-crimson mt-1">{error}</p>}
    </div>
  );
});

export default Input;
