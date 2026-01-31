from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
DATA_DIR = PROJECT_ROOT / "data"

app = FastAPI()

@app.get("/api/health")
async def health():
    return {"status": "ok"}

if DATA_DIR.exists():
    app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    module_target = "main:app" if Path.cwd().name == "backend" else "backend.main:app"
    uvicorn.run(module_target, host="127.0.0.1", port=8000, reload=True)
