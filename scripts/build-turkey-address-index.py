#!/usr/bin/env python3
"""
Trustline Express - Türkiye OSM adres indeks üreticisi.

Kaynak:
  Geofabrik Turkey OSM PBF

Çıktı:
  public/address-data/
    manifest.json
    hierarchy.json
    districts/<provincePlaceId>/<districtPlaceId>.json
    addresses/<districtPlaceId>/<neighborhoodPlaceId>.json

Çalışma mantığı:
  - Türkiye PBF bir kez indirilir.
  - İl / ilçe / mahalle hiyerarşisi OSM sınırlarından çıkarılır.
  - Yollar ve addr:housenumber verileri il bazında okunur.
  - Mahalle içindeki yollar gerçek geometriyle eşleştirilir.
  - Bina numaraları yalnız OSM'deki gerçek addr:housenumber kayıtlarından üretilir.
  - Çıktı Git'e eklenmez; Firebase Hosting'e build sırasında gider.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import urllib.request
from pathlib import Path

DATA_URL = "https://download.geofabrik.de/europe/turkey-latest.osm.pbf"
ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "public" / "address-data"
CACHE_ROOT = ROOT / ".osm-cache"
PBF_PATH = CACHE_ROOT / "turkey-latest.osm.pbf"
MANIFEST_PATH = DATA_ROOT / "manifest.json"


def log(message: str) -> None:
    print(f"[address-index] {message}", flush=True)


def normalize(value: object) -> str:
    text = str(value or "").strip().lower()
    table = str.maketrans({
        "ç": "c",
        "ğ": "g",
        "ı": "i",
        "ö": "o",
        "ş": "s",
        "ü": "u",
        "â": "a",
        "î": "i",
        "û": "u",
    })
    text = text.translate(table)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def safe_token(value: object) -> str:
    token = re.sub(r"[^A-Za-z0-9_-]+", "_", str(value or "").strip())
    return token[:120] or "unknown"


def stable_place_id(prefix: str, osm_id: object, fallback_name: object) -> str:
    try:
        num = int(osm_id)
        return f"{prefix.upper()}{num}"
    except Exception:
        digest = hashlib.sha1(normalize(fallback_name).encode("utf-8")).hexdigest()[:12]
        return f"{prefix.upper()}{digest}"


def compact_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(
            payload,
            handle,
            ensure_ascii=False,
            separators=(",", ":"),
        )


def download_pbf(force: bool) -> None:
    CACHE_ROOT.mkdir(parents=True, exist_ok=True)
    if PBF_PATH.exists() and PBF_PATH.stat().st_size > 50 * 1024 * 1024 and not force:
        log(f"Mevcut PBF kullanılıyor: {PBF_PATH}")
        return

    log("Geofabrik Türkiye PBF indiriliyor...")
    request = urllib.request.Request(
        DATA_URL,
        headers={
            "User-Agent": "TrustlineExpress-address-index/1.0",
            "Accept": "application/octet-stream",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        total = int(response.headers.get("Content-Length") or 0)
        temp = PBF_PATH.with_suffix(".download")
        downloaded = 0

        with temp.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
                downloaded += len(chunk)
                if total:
                    percent = downloaded * 100 / total
                    log(
                        f"İndiriliyor: {percent:5.1f}% "
                        f"({downloaded / 1024 / 1024:.1f} / {total / 1024 / 1024:.1f} MiB)"
                    )

        temp.replace(PBF_PATH)

    log(f"PBF hazır: {PBF_PATH}")


def require_packages():
    try:
        import geopandas as gpd  # noqa: F401
        import pandas as pd  # noqa: F401
        from pyrosm import OSM  # noqa: F401
        return
    except Exception as exc:
        print(
            "pyrosm/geopandas bulunamadı. "
            "Bu script npm tarafından çağrıldığında pyrosm otomatik kurulmalıdır.",
            file=sys.stderr,
        )
        raise RuntimeError(str(exc))


def row_value(row, column: str, default=None):
    try:
        value = row[column]
    except Exception:
        return default
    if value is None:
        return default
    try:
        if value != value:
            return default
    except Exception:
        pass
    return value


def osm_id_text(value: object) -> str:
    try:
        return str(int(value))
    except Exception:
        return str(value or "").strip()


def relation_place_id(row, default_prefix: str = "R") -> str:
    osm_type = str(row_value(row, "osm_type", "relation") or "").lower()
    prefix = {"relation": "R", "way": "W", "node": "N"}.get(
        osm_type, default_prefix
    )
    return stable_place_id(prefix, row_value(row, "id"), row_value(row, "name"))


def center_of_geometry(geometry):
    if geometry is None or geometry.is_empty:
        return None, None
    point = geometry.representative_point()
    return float(point.y), float(point.x)


def prepare_boundary_tables(osm):
    import pandas as pd

    log("İdari sınırlar okunuyor...")
    boundaries = osm.get_boundaries(
        boundary_type="all"
    )

    if boundaries is None or boundaries.empty:
        raise RuntimeError("OSM idari sınır verisi boş.")

    boundaries["admin_level"] = boundaries["admin_level"].astype(str)
    boundaries["osm_type"] = boundaries["osm_type"].astype(str).str.lower()

    provinces = boundaries[
        boundaries["admin_level"] == "4"
    ].copy()

    districts = boundaries[
        boundaries["admin_level"] == "6"
    ].copy()

    neighborhoods = boundaries[
        boundaries["admin_level"] == "8"
    ].copy()

    provinces = provinces[provinces["name"].notna()].copy()

    # Geofabrik country extracts can include clipped neighboring
    # administrative boundaries. Keep only province polygons whose
    # representative point falls inside the Türkiye country boundary.
    try:
        country_boundaries = boundaries[
            boundaries["admin_level"] == "2"
        ].copy()

        turkey_country = None
        if not country_boundaries.empty:
            normalized_country_names = (
                country_boundaries["name"]
                .fillna("")
                .astype(str)
                .str.casefold()
                .str.replace("ü", "u", regex=False)
            )
            named = country_boundaries[
                normalized_country_names.str.contains(
                    "turkey|turkiye",
                    regex=True,
                )
            ].copy()

            if not named.empty:
                turkey_country = named.geometry.unary_union
            else:
                # Fallback: Türkiye contains Ankara (32.8597, 39.9334).
                from shapely.geometry import Point
                anchor = Point(32.8597, 39.9334)
                containing = country_boundaries[
                    country_boundaries.geometry.notna()
                    & country_boundaries.geometry.contains(anchor)
                ]
                if not containing.empty:
                    turkey_country = containing.geometry.iloc[0]

        if turkey_country is not None and not provinces.empty:
            valid_province_rows = provinces.geometry.notna().copy()
            province_points = provinces.loc[
                valid_province_rows.index
            ].geometry.representative_point()
            province_inside = province_points.within(
                turkey_country
            )
            provinces = provinces.loc[
                valid_province_rows.index[province_inside]
            ].copy()
        else:
            log(
                "Türkiye ülke sınırı bulunamadı; il adayları isim/çevre filtresiyle devam edecek."
            )
    except Exception as exc:
        log(
            f"Türkiye ülke sınırı filtresi uygulanamadı, mevcut sınır verisi kullanılacak: {exc}"
        )
    districts = districts[districts["name"].notna()].copy()
    neighborhoods = neighborhoods[neighborhoods["name"].notna()].copy()

    # Some neighborhoods are mapped only as place=neighbourhood/suburb/quarter,
    # not as administrative=8 boundaries. Add those too.
    try:
        places = osm.get_data_by_custom_criteria(
            custom_filter={
                "place": [
                    "neighbourhood",
                    "quarter",
                    "suburb",
                ]
            },
            osm_keys_to_keep=["place"],
            filter_type="keep",
            tags_as_columns=["name", "place"],
            keep_nodes=True,
            keep_ways=True,
            keep_relations=True,
            keep_other_tags=False,
        )
    except Exception as exc:
        log(f"Place mahalleleri okunamadı, administrative=8 kullanılacak: {exc}")
        places = None

    if places is not None and not places.empty:
        places["name"] = places["name"].fillna("").astype(str).str.strip()
        places = places[places["name"] != ""].copy()
        places["osm_type"] = places["osm_type"].astype(str).str.lower()

        extra = places[
            ~(
                places["id"].astype(str).isin(
                    neighborhoods["id"].astype(str)
                )
            )
        ].copy()

        if not extra.empty:
            neighborhoods = pd.concat(
                [neighborhoods, extra],
                ignore_index=True,
            )

    return provinces, districts, neighborhoods


def spatial_parent(
    child_gdf,
    parent_gdf,
    id_column: str,
    name_column: str,
):
    import geopandas as gpd

    if child_gdf.empty or parent_gdf.empty:
        return child_gdf

    parents = parent_gdf[
        ["id", "name", "geometry"]
    ].copy()

    parents = parents.rename(
        columns={
            "id": id_column,
            "name": name_column,
        }
    )

    points = child_gdf.copy()
    points["_join_geom"] = (
        points.geometry.representative_point()
    )
    join_points = gpd.GeoDataFrame(
        points.drop(columns=["geometry"]),
        geometry="_join_geom",
        crs=child_gdf.crs,
    )

    joined = gpd.sjoin(
        join_points,
        parents,
        how="left",
        predicate="within",
    )

    joined = joined.drop_duplicates(
        subset=["id"],
        keep="first",
    )

    mapping = (
        joined[
            [
                "id",
                id_column,
                name_column,
            ]
        ]
        .drop_duplicates(
            subset=["id"],
            keep="first",
        )
        .set_index("id")
    )

    child_gdf = child_gdf.copy()
    child_ids = child_gdf["id"]
    child_gdf[id_column] = child_ids.map(
        mapping[id_column]
    )
    child_gdf[name_column] = child_ids.map(
        mapping[name_column]
    )
    return child_gdf


def natural_house_number_key(value: object):
    text = str(value or "").strip()
    parts = re.split(r"(\d+)", text)
    key = []
    for part in parts:
        if part.isdigit():
            key.append((0, int(part)))
        else:
            key.append((1, normalize(part)))
    return key


def process_province(osm_path, province_row, districts, neighborhoods):
    import geopandas as gpd
    import pandas as pd
    from pyrosm import OSM

    province_name = str(row_value(province_row, "name", "")).strip()
    province_pid = relation_place_id(province_row)

    geometry = province_row.geometry
    bbox = list(geometry.bounds)

    province_districts = districts[
        districts["_province_id"].map(osm_id_text)
        == osm_id_text(row_value(province_row, "id"))
    ].copy()

    province_neighborhoods = neighborhoods[
        neighborhoods["_province_id"].map(osm_id_text)
        == osm_id_text(row_value(province_row, "id"))
    ].copy()

    neighborhood_place_ids = {
        str(row_value(nrow, "id")):
        relation_place_id(nrow)
        for _, nrow in province_neighborhoods.iterrows()
    }

    # Province-specific OSM reader keeps memory bounded.
    regional = OSM(
        str(osm_path),
        bounding_box=bbox,
        complete_relations=True,
        keep_metadata=False,
        engine="out_of_core",
        workers="auto",
    )

    log(f"{province_name}: yollar okunuyor...")
    road_filter = [
        "motorway",
        "motorway_link",
        "trunk",
        "trunk_link",
        "primary",
        "primary_link",
        "secondary",
        "secondary_link",
        "tertiary",
        "tertiary_link",
        "unclassified",
        "residential",
        "living_street",
        "service",
        "road",
    ]

    roads = regional.get_data_by_custom_criteria(
        custom_filter={"highway": road_filter},
        osm_keys_to_keep=["highway"],
        filter_type="keep",
        tags_as_columns=["name", "highway"],
        keep_nodes=False,
        keep_ways=True,
        keep_relations=False,
        keep_other_tags=False,
    )

    if roads is None:
        roads = gpd.GeoDataFrame(
            columns=["name", "highway", "geometry"],
            geometry="geometry",
            crs="EPSG:4326",
        )

    if "name" not in roads.columns:
        roads["name"] = ""
    else:
        roads["name"] = (
            roads["name"]
            .fillna("")
            .astype(str)
            .str.strip()
        )

    roads = roads[
        roads["name"] != ""
    ].copy()

    log(f"{province_name}: bina numaraları okunuyor...")
    addresses = regional.get_data_by_custom_criteria(
        custom_filter={"addr:housenumber": True},
        osm_keys_to_keep=["addr:housenumber"],
        filter_type="keep",
        tags_as_columns=[
            "addr:housenumber",
            "addr:street",
            "addr:suburb",
            "addr:neighbourhood",
            "addr:quarter",
            "addr:district",
            "addr:city",
            "addr:province",
        ],
        keep_nodes=True,
        keep_ways=True,
        keep_relations=False,
        keep_other_tags=False,
    )

    if addresses is None:
        addresses = gpd.GeoDataFrame(
            columns=["geometry"],
            geometry="geometry",
            crs="EPSG:4326",
        )

    for column in [
        "addr:housenumber",
        "addr:street",
        "addr:suburb",
        "addr:neighbourhood",
        "addr:quarter",
        "addr:district",
        "addr:city",
        "addr:province",
    ]:
        if column not in addresses.columns:
            addresses[column] = ""

    addresses["addr:housenumber"] = (
        addresses["addr:housenumber"]
        .fillna("")
        .astype(str)
        .str.strip()
    )
    addresses["addr:street"] = (
        addresses["addr:street"]
        .fillna("")
        .astype(str)
        .str.strip()
    )
    addresses = addresses[
        addresses["addr:housenumber"] != ""
    ].copy()

    # Assign province-specific streets to neighborhood areas.
    if not province_neighborhoods.empty and not roads.empty:
        neighborhood_polygons = province_neighborhoods[
            province_neighborhoods.geometry.notna()
        ].copy()

        polygon_mask = neighborhood_polygons.geometry.geom_type.isin(
            ["Polygon", "MultiPolygon"]
        )
        neighborhood_polygons = neighborhood_polygons[
            polygon_mask
        ]

        if not neighborhood_polygons.empty:
            road_join = gpd.sjoin(
                roads,
                neighborhood_polygons[
                    ["id", "name", "geometry"]
                ].rename(
                    columns={
                        "id": "_neighborhood_id",
                        "name": "_neighborhood_name",
                    }
                ),
                how="inner",
                predicate="intersects",
            )

            road_join = road_join.drop_duplicates(
                subset=["_neighborhood_id", "name"],
                keep="first",
            )
        else:
            road_join = roads.copy()
            road_join["_neighborhood_id"] = None
            road_join["_neighborhood_name"] = None
    else:
        road_join = roads.copy()
        road_join["_neighborhood_id"] = None
        road_join["_neighborhood_name"] = None

    # Address objects may be nodes or building polygons.
    if not addresses.empty:
        address_points = addresses.copy()
        address_points.geometry = address_points.geometry.representative_point()

        if not province_neighborhoods.empty:
            neighborhood_polygons = province_neighborhoods[
                province_neighborhoods.geometry.notna()
            ].copy()
            neighborhood_polygons = neighborhood_polygons[
                neighborhood_polygons.geometry.geom_type.isin(
                    ["Polygon", "MultiPolygon"]
                )
            ]

            if not neighborhood_polygons.empty:
                addr_join = gpd.sjoin(
                    address_points,
                    neighborhood_polygons[
                        ["id", "name", "geometry"]
                    ].rename(
                        columns={
                            "id": "_neighborhood_id",
                            "name": "_neighborhood_name",
                        }
                    ),
                    how="left",
                    predicate="within",
                )
                addr_join = addr_join.drop_duplicates(
                    subset=["id"],
                    keep="first",
                )
            else:
                addr_join = address_points.copy()
                addr_join["_neighborhood_id"] = None
                addr_join["_neighborhood_name"] = None
        else:
            addr_join = address_points.copy()
            addr_join["_neighborhood_id"] = None
            addr_join["_neighborhood_name"] = None

        # Fallback for point-only place=neighbourhood records.
        neighborhood_name_map = {}
        for _, nrow in province_neighborhoods.iterrows():
            neighborhood_name_map[
                normalize(row_value(nrow, "name"))
            ] = str(row_value(nrow, "id"))

        fallback_ids = []
        for _, arow in addr_join.iterrows():
            existing = row_value(
                arow,
                "_neighborhood_id",
                None,
            )
            if existing is not None and str(existing) != "nan":
                fallback_ids.append(existing)
                continue

            candidates = [
                row_value(arow, "addr:neighbourhood", ""),
                row_value(arow, "addr:suburb", ""),
                row_value(arow, "addr:quarter", ""),
            ]
            match = None
            for candidate in candidates:
                candidate_norm = normalize(candidate)
                if candidate_norm in neighborhood_name_map:
                    match = neighborhood_name_map[candidate_norm]
                    break
            fallback_ids.append(match)

        addr_join["_neighborhood_id"] = fallback_ids
    else:
        addr_join = addresses.copy()
        addr_join["_neighborhood_id"] = None

    # Build district-level payloads.
    district_payloads = {
        str(row_value(drow, "id")): {
            "id": relation_place_id(drow),
            "osmId": int(row_value(drow, "id")),
            "name": str(row_value(drow, "name", "")).strip(),
            "provinceId": province_pid,
            "provinceName": province_name,
            "neighborhoods": [],
            "streets": [],
        }
        for _, drow in province_districts.iterrows()
    }

    id_to_district_pid = {
        str(row_value(drow, "id")): relation_place_id(drow)
        for _, drow in province_districts.iterrows()
    }

    neighborhood_to_district = {}
    for _, nrow in province_neighborhoods.iterrows():
        district_id = row_value(nrow, "_district_id", None)
        if district_id is None:
            continue
        neighborhood_to_district[
            osm_id_text(row_value(nrow, "id"))
        ] = osm_id_text(district_id)

    for _, nrow in province_neighborhoods.iterrows():
        nid_raw = str(row_value(nrow, "id"))
        district_raw = neighborhood_to_district.get(nid_raw)
        if not district_raw or district_raw not in district_payloads:
            continue

        lat, lng = center_of_geometry(nrow.geometry)
        neighborhood_pid = relation_place_id(nrow)
        neighborhood_item = {
            "id": neighborhood_pid,
            "osmId": int(row_value(nrow, "id")),
            "name": str(row_value(nrow, "name", "")).strip(),
            "districtId": id_to_district_pid[district_raw],
            "districtName": str(
                district_payloads[district_raw]["name"]
            ),
            "provinceId": province_pid,
            "provinceName": province_name,
            "areaId": (
                3600000000 + int(row_value(nrow, "id"))
                if str(row_value(nrow, "osm_type", "")).lower()
                == "relation"
                else None
            ),
            "lat": lat,
            "lng": lng,
        }
        district_payloads[district_raw]["neighborhoods"].append(
            neighborhood_item
        )

    # Address data is later grouped by district + neighborhood.
    address_payloads = {}

    for _, street_row in road_join.iterrows():
        nid = row_value(street_row, "_neighborhood_id", None)
        if nid is None:
            continue
        nid = osm_id_text(nid)
        district_raw = neighborhood_to_district.get(nid)
        if district_raw not in district_payloads:
            continue

        street_name = str(
            row_value(street_row, "name", "")
        ).strip()
        if not street_name:
            continue

        street_key = normalize(street_name)
        sid = stable_place_id(
            "W",
            row_value(street_row, "id"),
            street_name,
        )

        lat, lng = center_of_geometry(street_row.geometry)

        district_payloads[district_raw]["streets"].append(
            {
                "id": sid,
                "osmId": int(row_value(street_row, "id")),
                "name": street_name,
                "kind": "street",
                "neighborhoodId": neighborhood_place_ids.get(
                    nid,
                    stable_place_id(
                        "R",
                        nid,
                        row_value(
                            street_row,
                            "_neighborhood_name",
                        ),
                    ),
                ),
                "neighborhoodName": str(
                    row_value(
                        street_row,
                        "_neighborhood_name",
                        "",
                    )
                ).strip(),
                "districtId": id_to_district_pid[district_raw],
                "districtName": district_payloads[district_raw]["name"],
                "provinceId": province_pid,
                "provinceName": province_name,
                "lat": lat,
                "lng": lng,
                "_key": street_key,
            }
        )

    # Add address-only street names so mapped address tags are not lost.
    if not addr_join.empty:
        for _, arow in addr_join.iterrows():
            nid = row_value(arow, "_neighborhood_id", None)
            if nid is None:
                continue
            nid = osm_id_text(nid)
            district_raw = neighborhood_to_district.get(nid)
            if district_raw not in district_payloads:
                continue

            street_name = str(
                row_value(arow, "addr:street", "")
            ).strip()
            if not street_name:
                continue

            street_key = normalize(street_name)
            existing = next(
                (
                    item
                    for item in district_payloads[district_raw]["streets"]
                    if normalize(item["name"]) == street_key
                    and str(item["neighborhoodId"])
                    == stable_place_id(
                        "R",
                        nid,
                        row_value(
                            arow,
                            "addr:neighbourhood",
                        ),
                    )
                ),
                None,
            )

            if existing is None:
                lat, lng = center_of_geometry(arow.geometry)
                district_payloads[district_raw]["streets"].append(
                    {
                        "id": stable_place_id(
                            "S",
                            None,
                            f"{nid}:{street_name}",
                        ),
                        "osmId": None,
                        "name": street_name,
                        "kind": "street",
                        "neighborhoodId": neighborhood_place_ids.get(
                            nid,
                            stable_place_id(
                                "R",
                                nid,
                                row_value(
                                    arow,
                                    "addr:neighbourhood",
                                ),
                            ),
                        ),
                        "neighborhoodName": "",
                        "districtId": id_to_district_pid[district_raw],
                        "districtName": district_payloads[district_raw]["name"],
                        "provinceId": province_pid,
                        "provinceName": province_name,
                        "lat": lat,
                        "lng": lng,
                        "_key": street_key,
                    }
                )

    # Deduplicate street list and build address files.
    for district_raw, payload in district_payloads.items():
        unique = {}
        for item in payload["streets"]:
            key = (
                str(item["neighborhoodId"]),
                normalize(item["name"]),
            )
            old = unique.get(key)
            if old is None:
                unique[key] = item
            elif old["osmId"] is None and item["osmId"] is not None:
                unique[key] = item

        payload["streets"] = sorted(
            unique.values(),
            key=lambda item: (
                normalize(item["neighborhoodName"]),
                normalize(item["name"]),
            ),
        )

        # Remove internal-only keys before writing.
        for item in payload["streets"]:
            item.pop("_key", None)

        address_items_by_neighborhood = {}

        if not addr_join.empty:
            for _, arow in addr_join.iterrows():
                nid = row_value(arow, "_neighborhood_id", None)
                street_name = str(
                    row_value(arow, "addr:street", "")
                ).strip()
                house_number = str(
                    row_value(arow, "addr:housenumber", "")
                ).strip()

                if (
                    nid is None
                    or not street_name
                    or not house_number
                ):
                    continue

                nid = str(nid)
                if neighborhood_to_district.get(nid) != district_raw:
                    continue

                lat, lng = center_of_geometry(arow.geometry)
                neighborhood_pid = neighborhood_place_ids.get(
                    nid
                )

                street_match = next(
                    (
                        s
                        for s in payload["streets"]
                        if str(s["neighborhoodId"]) == neighborhood_pid
                        and normalize(s["name"]) == normalize(street_name)
                    ),
                    None,
                )

                if street_match is None:
                    continue

                by_street = address_items_by_neighborhood.setdefault(
                    neighborhood_pid,
                    {},
                )

                street_id = str(street_match["id"])
                by_number = by_street.setdefault(
                    street_id,
                    {
                        "streetId": street_id,
                        "streetName": street_match["name"],
                        "addresses": {},
                    },
                )

                address_id = stable_place_id(
                    "N",
                    row_value(arow, "id"),
                    f"{street_name}:{house_number}:{lat}:{lng}",
                )

                by_number["addresses"][address_id] = {
                    "id": address_id,
                    "street": street_match["name"],
                    "streetNumber": house_number,
                    "displayName": (
                        f"{street_match['name']} No: {house_number}, "
                        f"{street_match['neighborhoodName']}, "
                        f"{payload['name']}, {province_name}, Türkiye"
                    ),
                    "formattedAddress": (
                        f"{street_match['name']} No: {house_number}, "
                        f"{street_match['neighborhoodName']}, "
                        f"{payload['name']}, {province_name}, Türkiye"
                    ),
                    "lat": lat,
                    "lng": lng,
                    "kind": "address",
                    "source": "openstreetmap-static",
                    "placeId": address_id,
                    "parentCity": province_name,
                    "parentDistrict": payload["name"],
                    "parentNeighborhood": street_match["neighborhoodName"],
                    "street": street_match["name"],
                    "streetNumber": house_number,
                    "types": ["address", "addr:housenumber"],
                }

        for neighborhood_pid, street_groups in address_items_by_neighborhood.items():
            serialized_groups = []
            for street_group in street_groups.values():
                addresses_list = list(
                    street_group["addresses"].values()
                )
                addresses_list.sort(
                    key=lambda item: natural_house_number_key(
                        item["streetNumber"]
                    )
                )
                serialized_groups.append(
                    {
                        "streetId": street_group["streetId"],
                        "streetName": street_group["streetName"],
                        "addresses": addresses_list,
                    }
                )

            address_path = (
                DATA_ROOT
                / "addresses"
                / safe_token(payload["id"])
                / f"{safe_token(neighborhood_pid)}.json"
            )
            compact_json(
                address_path,
                {
                    "districtId": payload["id"],
                    "districtName": payload["name"],
                    "provinceId": province_pid,
                    "provinceName": province_name,
                    "neighborhoodId": neighborhood_pid,
                    "streets": serialized_groups,
                },
            )

        # District payload is written once after all address groups are prepared.
        for item in payload["neighborhoods"]:
            item["streetCount"] = sum(
                1
                for street in payload["streets"]
                if str(street["neighborhoodId"]) == str(item["id"])
            )

        district_path = (
            DATA_ROOT
            / "districts"
            / safe_token(province_pid)
            / f"{safe_token(payload['id'])}.json"
        )
        compact_json(
            district_path,
            {
                "id": payload["id"],
                "osmId": payload["osmId"],
                "name": payload["name"],
                "provinceId": province_pid,
                "provinceName": province_name,
                "neighborhoods": payload["neighborhoods"],
                "streets": payload["streets"],
            },
        )

    log(
        f"{province_name}: "
        f"{len(district_payloads)} ilçe, "
        f"{sum(len(v['neighborhoods']) for v in district_payloads.values())} mahalle işlendi."
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    require_packages()
    from pyrosm import OSM

    if args.force and DATA_ROOT.exists():
        shutil.rmtree(DATA_ROOT)

    if MANIFEST_PATH.exists() and not args.force:
        log("Statik adres indeksi zaten mevcut; yeniden üretim yapılmıyor.")
        return

    download_pbf(args.force)

    DATA_ROOT.mkdir(parents=True, exist_ok=True)

    osm = OSM(
        str(PBF_PATH),
        keep_metadata=False,
        complete_relations=True,
        engine="out_of_core",
        workers="auto",
    )

    provinces, districts, neighborhoods = prepare_boundary_tables(osm)

    # Build province / district parent links.
    log("İl-ilçe-mahalle üst ilişkileri hazırlanıyor...")
    districts = spatial_parent(
        districts,
        provinces,
        "_province_id",
        "_province_name",
    )

    neighborhoods = spatial_parent(
        neighborhoods,
        districts,
        "_district_id",
        "_district_name",
    )

    neighborhoods = spatial_parent(
        neighborhoods,
        provinces,
        "_province_id",
        "_province_name",
    )

    # Remove broken/unassigned records.
    districts = districts[
        districts["_province_id"].notna()
    ].copy()
    neighborhoods = neighborhoods[
        neighborhoods["_district_id"].notna()
        & neighborhoods["_province_id"].notna()
    ].copy()

    provinces_payload = []
    for _, prow in provinces.iterrows():
        pid = relation_place_id(prow)
        lat, lng = center_of_geometry(prow.geometry)
        provinces_payload.append(
            {
                "id": pid,
                "osmId": int(row_value(prow, "id")),
                "name": str(row_value(prow, "name", "")).strip(),
                "placeId": pid,
                "kind": "city",
                "parentCity": str(row_value(prow, "name", "")).strip(),
                "source": "openstreetmap-static",
                "areaId": (
                    3600000000 + int(row_value(prow, "id"))
                    if str(row_value(prow, "osm_type", "")).lower()
                    == "relation"
                    else None
                ),
                "osmType": "relation",
                "lat": lat,
                "lng": lng,
            }
        )

    districts_payload = []
    for _, drow in districts.iterrows():
        province_id = osm_id_text(row_value(drow, "_parent_id"))
        province_row = provinces[
            provinces["id"].astype(str) == province_id
        ]

        if province_row.empty:
            continue

        province_name = str(
            row_value(
                province_row.iloc[0],
                "name",
                "",
            )
        ).strip()

        dpid = relation_place_id(drow)
        districts_payload.append(
            {
                "id": dpid,
                "osmId": int(row_value(drow, "id")),
                "name": str(row_value(drow, "name", "")).strip(),
                "placeId": dpid,
                "kind": "district",
                "parentCity": province_name,
                "provinceId": relation_place_id(
                    province_row.iloc[0]
                ),
                "source": "openstreetmap-static",
                "areaId": (
                    3600000000 + int(row_value(drow, "id"))
                    if str(row_value(drow, "osm_type", "")).lower()
                    == "relation"
                    else None
                ),
                "osmType": "relation",
                "lat": center_of_geometry(drow.geometry)[0],
                "lng": center_of_geometry(drow.geometry)[1],
            }
        )

    neighborhoods_payload = []
    for _, nrow in neighborhoods.iterrows():
        district_id = str(row_value(nrow, "_parent_id"))
        district_row = districts[
            districts["id"].astype(str) == district_id
        ]
        if district_row.empty:
            continue

        province_id = str(
            row_value(
                district_row.iloc[0],
                "_parent_id",
            )
        )
        province_row = provinces[
            provinces["id"].astype(str) == province_id
        ]
        if province_row.empty:
            continue

        province_name = str(
            row_value(
                province_row.iloc[0],
                "name",
                "",
            )
        ).strip()
        district_name = str(
            row_value(
                district_row.iloc[0],
                "name",
                "",
            )
        ).strip()

        npid = relation_place_id(nrow)
        lat, lng = center_of_geometry(nrow.geometry)

        neighborhoods_payload.append(
            {
                "id": npid,
                "osmId": int(row_value(nrow, "id")),
                "name": str(row_value(nrow, "name", "")).strip(),
                "placeId": npid,
                "kind": "neighborhood",
                "parentCity": province_name,
                "parentDistrict": district_name,
                "districtId": relation_place_id(
                    district_row.iloc[0]
                ),
                "provinceId": relation_place_id(
                    province_row.iloc[0]
                ),
                "source": "openstreetmap-static",
                "areaId": (
                    3600000000 + int(row_value(nrow, "id"))
                    if str(row_value(nrow, "osm_type", "")).lower()
                    == "relation"
                    else None
                ),
                "osmType": str(
                    row_value(
                        nrow,
                        "osm_type",
                        "relation",
                    )
                ).lower(),
                "lat": lat,
                "lng": lng,
            }
        )

    compact_json(
        DATA_ROOT / "hierarchy.json",
        {
            "version": 1,
            "source": "OpenStreetMap / Geofabrik Turkey",
            "sourceUrl": DATA_URL,
            "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "provinces": sorted(
                provinces_payload,
                key=lambda item: normalize(item["name"]),
            ),
            "districts": sorted(
                districts_payload,
                key=lambda item: (
                    normalize(item["parentCity"]),
                    normalize(item["name"]),
                ),
            ),
            "neighborhoods": sorted(
                neighborhoods_payload,
                key=lambda item: (
                    normalize(item["provinceId"]),
                    normalize(item["districtId"]),
                    normalize(item["name"]),
                ),
            ),
        },
    )

    for _, prow in provinces.iterrows():
        process_province(
            str(PBF_PATH),
            prow,
            districts,
            neighborhoods,
        )

    compact_json(
        MANIFEST_PATH,
        {
            "version": 1,
            "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "source": "OpenStreetMap / Geofabrik Turkey",
            "sourceUrl": DATA_URL,
            "hierarchy": "hierarchy.json",
            "districtPath": "districts/{provinceId}/{districtId}.json",
            "addressPath": "addresses/{districtId}/{neighborhoodId}.json",
        },
    )

    log("Türkiye statik adres indeksi başarıyla üretildi.")


if __name__ == "__main__":
    main()
