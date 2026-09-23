import React, { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { mapService, type AddressSuggestion } from "../services/mapService";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value, onChange, onSelect, placeholder = "Adres ara...", className = "",
  disabled = false, required = false, id,
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const results = await mapService.searchAddressSuggestions(query);
        if (requestId !== requestIdRef.current) return;
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.warn("OpenStreetMap adres önerileri alınamadı:", error);
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [value]);

  const handleSelect = async (suggestion: AddressSuggestion) => {
    setDetailsLoading(true);
    try {
      const selected = await mapService.resolveAddressSuggestion(suggestion);
      onChange(selected.formattedAddress || selected.displayName);
      onSelect?.(selected);
      setSuggestions([]);
      setOpen(false);
    } catch (error) {
      console.warn("Adres detayları alınamadı:", error);
      onChange(suggestion.formattedAddress || suggestion.displayName);
      onSelect?.(suggestion);
      setSuggestions([]);
      setOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          required={required}
          disabled={disabled || detailsLoading}
          value={value}
          onChange={(event) => { onChange(event.target.value); setOpen(true); }}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          onBlur={() => { window.setTimeout(() => setOpen(false), 160); }}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          placeholder={placeholder}
          autoComplete="off"
          className={className}
        />
        {(loading || detailsLoading) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#D6A84F]" size={16} />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-[#3A3A42] bg-[#111116] p-1 shadow-2xl">
          {suggestions.map((suggestion, index) => (
            <button
              key={(suggestion.placeId || suggestion.displayName) + "-" + index}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void handleSelect(suggestion)}
              className="flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#222229]"
            >
              <MapPin className="mt-0.5 shrink-0 text-[#D6A84F]" size={15} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-5 text-white">
                  {suggestion.displayName}
                </span>
                {suggestion.kind === "neighborhood" && (
                  <span className="mt-0.5 block text-[10px] text-emerald-300">
                    MAHALLE • Gerçek OSM adres verisi
                  </span>
                )}
                {suggestion.kind === "street" && (
                  <span className="mt-0.5 block text-[10px] text-emerald-300">
                    SOKAK / CADDE • {suggestion.street || suggestion.name}
                  </span>
                )}
                {suggestion.streetNumber && suggestion.street && (
                  <span className="mt-0.5 block text-[10px] text-emerald-300">
                    GERÇEK ADRES • {suggestion.street} No: {suggestion.streetNumber}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-[#2A2A31] px-3 py-2 text-[9px] text-white/40">
          © OpenStreetMap contributors
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
