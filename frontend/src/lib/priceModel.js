const basePoints = [
  { name: "London", coords: [-0.1276, 51.5072], price: 720000 },
  { name: "Cambridge", coords: [0.1218, 52.2053], price: 510000 },
  { name: "Oxford", coords: [-1.2577, 51.752], price: 495000 },
  { name: "Bristol", coords: [-2.5879, 51.4545], price: 365000 },
  { name: "Manchester", coords: [-2.2426, 53.4808], price: 325000 },
  { name: "Birmingham", coords: [-1.8904, 52.4862], price: 290000 },
  { name: "Leeds", coords: [-1.5491, 53.8008], price: 285000 },
  { name: "Liverpool", coords: [-2.9779, 53.4084], price: 270000 },
  { name: "Brighton", coords: [-0.1364, 50.8225], price: 410000 },
  { name: "Bath", coords: [-2.359, 51.3811], price: 420000 },
  { name: "Reading", coords: [-0.9781, 51.4543], price: 405000 },
  { name: "Guildford", coords: [-0.5704, 51.2362], price: 470000 },
  { name: "Milton Keynes", coords: [-0.7594, 52.0406], price: 340000 },
  { name: "Canterbury", coords: [1.08, 51.2798], price: 360000 },
  { name: "Norwich", coords: [1.2983, 52.6309], price: 260000 },
  { name: "Nottingham", coords: [-1.151, 52.9548], price: 265000 },
  { name: "Cardiff", coords: [-3.1791, 51.4816], price: 260000 },
  { name: "Edinburgh", coords: [-3.1883, 55.9533], price: 360000 }
];

export const startDate = new Date(2020, 0, 1);
export const endDate = new Date(2032, 11, 1);

export const months = (() => {
  const list = [];
  for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    list.push(new Date(d));
  }
  return list;
})();

export const formatDate = (date) =>
  date.toLocaleString("en-GB", { month: "short", year: "numeric" });

export const growthFactor = (index, mode) => {
  const yearProgress = index / 12;
  const base = 1 + yearProgress * 0.04;
  const cycle = Math.sin(index / 5) * 0.03;
  const futureBoost = mode === "future" ? 0.08 : 0.0;
  return base + cycle + futureBoost;
};

export const trendText = (index, mode) => {
  const factor = growthFactor(index, mode);
  if (factor > 1.25) return "Heat spike";
  if (factor > 1.12) return "Heating up";
  if (factor > 1.02) return "Warming";
  if (factor > 0.98) return "Steady";
  return "Cooling";
};

export const buildGeoJSON = (index, mode) => {
  const factor = growthFactor(index, mode);
  return {
    type: "FeatureCollection",
    features: basePoints.map((point) => ({
      type: "Feature",
      properties: {
        price: point.price * factor,
        name: point.name
      },
      geometry: {
        type: "Point",
        coordinates: point.coords
      }
    }))
  };
};
