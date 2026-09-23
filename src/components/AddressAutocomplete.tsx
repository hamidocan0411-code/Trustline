import React, { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import {
  mapService,
  type AddressSearchContext,
  type AddressSuggestion,
} from "../services/mapService";

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
  onHierarchyChange?: (
    hierarchy: SelectedAddressHierarchy
  ) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

const EMPTY_HIERARCHY: SelectedAddressHierarchy = {
  city: null,
  district: null,
  neighborhood: null,
  street: null,
};

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const suggestionKindOf = (
  suggestions: AddressSuggestion[]
): AddressSuggestion["kind"] => {
  const first = suggestions[0]?.kind;

  if (first === "address") return "address";
  if (first === "street") return "street";
  if (first === "neighborhood") return "neighborhood";
  if (first === "district") return "district";
  if (first === "city") return "city";

  return undefined;
};

export const AddressAutocomplete: React.FC<
  AddressAutocompleteProps
> = ({
  value,
  onChange,
  onSelect,
  onHierarchyChange,
  placeholder = "Adres ara...",
  className = "",
  disabled = false,
  required = false,
  id,
}) => {
  const [suggestions, setSuggestions] =
    useState<AddressSuggestion[]>([]);
  const [suggestionKind, setSuggestionKind] =
    useState<AddressSuggestion["kind"]>();
  const [loading, setLoading] =
    useState(false);
  const [detailsLoading, setDetailsLoading] =
    useState(false);
  const [open, setOpen] =
    useState(false);

  const requestIdRef = useRef(0);
  const suppressNextSearchRef = useRef(false);
  const contextRef =
    useRef<SelectedAddressHierarchy>(
      EMPTY_HIERARCHY
    );

  const emitHierarchy = (
    next: SelectedAddressHierarchy
  ) => {
    contextRef.current = next;
    onHierarchyChange?.(next);
  };

  const clearSelectedForRawInput = () => {
    emitHierarchy({
      ...contextRef.current,
      street: null,
      city: null,
      district: contextRef.current.district,
      neighborhood:
        contextRef.current.neighborhood,
    });
  };

  useEffect(() => {
    const query = value.trim();

    if (
      suppressNextSearchRef.current
    ) {
      suppressNextSearchRef.current =
        false;
      return;
    }

    if (query.length < 2) {
      setSuggestions([]);
      setSuggestionKind(undefined);
      setOpen(false);
      setLoading(false);
      return;
    }

    const requestId =
      ++requestIdRef.current;

    const timer =
      window.setTimeout(
        async () => {
          setLoading(true);

          try {
            const context:
              AddressSearchContext = {
              city:
                contextRef.current.city,
              district:
                contextRef.current.district,
              neighborhood:
                contextRef.current
                  .neighborhood,
              street:
                contextRef.current.street,
            };

            const results =
              await mapService.searchAddressSuggestions(
                query,
                context
              );

            if (
              requestId !==
              requestIdRef.current
            ) {
              return;
            }

            setSuggestions(results);
            setSuggestionKind(
              suggestionKindOf(
                results
              )
            );
            setOpen(
              results.length > 0
            );
          } catch (error) {
            if (
              requestId !==
              requestIdRef.current
            ) {
              return;
            }

            console.warn(
              "Adres önerileri alınamadı:",
              error
            );

            setSuggestions([]);
            setSuggestionKind(undefined);
            setOpen(false);
          } finally {
            if (
              requestId ===
              requestIdRef.current
            ) {
              setLoading(false);
            }
          }
        },
        220
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [value]);

  const handleSelect = async (
    suggestion: AddressSuggestion
  ) => {
    const requestId =
      ++requestIdRef.current;

    setDetailsLoading(true);
    setLoading(true);
    setSuggestions([]);
    setSuggestionKind(undefined);
    setOpen(false);

    try {
      const selected =
        await mapService.resolveAddressSuggestion(
          suggestion
        );

      if (
        requestId !==
        requestIdRef.current
      ) {
        return;
      }

      const current =
        contextRef.current;

      if (
        selected.kind === "city"
      ) {
        const city =
          selected;

        emitHierarchy({
          city,
          district: null,
          neighborhood: null,
          street: null,
        });

        suppressNextSearchRef.current =
          true;

        onChange(
          city.formattedAddress ||
            city.displayName
        );
        onSelect?.(city);

        const districts =
          await mapService.getDistrictSuggestions();

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setSuggestions(
          districts
        );
        setSuggestionKind(
          "district"
        );
        setOpen(
          districts.length > 0
        );
        return;
      }

      if (
        selected.kind === "district"
      ) {
        const city =
          selected.parentCity
            ? {
                displayName:
                  selected.parentCity +
                  ", Türkiye",
                formattedAddress:
                  selected.parentCity +
                  ", Türkiye",
                name:
                  selected.parentCity,
                kind: "city" as const,
                source:
                  selected.source ||
                  "openstreetmap",
              }
            : current.city;

        emitHierarchy({
          city,
          district: selected,
          neighborhood: null,
          street: null,
        });

        suppressNextSearchRef.current =
          true;

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(selected);

        const neighborhoods =
          await mapService.getNeighborhoodSuggestionsForDistrict(
            selected
          );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setSuggestions(
          neighborhoods
        );
        setSuggestionKind(
          "neighborhood"
        );
        setOpen(
          neighborhoods.length > 0
        );
        return;
      }

      if (
        selected.kind ===
        "neighborhood"
      ) {
        const district =
          selected.parentDistrict
            ? {
                displayName:
                  selected.parentDistrict +
                  ", İstanbul, Türkiye",
                formattedAddress:
                  selected.parentDistrict +
                  ", İstanbul, Türkiye",
                name:
                  selected.parentDistrict,
                kind: "district" as const,
                parentCity:
                  "İstanbul",
                source:
                  selected.source ||
                  "openstreetmap",
              }
            : current.district;

        const neighborhood =
          selected;

        emitHierarchy({
          city:
            current.city || {
              displayName:
                "İstanbul, Türkiye",
              formattedAddress:
                "İstanbul, Türkiye",
              name: "İstanbul",
              kind: "city",
              source:
                "openstreetmap",
            },
          district,
          neighborhood,
          street: null,
        });

        suppressNextSearchRef.current =
          true;

        onChange(
          neighborhood.formattedAddress ||
            neighborhood.displayName
        );
        onSelect?.(neighborhood);

        const streets =
          await mapService.getStreetSuggestionsForNeighborhood(
            neighborhood,
            district
          );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setSuggestions(streets);
        setSuggestionKind(
          "street"
        );
        setOpen(
          streets.length > 0
        );
        return;
      }

      if (
        selected.kind ===
        "street"
      ) {
        const nextHierarchy =
          {
            ...current,
            city:
              current.city ||
              {
                displayName:
                  "İstanbul, Türkiye",
                formattedAddress:
                  "İstanbul, Türkiye",
                name: "İstanbul",
                kind: "city",
                source:
                  "openstreetmap",
              },
            district:
              current.district ||
              (selected.parentDistrict
                ? {
                    displayName:
                      selected.parentDistrict +
                      ", İstanbul, Türkiye",
                    formattedAddress:
                      selected.parentDistrict +
                      ", İstanbul, Türkiye",
                    name:
                      selected.parentDistrict,
                    kind: "district",
                    parentCity:
                      "İstanbul",
                    source:
                      selected.source ||
                      "openstreetmap",
                  }
                : null),
            neighborhood:
              current.neighborhood ||
              (selected.parentNeighborhood
                ? {
                    displayName:
                      selected.parentNeighborhood +
                      " Mahallesi, " +
                      (selected.parentDistrict ||
                        "") +
                      ", İstanbul",
                    formattedAddress:
                      selected.parentNeighborhood +
                      " Mahallesi, " +
                      (selected.parentDistrict ||
                        "") +
                      ", İstanbul",
                    name:
                      selected.parentNeighborhood,
                    kind: "neighborhood",
                    parentCity:
                      "İstanbul",
                    parentDistrict:
                      selected.parentDistrict,
                    source:
                      selected.source ||
                      "openstreetmap",
                  }
                : null),
            street: selected,
          };

        emitHierarchy(
          nextHierarchy
        );

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(selected);

        const addresses =
          nextHierarchy.street &&
          nextHierarchy.neighborhood &&
          nextHierarchy.district
            ? await mapService.getAddressSuggestionsForStreet(
                selected,
                nextHierarchy.neighborhood,
                nextHierarchy.district
              )
            : [];

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        if (
          addresses.length > 0
        ) {
          setSuggestions(
            addresses
          );
          setSuggestionKind(
            "address"
          );
          setOpen(true);
        } else {
          setSuggestions([]);
          setSuggestionKind(
            undefined
          );
          setOpen(false);
        }

        return;
      }

      if (
        selected.kind ===
        "address"
      ) {
        emitHierarchy({
          ...current,
          street:
            selected,
        });

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(
          selected
        );

        setSuggestions([]);
        setSuggestionKind(
          undefined
        );
        setOpen(false);
        return;
      }

      onChange(
        selected.formattedAddress ||
          selected.displayName
      );
      onSelect?.(selected);
    } catch (error) {
      if (
        requestId !==
        requestIdRef.current
      ) {
        return;
      }

      console.warn(
        "Adres seçimi başarısız:",
        error
      );

      setSuggestions([]);
      setSuggestionKind(
        undefined
      );
      setOpen(false);
    } finally {
      if (
        requestId ===
        requestIdRef.current
      ) {
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
          disabled={
            disabled ||
            detailsLoading
          }
          value={value}
          onChange={(event) => {
            ++requestIdRef.current;
            clearSelectedForRawInput();
            setSuggestions([]);
            setSuggestionKind(
              undefined
            );
            setOpen(true);
            onChange(
              event.target.value
            );
          }}
          onFocus={() => {
            if (
              suggestions.length > 0
            ) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(
              () =>
                setOpen(false),
              180
            );
          }}
          onKeyDown={(event) => {
            if (
              event.key ===
              "Escape"
            ) {
              setOpen(false);
            }
          }}
          placeholder={
            placeholder
          }
          autoComplete="off"
          className={
            className
          }
        />
        {(loading ||
          detailsLoading) && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#D6A84F]"
            size={16}
          />
        )}
      </div>

      {open &&
        suggestions.length >
          0 && (
          <div className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-[#3A3A42] bg-[#111116] p-1 shadow-2xl">
            {suggestions.map(
              (
                suggestion,
                index
              ) => (
                <button
                  key={
                    (suggestion.placeId ||
                      suggestion.displayName) +
                    "-" +
                    index
                  }
                  type="button"
                  onMouseDown={(
                    event
                  ) =>
                    event.preventDefault()
                  }
                  onClick={() =>
                    void handleSelect(
                      suggestion
                    )
                  }
                  className="flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#222229]"
                >
                  <MapPin
                    className="mt-0.5 shrink-0 text-[#D6A84F]"
                    size={15}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold leading-5 text-white">
                      {
                        suggestion.displayName
                      }
                    </span>

                    {(suggestionKind ===
                      "city" ||
                      suggestion.kind ===
                        "city") && (
                      <span className="mt-0.5 block text-[10px] text-emerald-300">
                        İL
                      </span>
                    )}

                    {(suggestionKind ===
                      "district" ||
                      suggestion.kind ===
                        "district") && (
                      <span className="mt-0.5 block text-[10px] text-emerald-300">
                        İLÇE • Gerçek OSM verisi
                      </span>
                    )}

                    {(suggestionKind ===
                      "neighborhood" ||
                      suggestion.kind ===
                        "neighborhood") && (
                      <span className="mt-0.5 block text-[10px] text-emerald-300">
                        MAHALLE • Gerçek OSM verisi
                      </span>
                    )}

                    {(suggestionKind ===
                      "street" ||
                      suggestion.kind ===
                        "street") && (
                      <span className="mt-0.5 block text-[10px] text-emerald-300">
                        CADDE / SOKAK •{" "}
                        {suggestion.street ||
                          suggestion.name}
                      </span>
                    )}

                    {(suggestionKind ===
                      "address" ||
                      suggestion.kind ===
                        "address") && (
                      <span className="mt-0.5 block text-[10px] text-emerald-300">
                        GERÇEK BİNA NO •{" "}
                        {suggestion.street}{" "}
                        No:{" "}
                        {
                          suggestion.streetNumber
                        }
                      </span>
                    )}
                  </span>
                </button>
              )
            )}

            <div className="border-t border-[#2A2A31] px-3 py-2 text-[9px] text-white/40">
              © OpenStreetMap contributors
            </div>
          </div>
        )}
    </div>
  );
};

export default AddressAutocomplete;
