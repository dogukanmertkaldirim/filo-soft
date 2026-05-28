import { useState, useEffect } from 'react';
import { formatCurrency, parseCurrencyInput } from '../../utils/format';

interface CurrencyInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
}

export default function CurrencyInput({ label, value, onChange, error, disabled }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(formatCurrency(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setDisplayValue(raw);
  }

  function handleBlur() {
    const parsed = parseCurrencyInput(displayValue);
    onChange(parsed);
    setDisplayValue(formatCurrency(parsed));
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm text-right
            focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
            disabled:bg-slate-100 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : ''}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">TL</span>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
