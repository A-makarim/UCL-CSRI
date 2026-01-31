import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  "pk.eyJ1IjoiZGlubm4iLCJhIjoiY21sMmJvMTZtMDlsOTNsc2VmdGgycW11YiJ9.7dZJ-sHo4uMQyElnyj0Hig";

export default function MapView({ geo, points, showDots, projection }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const latestGeoRef = useRef(geo);
  const latestPointsRef = useRef(points);
  const popupRef = useRef(null);
  const mapLoadedRef = useRef(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-1.5, 54.2],
      zoom: 4.2,
      projection
    });

    mapRef.current = map;

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    map.on("load", () => {
      mapLoadedRef.current = true;
      map.resize();
      map.setFog({
        range: [0.8, 8],
        color: "rgba(18, 26, 38, 0.8)",
        "horizon-blend": 0.2,
        "high-color": "rgba(36, 60, 90, 0.6)",
        "space-color": "rgba(4, 7, 11, 1)"
      });

      map.addSource("areas", {
        type: "geojson",
        data: latestGeoRef.current
      });

      map.addSource("points", {
        type: "geojson",
        data: latestPointsRef.current
      });

      map.addLayer({
        id: "area-fill",
        type: "fill",
        source: "areas",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "median_price"], 0],
            200000,
            "rgba(24, 75, 125, 0.55)",
            350000,
            "rgba(33, 146, 175, 0.65)",
            500000,
            "rgba(84, 213, 178, 0.75)",
            650000,
            "rgba(182, 229, 121, 0.82)",
            800000,
            "rgba(255, 196, 111, 0.9)",
            1000000,
            "rgba(255, 120, 90, 0.95)"
          ],
          "fill-opacity": 0.85
        }
      });

      map.addLayer({
        id: "area-outline",
        type: "line",
        source: "areas",
        paint: {
          "line-color": "rgba(255, 255, 255, 0.12)",
          "line-width": 0.8
        }
      });

      map.addLayer({
        id: "area-points",
        type: "circle",
        source: "points",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["sqrt", ["coalesce", ["get", "sales"], 0]],
            1,
            3,
            10,
            7,
            50,
            12
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "median_price"], 0],
            200000,
            "rgba(33, 146, 175, 0.7)",
            500000,
            "rgba(84, 213, 178, 0.8)",
            800000,
            "rgba(255, 196, 111, 0.9)",
            1000000,
            "rgba(255, 120, 90, 0.95)"
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(10, 15, 20, 0.7)",
          "circle-opacity": 0.85
        },
        layout: { visibility: showDots ? "visible" : "none" }
      });

      map.on("mousemove", "area-fill", (event) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = event.features?.[0];
        if (!feature) return;

        const props = feature.properties || {};
        const name = props.area || props.district || props.sector || "Area";
        const price = props.median_price
          ? Number(props.median_price).toLocaleString("en-GB", { style: "currency", currency: "GBP" })
          : "n/a";
        const salesCount = props.sales ? Number(props.sales).toLocaleString("en-GB") : "n/a";

        if (!popupRef.current) {
          popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });
        }

        popupRef.current
          .setLngLat(event.lngLat)
          .setHTML(`<strong>${name}</strong><br/>Median: ${price}<br/>Sales: ${salesCount}`)
          .addTo(map);
      });

      map.on("mouseleave", "area-fill", () => {
        map.getCanvas().style.cursor = "";
        if (popupRef.current) popupRef.current.remove();
      });
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      if (popupRef.current) popupRef.current.remove();
      map.remove();
    };
  }, [projection]);

  useEffect(() => {
    latestGeoRef.current = geo;
    if (!mapRef.current) return;
    if (!mapLoadedRef.current) return;
    const source = mapRef.current.getSource("areas");
    if (source) {
      source.setData(geo);
    }
  }, [geo]);

  useEffect(() => {
    latestPointsRef.current = points;
    if (!mapRef.current) return;
    if (!mapLoadedRef.current) return;
    const source = mapRef.current.getSource("points");
    if (source) {
      source.setData(points);
    }
  }, [points]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapLoadedRef.current) return;
    mapRef.current.setLayoutProperty(
      "area-points",
      "visibility",
      showDots ? "visible" : "none"
    );
  }, [showDots]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapLoadedRef.current) return;
    mapRef.current.setProjection(projection);
  }, [projection]);

  return <div id="map" ref={containerRef} />;
}
