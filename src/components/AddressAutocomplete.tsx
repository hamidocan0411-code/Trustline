import React, { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { mapService, type AddressSuggestion } from "../services/mapService";

export interface SelectedAddressHierarchy {
  city: AddressSuggestion | null;
  district: AddressSuggestion | null;
  neighborhood: AddressSuggestion | null;
  street: AddressSuggestion | null;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  onHierarchyChange?: (hierarchy: SelectedAddressHierarchy) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value, onChange, onSelect, onHierarchyChange, placeholder = "Adres ara...", className = "",
  disabled = false, required = false, id,
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const requestIdRef = useRef(0);
  const selectedCityRef = useRef<AddressSuggestion | null>(null);
  const selectedDistrictRef = useRef<AddressSuggestion | null>(null);
  const selectedNeighborhoodRef = useRef<AddressSuggestion | null>(null);
  const selectedStreetRef = useRef<AddressSuggestion | null>(null);
  const skipNextValueSearchRef = useRef(false);

  const emitHierarchy = () => {
    onHierarchyChange?.({
      city: selectedCityRef.current,
      district: selectedDistrictRef.current,
      neighborhood: selectedNeighborhoodRef.current,
      street: selectedStreetRef.current,
    });
  };

  useEffect(() => {
    const query = value.trim();

    if (skipNextValueSearchRef.current) {
      skipNextValueSearchRef.current = false;
      return;
    }

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
        const results =
          await mapService.searchAddressSuggestions(query);

        if (requestId !== requestIdRef.current) return;

        setSuggestions(results);
        setOpen(results.length > 0);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.warn(
          "OpenStreetMap adres önerileri alınamadı:",
          error
        );
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [value]);

  const handleSelect = async (
    suggestion: AddressSuggestion
  ) => {
    const requestId = ++requestIdRef.current;
    setDetailsLoading(true);
    setSuggestions([]);
    setOpen(false);

    try {
      const selected =
        await mapService.resolveAddressSuggestion(
          suggestion
        );

      if (requestId !== requestIdRef.current) {
        return;
      }

      /*
       * İL seçildi: mevcut input'u il olarak kabul et,
       * ilçeleri bir sonraki seviye olarak getir.
       */
      if (selected.kind === "city") {
        selectedCityRef.current = selected;
        selectedDistrictRef.current = null;
        selectedNeighborhoodRef.current = null;
        selectedStreetRef.current = null;

        skipNextValueSearchRef.current = true;

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(selected);
        emitHierarchy();

        setLoading(true);

        const districts =
          await mapService.getDistrictSuggestions();

        if (
          requestId !== requestIdRef.current ||
          selectedCityRef.current !== selected
        ) {
          return;
        }

        setSuggestions(districts);
        setOpen(districts.length > 0);
        return;
      }

      /*
       * İLÇE seçildi: mahalleleri getir.
       */
      if (selected.kind === "district") {
        /*
         * İlçe seçimi, daha önce seçilmiş il bağlamını silmez.
         * Kullanıcı İstanbul → Avcılar yaptıysa city state korunur.
         */
        selectedDistrictRef.current = selected;
        selectedNeighborhoodRef.current = null;
        selectedStreetRef.current = null;

        skipNextValueSearchRef.current = true;

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(selected);
        emitHierarchy();

        setLoading(true);

        const neighborhoods =
          await mapService.getNeighborhoodSuggestionsForDistrict(
            selected
          );

        if (
          requestId !== requestIdRef.current ||
          selectedDistrictRef.current !== selected
        ) {
          return;
        }

        setSuggestions(neighborhoods);
        setOpen(neighborhoods.length > 0);
        return;
      }

      /*
       * MAHALLE seçildi: önceki sokak listesini tamamen
       * bırak ve yalnızca seçilen mahallenin sokaklarını getir.
       */
      if (selected.kind === "neighborhood") {
        selectedNeighborhoodRef.current = selected;
        selectedStreetRef.current = null;

        if (
          selected.parentDistrict
        ) {
          /*
           * Parent ilçe bilgisi zaten gerçek OSM/Nominatim
           * metadata'sından geldiği için burada tekrar tüm
           * İstanbul ilçelerini sorgulama.
           */
          selectedDistrictRef.current = {
            displayName:
              selected.parentDistrict +
              ", İstanbul, Türkiye",
            formattedAddress:
              selected.parentDistrict +
              ", İstanbul, Türkiye",
            name:
              selected.parentDistrict,
            source:
              selected.source || "openstreetmap",
            kind: "district",
            types: [
              "district",
              "administrative",
            ],
          };
        }

        skipNextValueSearchRef.current = true;

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(selected);
        emitHierarchy();

        setLoading(true);

        const streets =
          await mapService.getStreetSuggestionsForNeighborhood(
            selected
          );

        if (
          requestId !== requestIdRef.current ||
          selectedNeighborhoodRef.current !== selected
        ) {
          return;
        }

        setSuggestions(streets);
        setOpen(streets.length > 0);
        return;
      }

      /*
       * SOKAK / GERÇEK ADRES seçildi: nihai seçim.
       * Üst hiyerarşi korunur; yalnızca alt seviye değişir.
       */
      selectedStreetRef.current =
        selected.kind === "street" || selected.kind === "address"
          ? selected
          : null;

      onChange(
        selected.formattedAddress ||
          selected.displayName
      );
      onSelect?.(selected);
      emitHierarchy();
      setSuggestions([]);
      setOpen(false);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      console.warn(
        "Adres seçimi başarısız:",
        error
      );

      setSuggestions([]);
      setOpen(false);

      onChange(
        suggestion.formattedAddress ||
          suggestion.displayName
      );
      onSelect?.(suggestion);
    } finally {
      if (requestId === requestIdRef.current) {
        setDetailsLoading(false);
        setLoading(false);
      }
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
          onChange={(event) => {
            requestIdRef.current += 1;
            selectedCityRef.current = null;
            selectedDistrictRef.current = null;
            selectedNeighborhoodRef.current = null;
            selectedStreetRef.current = null;
            skipNextValueSearchRef.current = false;
            onHierarchyChange?.({
              city: null,
              district: null,
              neighborhood: null,
              street: null,
            });
            setSuggestions([]);
            onChange(event.target.value);
            setOpen(true);
          }}
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
                {suggestion.kind === "city" && (
                  <span className="mt-0.5 block text-[10px] text-emerald-300">
                    İL • İstanbul
                  </span>
                )}
                {suggestion.kind === "district" && (
                  <span className="mt-0.5 block text-[10px] text-emerald-300">
                    İLÇE • Gerçek OSM adres verisi
                  </span>
                )}
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
          <div className="border-t border-[#2A2A31] px-3 py-2 text-[9px] text-white/40">
            © OpenStreetMap contributors
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
