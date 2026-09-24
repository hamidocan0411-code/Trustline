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

const suggestionKindOf = (
  suggestions: AddressSuggestion[]
): AddressSuggestion["kind"] => {
  const kinds = new Set(
    suggestions
      .map((suggestion) => suggestion.kind)
      .filter(Boolean)
  );

  if (kinds.size === 1) {
    return suggestions[0]?.kind;
  }

  return undefined;
};

const suggestionLabel = (
  item: AddressSuggestion
): string => {
  if (item.displayName?.trim()) {
    return item.displayName.trim();
  }

  if (item.formattedAddress?.trim()) {
    return item.formattedAddress.trim();
  }

  if (item.kind === "address") {
    const addressBase = [
      item.street || item.name || "",
      item.streetNumber
        ? "No: " + item.streetNumber
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    return [
      addressBase,
      item.parentNeighborhood,
      item.parentDistrict,
      item.parentCity,
    ]
      .filter(Boolean)
      .join(", ");
  }

  if (item.kind === "street") {
    return [
      item.street || item.name || "",
      item.parentNeighborhood,
      item.parentDistrict,
      item.parentCity,
    ]
      .filter(Boolean)
      .join(", ");
  }

  if (item.kind === "neighborhood") {
    return [
      item.name || "",
      "Mahallesi",
      item.parentDistrict,
      item.parentCity,
    ]
      .filter(Boolean)
      .join(", ");
  }

  if (item.kind === "district") {
    return [
      item.name || "",
      item.parentCity,
    ]
      .filter(Boolean)
      .join(", ");
  }

  return [
    item.name || "",
    item.parentCity && item.parentCity !== item.name
      ? item.parentCity
      : "",
  ]
    .filter(Boolean)
    .join(", ");
};

const makeCitySuggestion = (
  provinceName = "",
  source?: string,
  areaId?: number,
  osmId?: number
): AddressSuggestion => {
  const name =
    provinceName.trim();

  return {
    displayName:
      name
        ? name + ", Türkiye"
        : "İl seçilmedi",
    formattedAddress:
      name
        ? name + ", Türkiye"
        : "",
    name,
    kind: "city",
    parentCity: name,
    source: source || "openstreetmap",
    areaId,
    osmId,
    osmType:
      osmId != null
        ? "relation"
        : undefined,
    types: [
      "city",
      "province",
    ],
  };
};

const makeDistrictSuggestion = (
  name: string,
  provinceName = "",
  source?: string,
  areaId?: number,
  osmId?: number
): AddressSuggestion => ({
  displayName:
    name +
    (provinceName
      ? ", " +
        provinceName
      : ", Türkiye"),
  formattedAddress:
    name +
    (provinceName
      ? ", " +
        provinceName
      : ", Türkiye"),
  name,
  kind: "district",
  parentCity:
    provinceName || undefined,
  source: source || "openstreetmap",
  areaId,
  osmId,
  osmType:
    osmId != null
      ? "relation"
      : undefined,
  types: [
    "district",
    "administrative",
  ],
});

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
  const suppressNextSearchRef =
    useRef(false);

  /*
   * Bu ref yalnızca autocomplete'in mevcut seçili
   * hiyerarşi bağlamını taşır. Gerçek parent state,
   * onHierarchyChange ile NewOrderModal/ProfileView
   * tarafında tutulur.
   */
  const hierarchyRef =
    useRef<SelectedAddressHierarchy>(
      EMPTY_HIERARCHY
    );

  const notifyHierarchy = (
    hierarchy: SelectedAddressHierarchy
  ) => {
    hierarchyRef.current =
      hierarchy;
    onHierarchyChange?.(
      hierarchy
    );
  };

  const clearRawSelectionButKeepContext =
    () => {
      const context =
        hierarchyRef.current;

      notifyHierarchy({
        city:
          context.city,
        district:
          context.district,
        neighborhood:
          context.neighborhood,
        street: null,
      });
    };

  useEffect(() => {
    const query =
      value.trim();

    if (
      suppressNextSearchRef.current
    ) {
      suppressNextSearchRef.current =
        false;
      return;
    }

    if (
      query.length < 2
    ) {
      setSuggestions([]);
      setSuggestionKind(
        undefined
      );
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
                hierarchyRef.current.city,
              district:
                hierarchyRef.current
                  .district,
              neighborhood:
                hierarchyRef.current
                  .neighborhood,
              street:
                hierarchyRef.current
                  .street,
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

            setSuggestions(
              results
            );
            setSuggestionKind(
              suggestionKindOf(
                results
              )
            );
            setOpen(
              results.length >
                0
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
            setSuggestionKind(
              undefined
            );
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
    setSuggestionKind(
      undefined
    );
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
        hierarchyRef.current;

      if (
        selected.kind ===
        "city"
      ) {
        const nextHierarchy = {
          city: selected,
          district: null,
          neighborhood: null,
          street: null,
        };

        suppressNextSearchRef.current =
          true;

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(
          selected
        );
        notifyHierarchy(
          nextHierarchy
        );

        const districts =
          await mapService.getDistrictSuggestions(
            selected
          );

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
          districts.length >
            0
        );
        return;
      }

      if (
        selected.kind ===
        "district"
      ) {
        const city =
          current.city ||
          makeCitySuggestion(
            selected.parentCity || "",
            selected.source
          );

        const nextHierarchy = {
          city,
          district: selected,
          neighborhood:
            null,
          street: null,
        };

        suppressNextSearchRef.current =
          true;

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(
          selected
        );
        notifyHierarchy(
          nextHierarchy
        );

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
          neighborhoods.length >
            0
        );
        return;
      }

      if (
        selected.kind ===
        "neighborhood"
      ) {
        const district =
          selected.parentDistrict
            ? makeDistrictSuggestion(
                selected.parentDistrict,
                selected.parentCity || current.city?.name || "",
                selected.source
              )
            : current.district;

        const city =
          current.city ||
          makeCitySuggestion(
            selected.parentCity || "",
            selected.source
          );

        const nextHierarchy = {
          city,
          district,
          neighborhood:
            selected,
          street: null,
        };

        suppressNextSearchRef.current =
          true;

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(
          selected
        );
        notifyHierarchy(
          nextHierarchy
        );

        const streets =
          await mapService.getStreetSuggestionsForNeighborhood(
            selected,
            district
          );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setSuggestions(
          streets
        );
        setSuggestionKind(
          "street"
        );
        setOpen(
          streets.length >
            0
        );
        return;
      }

      if (
        selected.kind ===
        "street"
      ) {
        const nextHierarchy = {
          city:
            current.city ||
            makeCitySuggestion(
              selected.parentCity ||
                "",
              selected.source
            ),
          district:
            current.district ||
            (
              selected.parentDistrict
                ? makeDistrictSuggestion(
                    selected.parentDistrict,
                    selected.parentCity ||
                      current.city?.name ||
                      "",
                    selected.source
                  )
                : null
            ),
          neighborhood:
            current.neighborhood ||
            (
              selected.parentNeighborhood
                ? {
                    displayName:
                      selected.parentNeighborhood +
                      " Mahallesi, " +
                      (
                        selected.parentDistrict ||
                        ""
                      ) +
                      (
                        selected.parentCity
                          ? ", " +
                            selected.parentCity
                          : ""
                      ),
                    formattedAddress:
                      selected.parentNeighborhood +
                      " Mahallesi, " +
                      (
                        selected.parentDistrict ||
                        ""
                      ) +
                      (
                        selected.parentCity
                          ? ", " +
                            selected.parentCity
                          : ""
                      ),
                    name:
                      selected.parentNeighborhood,
                    kind:
                      "neighborhood" as const,
                    parentCity:
                      selected.parentCity,
                    parentDistrict:
                      selected.parentDistrict,
                    source:
                      selected.source ||
                      "openstreetmap",
                    types: [
                      "neighborhood",
                    ],
                  }
                : null
            ),
          street:
            selected,
        };

        suppressNextSearchRef.current =
          true;

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(
          selected
        );
        notifyHierarchy(
          nextHierarchy
        );

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
          addresses.length >
          0
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
        suppressNextSearchRef.current =
          true;

        onChange(
          selected.formattedAddress ||
            selected.displayName
        );
        onSelect?.(
          selected
        );
        notifyHierarchy({
          ...current,
          street:
            selected,
        });

        setSuggestions([]);
        setSuggestionKind(
          undefined
        );
        setOpen(false);
        return;
      }

      suppressNextSearchRef.current =
        true;
      onChange(
        selected.formattedAddress ||
          selected.displayName
      );
      onSelect?.(
        selected
      );
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

            /*
             * Input ile selected value ayrıdır:
             * önce ham metni parent'a gönder,
             * ardından mevcut seçilmiş üst hiyerarşiyi
             * koru ve yalnız sokak seçimini geçersiz kıl.
             */
            onChange(
              event.target.value
            );
            clearRawSelectionButKeepContext();

            setSuggestions([]);
            setSuggestionKind(
              undefined
            );
            setOpen(true);
          }}
          onFocus={() => {
            if (
              suggestions.length >
              0
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
                item,
                index
              ) => (
                <button
                  key={
                    (item.placeId ||
                      item.displayName) +
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
                      item
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
                      {suggestionLabel(item)}
                    </span>

                    {(suggestionKind ===
                      "district" ||
                      item.kind ===
                        "district") && (
                      <span className="mt-0.5 block text-[10px] text-emerald-300">
                        İLÇE • Gerçek OSM verisi
                      </span>
                    )}

                    {(suggestionKind ===
                      "neighborhood" ||
                      item.kind ===
                        "neighborhood") && (
                      <span className="mt-0.5 block text-[10px] text-emerald-300">
                        MAHALLE • Gerçek OSM verisi
                      </span>
                    )}

                    {(suggestionKind ===
                      "street" ||
                      item.kind ===
                        "street") && (
                      <span className="mt-0.5 block text-[10px] text-emerald-300">
                        CADDE / SOKAK •{" "}
                        {item.street ||
                          item.name}
                      </span>
                    )}

                    {(suggestionKind ===
                      "address" ||
                      item.kind ===
                        "address") && (
                      <span className="mt-0.5 block text-[10px] text-emerald-300">
                        GERÇEK BİNA NO •{" "}
                        {item.street}{" "}
                        No:{" "}
                        {
                          item.streetNumber
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
