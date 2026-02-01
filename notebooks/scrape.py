import requests
from pathlib import Path

# =========================
# Constants
# =========================
BASE_URL = "http://prod1.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/pp-{}.txt"
START_YEAR = 2017
END_YEAR = 1995  # inclusive
SAVE_DIR = Path("land_registry_files")  # directory to save files
SAVE_DIR.mkdir(exist_ok=True)

# =========================
# Download loop
# =========================
for year in range(START_YEAR, END_YEAR - 1, -1):  # 2017 -> 1995
    url = BASE_URL.format(year)
    filename = SAVE_DIR / f"pp-{year}.txt"
    try:
        print(f"Downloading {url} ...")
        response = requests.get(url, stream=True)
        response.raise_for_status()  # raises exception for 4xx/5xx errors

        with open(filename, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        print(f"Saved to {filename}")
    except requests.HTTPError as e:
        print(f"Failed to download {url}: {e}")