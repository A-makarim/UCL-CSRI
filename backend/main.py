import csv
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
FRONTEND_DIST = ROOT / "frontend" / "dist"
PPD_DIR = ROOT / "PPD"
LIVE_DIR = ROOT / "live"
LIVE_LISTINGS_FILE = LIVE_DIR / "london_listings_geocoded.json"
LIVE_LISTINGS_FILE_FALLBACK = ROOT / "london_listings_geocoded.json"

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"


def load_env_file(path: Path) -> None:
    """Minimal .env loader (keeps local dev friction low)."""
    if not path.exists():
        return
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except OSError:
        return


load_env_file(ROOT / ".env")


def normalize_postcode(postcode: str) -> str:
    return postcode.replace(" ", "").upper()


def parse_codes(postcode: str) -> Tuple[str, str, str]:
    pc = (postcode or "").strip().upper()
    if not pc:
        return "", "", ""
    parts = pc.split()
    outward = parts[0]
    inward = parts[1] if len(parts) > 1 else ""

    area = ""
    for ch in outward:
        if ch.isalpha():
            area += ch
        else:
            break

    district = outward
    sector = outward
    if inward:
        sector = f"{outward} {inward[0]}"
    return area, district, sector


def sanitize_history(history: List[dict]) -> List[dict]:
    """
    Perplexity's chat API can reject invalid message sequences. Keep:
    - only user/assistant roles
    - alternating roles
    - history ending with assistant (so we can append a user message)
    """
    cleaned: List[dict] = []
    for item in history or []:
        role = item.get("role")
        content = item.get("content")
        if role not in {"user", "assistant"} or not content:
            continue
        if cleaned and cleaned[-1]["role"] == role:
            continue
        cleaned.append({"role": role, "content": str(content)})

    if cleaned and cleaned[-1]["role"] == "user":
        cleaned.pop()

    return cleaned[-10:]


class AskRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: List[dict] = Field(default_factory=list)
    # Frontend may send extra context; we intentionally don't inject it into the
    # message stream as extra messages because Perplexity can be strict about structure.
    # Instead we append a compact context block to the user message.
    context: Optional[Dict[str, Any]] = None


class AskResponse(BaseModel):
    answer: str
    citations: List[Any] = Field(default_factory=list)
    model: str


PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY")
PERPLEXITY_MODEL = os.environ.get("PERPLEXITY_MODEL", "sonar")
PERPLEXITY_FALLBACK_MODELS = ["sonar-pro", "sonar"]


def call_perplexity(message: str, history: List[dict]) -> AskResponse:
    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=500, detail="PERPLEXITY_API_KEY is not configured.")

    system_prompt = (
        "You are a helpful UK real estate analyst. Provide concise, accurate insights about "
        "properties and the UK market. Use markdown formatting. When asked about an area, "
        "summarize strengths and weaknesses (transport, schools, amenities, safety, affordability, demand). "
        "Use current public information and include citations or sources if available. If unsure, say so."
    )

    cleaned_history = sanitize_history(history)
    messages = [{"role": "system", "content": system_prompt}, *cleaned_history, {"role": "user", "content": message}]

    def _post(model: str) -> AskResponse:
        body = {
            "model": model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 800,
        }
        request = urllib.request.Request(
            PERPLEXITY_API_URL,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
        data = json.loads(raw)
        answer = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        citations = data.get("citations", []) or []
        return AskResponse(answer=answer, citations=citations, model=model)

    models_to_try = [PERPLEXITY_MODEL] + [m for m in PERPLEXITY_FALLBACK_MODELS if m != PERPLEXITY_MODEL]
    last_detail = ""
    for model in models_to_try:
        try:
            return _post(model)
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="ignore")
            last_detail = detail or str(error)
            # If it's not a 400, surface it immediately.
            if error.code != 400:
                raise HTTPException(status_code=error.code, detail=detail)
        except urllib.error.URLError as error:
            raise HTTPException(status_code=502, detail=str(error.reason))
        except json.JSONDecodeError:
            raise HTTPException(status_code=502, detail="Invalid response from Perplexity.")

    raise HTTPException(status_code=400, detail=last_detail or "Perplexity request failed.")


MAX_CACHED_MONTHS = 2
_month_cache: Dict[str, List[dict]] = {}
_month_cache_order: List[str] = []


def _load_month_records_from_csv(csv_path: Path, month: str) -> List[dict]:
    records: List[dict] = []
    with csv_path.open("r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 4:
                continue
            date = row[2]
            if not date or not str(date).startswith(month):
                continue
            postcode = (row[3] or "").strip().upper()
            if not postcode:
                continue
            try:
                price = int(row[1])
            except (TypeError, ValueError):
                continue

            area, district, sector = parse_codes(postcode)
            # PPD CSV schema (from AGENTS.md)
            records.append(
                {
                    "price": price,
                    "date": str(date),
                    "postcode": postcode,
                    "postcode_norm": normalize_postcode(postcode),
                    "area": area,
                    "district": district,
                    "sector": sector,
                    "property_type": row[4] if len(row) > 4 else "",
                    "old_new": row[5] if len(row) > 5 else "",
                    "duration": row[6] if len(row) > 6 else "",
                    "paon": row[7] if len(row) > 7 else "",
                    "saon": row[8] if len(row) > 8 else "",
                    "street": row[9] if len(row) > 9 else "",
                    "locality": row[10] if len(row) > 10 else "",
                    "town_city": row[11] if len(row) > 11 else "",
                    "district_name": row[12] if len(row) > 12 else "",
                    "county": row[13] if len(row) > 13 else "",
                }
            )
    return records


def _load_month_records(month: str) -> List[dict]:
    if len(month) != 7 or "-" not in month:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM.")

    year = month[:4]
    csv_path = PPD_DIR / f"{year}.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail=f"No PPD CSV found for {year}.")

    return _load_month_records_from_csv(csv_path, month)


def get_month_records(month: str) -> List[dict]:
    if month in _month_cache:
        return _month_cache[month]

    records = _load_month_records(month)
    _month_cache[month] = records
    _month_cache_order.append(month)

    while len(_month_cache_order) > MAX_CACHED_MONTHS:
        oldest = _month_cache_order.pop(0)
        _month_cache.pop(oldest, None)

    return records


def to_public_record(record: dict) -> dict:
    return {
        "price": record.get("price"),
        "date": record.get("date"),
        "postcode": record.get("postcode"),
        "property_type": record.get("property_type"),
        "old_new": record.get("old_new"),
        "duration": record.get("duration"),
        "paon": record.get("paon"),
        "saon": record.get("saon"),
        "street": record.get("street"),
        "locality": record.get("locality"),
        "town_city": record.get("town_city"),
        "district": record.get("district_name"),
        "county": record.get("county"),
    }


_live_loaded = False
_live_data: Dict[str, Any] = {}
_live_by_district: Dict[str, Dict[str, List[dict]]] = {}
_live_by_id: Dict[str, dict] = {}


def _stable_listing_id(kind: str, url: str) -> str:
    import hashlib

    base = f"{kind}|{url}"
    return hashlib.sha1(base.encode("utf-8", errors="ignore")).hexdigest()[:16]


def load_live_listings() -> None:
    global _live_loaded, _live_data, _live_by_district, _live_by_id
    if _live_loaded:
        return

    src = LIVE_LISTINGS_FILE if LIVE_LISTINGS_FILE.exists() else LIVE_LISTINGS_FILE_FALLBACK
    if not src.exists():
        _live_loaded = True
        _live_data = {}
        _live_by_district = {}
        _live_by_id = {}
        return

    try:
        _live_data = json.loads(src.read_text(encoding="utf-8"))
    except Exception:
        _live_data = {}
        _live_by_district = {}
        _live_by_id = {}
        _live_loaded = True
        return

    areas = _live_data.get("areas") or {}
    by_district: Dict[str, Dict[str, List[dict]]] = {}
    by_id: Dict[str, dict] = {}

    if isinstance(areas, dict):
        for district_code, info in areas.items():
            if not isinstance(info, dict):
                continue
            district_code = str(district_code).upper()
            sale = [x for x in (info.get("saleListings") or []) if isinstance(x, dict)]
            rent = [x for x in (info.get("rentListings") or []) if isinstance(x, dict)]
            by_district[district_code] = {"sale": sale, "rent": rent}

            for kind, listings in (("sale", sale), ("rent", rent)):
                for listing in listings:
                    url = str(listing.get("listing_url") or "")
                    if not url:
                        continue
                    lid = _stable_listing_id(kind, url)
                    # Copy to avoid mutating the raw cached object.
                    payload = dict(listing)
                    payload["_id"] = lid
                    payload["_kind"] = kind
                    payload["_district"] = district_code
                    by_id[lid] = payload

    _live_by_district = by_district
    _live_by_id = by_id
    _live_loaded = True


def _live_districts_for(mode: str, code: str) -> List[str]:
    code = (code or "").strip().upper()
    if not code:
        return []
    if mode == "district":
        return [code]
    if mode == "area":
        return [d for d in _live_by_district.keys() if d.startswith(code)]
    if mode == "sector":
        # "SW1A 1" -> "SW1A"
        outward = code.split(" ", 1)[0]
        return [outward]
    if mode == "postcode":
        _, district, _ = parse_codes(code)
        return [district] if district else []
    return []


def _median(values: List[float]) -> Optional[float]:
    if not values:
        return None
    values = sorted(values)
    n = len(values)
    mid = n // 2
    if n % 2:
        return float(values[mid])
    return float((values[mid - 1] + values[mid]) / 2.0)


def _mean(values: List[float]) -> Optional[float]:
    if not values:
        return None
    return float(sum(values) / len(values))


def _listings_summary(listings: List[dict], kind: str) -> dict:
    prices: List[float] = []
    for it in listings:
        price = it.get("sale_price") if kind == "sale" else it.get("rent_pcm")
        try:
            price_f = float(price)
        except (TypeError, ValueError):
            continue
        if price_f > 0:
            prices.append(price_f)
    return {
        "count": len(listings),
        "median": _median(prices),
        "mean": _mean(prices),
        "min": float(min(prices)) if prices else None,
        "max": float(max(prices)) if prices else None,
    }


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if DATA_DIR.exists():
    app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/transactions")
def transactions(
    month: str = Query(..., description="YYYY-MM"),
    mode: str = Query(..., description="postcode|area|district|sector"),
    code: str = Query(...),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0, le=100000),
):
    if mode not in {"postcode", "area", "district", "sector"}:
        raise HTTPException(status_code=400, detail="mode must be postcode|area|district|sector")

    records = get_month_records(month)

    if mode == "postcode":
        code_norm = normalize_postcode(code)
        matches = [r for r in records if r.get("postcode_norm") == code_norm]
    elif mode == "area":
        code_norm = (code or "").strip().upper()
        matches = [r for r in records if r.get("area") == code_norm]
    elif mode == "district":
        code_norm = (code or "").strip().upper()
        matches = [r for r in records if r.get("district") == code_norm]
    else:
        code_norm = (code or "").strip().upper()
        matches = [r for r in records if r.get("sector") == code_norm]

    total = len(matches)
    window = matches[offset : offset + limit]

    return {
        "month": month,
        "mode": mode,
        "code": code_norm,
        "total": total,
        "shown": len(window),
        "offset": offset,
        "limit": limit,
        "transactions": [to_public_record(r) for r in window],
    }


@app.get("/api/live/listings")
def live_listings(
    mode: str = Query(..., description="postcode|area|district|sector"),
    code: str = Query(...),
    kind: str = Query("sale", description="sale|rent|all"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0, le=100000),
):
    if mode not in {"postcode", "area", "district", "sector"}:
        raise HTTPException(status_code=400, detail="mode must be postcode|area|district|sector")
    if kind not in {"sale", "rent", "all"}:
        raise HTTPException(status_code=400, detail="kind must be sale|rent|all")

    load_live_listings()
    if not _live_by_district:
        raise HTTPException(status_code=404, detail="Live listings not available. Add live/london_listings_geocoded.json")

    districts = _live_districts_for(mode, code)
    listings: List[dict] = []
    for d in districts:
        bucket = _live_by_district.get(d)
        if not bucket:
            continue
        if kind in {"sale", "all"}:
            for it in bucket["sale"]:
                listings.append({"_kind": "sale", "_district": d, **it})
        if kind in {"rent", "all"}:
            for it in bucket["rent"]:
                listings.append({"_kind": "rent", "_district": d, **it})

    total = len(listings)
    window = listings[offset : offset + limit]

    def with_id(it: dict) -> dict:
        url = str(it.get("listing_url") or "")
        k = str(it.get("_kind") or "sale")
        it = dict(it)
        it["_id"] = _stable_listing_id(k, url) if url else None
        return it

    summary = {
        "sale": _listings_summary([x for x in listings if x.get("_kind") == "sale"], "sale"),
        "rent": _listings_summary([x for x in listings if x.get("_kind") == "rent"], "rent"),
    }

    return {
        "mode": mode,
        "code": (code or "").strip().upper(),
        "districts": districts,
        "kind": kind,
        "total": total,
        "shown": len(window),
        "offset": offset,
        "limit": limit,
        "summary": summary,
        "listings": [with_id(it) for it in window],
        "meta": _live_data.get("meta") if isinstance(_live_data, dict) else None,
    }


@app.get("/api/live/listing")
def live_listing(id: str = Query(..., min_length=4)):
    load_live_listings()
    listing = _live_by_id.get(id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return {"listing": listing, "meta": _live_data.get("meta") if isinstance(_live_data, dict) else None}


@app.post("/api/ask", response_model=AskResponse)
def ask(payload: AskRequest):
    # Note: keep this endpoint separate from ScanSan (frontend can proxy /api to this backend).
    message = payload.message
    if payload.context and isinstance(payload.context, dict):
        # Keep the context short to avoid token bloat.
        ctx = payload.context
        ctx_lines: List[str] = ["Context (from the map UI):"]

        selection = ctx.get("selection")
        if isinstance(selection, dict):
            title = selection.get("title") or selection.get("code")
            if title:
                ctx_lines.append(f"- Selection: {title}")
            for k in ("month", "mode", "code", "kind"):
                v = selection.get(k)
                if v:
                    ctx_lines.append(f"- {k}: {v}")
            for k in ("median_price", "mean_price", "sales", "price", "bedrooms"):
                v = selection.get(k)
                if v is not None:
                    ctx_lines.append(f"- {k}: {v}")

        live = ctx.get("live")
        if isinstance(live, dict):
            ctx_lines.append("- Live listings snapshot included.")
            summary = live.get("summary")
            if isinstance(summary, dict):
                sale = summary.get("sale")
                rent = summary.get("rent")
                if isinstance(sale, dict):
                    ctx_lines.append(f"- Live sale listings: {sale.get('count')} (median={sale.get('median')}, mean={sale.get('mean')})")
                if isinstance(rent, dict):
                    ctx_lines.append(f"- Live rent listings: {rent.get('count')} (median={rent.get('median')}, mean={rent.get('mean')})")

        message = "\n".join(ctx_lines) + "\n\nUser request:\n" + message

    return call_perplexity(message, payload.history)


# Mount frontend last so it doesn't shadow /api routes.
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


def main():
    import uvicorn

    backend_dir = Path(__file__).resolve().parent

    # We always run `python main.py` from inside `backend/`.
    # Use the local module path so reload subprocesses never try to import `backend.*`.
    try:
        os.chdir(backend_dir)
    except FileNotFoundError:
        pass

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(backend_dir)],
    )


if __name__ == "__main__":
    main()
