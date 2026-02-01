const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const OUTPUT_DIR = path.join(DATA_DIR, 'polygon_stats');

const levels = [
  { level: 'area', dir: 'area_geojson', prefix: 'area', idField: 'area' },
  { level: 'district', dir: 'district_geojson', prefix: 'district', idField: 'district' },
  { level: 'sector', dir: 'sector_geojson', prefix: 'sector', idField: 'sector' }
];

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const loadJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data));
};

const buildStatsForLevel = (config) => {
  const levelDir = path.join(DATA_DIR, config.dir);
  const indexPath = path.join(levelDir, 'index.json');
  const indexJson = loadJson(indexPath);
  const months = Array.isArray(indexJson?.months) ? indexJson.months : [];

  const outputLevelDir = path.join(OUTPUT_DIR, config.level);
  ensureDir(outputLevelDir);

  months.forEach((monthKey) => {
    const filePath = path.join(levelDir, `${config.prefix}_${monthKey}.geojson`);
    if (!fs.existsSync(filePath)) {
      console.warn(`Missing ${config.level} file for ${monthKey}`);
      return;
    }

    const geojson = loadJson(filePath);
    const stats = {};

    for (const feature of geojson.features || []) {
      const props = feature.properties || {};
      const id = props[config.idField];
      if (!id) continue;

      stats[id] = {
        mean_price: Number(props.mean_price ?? 0),
        median_price: Number(props.median_price ?? 0),
        sales: Number(props.sales ?? 0)
      };
    }

    const output = {
      level: config.level,
      idField: config.idField,
      month: monthKey,
      stats
    };

    writeJson(path.join(outputLevelDir, `${monthKey}.json`), output);
  });

  writeJson(path.join(outputLevelDir, 'index.json'), { months });
  console.log(`Built stats for ${config.level}: ${months.length} months`);
};

const run = () => {
  ensureDir(OUTPUT_DIR);
  levels.forEach(buildStatsForLevel);
};

run();
