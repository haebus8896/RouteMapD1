// roadsService.js
// Provides two strategies to obtain road geometry around a center point:
// 1) Overpass (OpenStreetMap) — recommended for full road networks.
// 2) Google sampling + Roads API — possible but quota-heavy and approximate.
// 
// Exported functions:
// - fetchRoadsOverpass(centerLatLng, radiusMeters)
// - fetchRoadsWithGoogleSampling(centerLatLng, radiusMeters, googleApiKey)
// 
// Notes: Overpass returns OSM ways; we convert to arrays of {lat,lng} coordinates.

export async function fetchRoadsOverpass(centerLatLng, radiusMeters = 100) {
  const lat = centerLatLng.lat;
  const lon = centerLatLng.lng;
  // Overpass QL: fetch highways (roads) with name or highway tag in radius
  const q = `
    [out:json][timeout:25];
    (
      way["highway"](around:${radiusMeters},${lat},${lon});
    );
    out body;
    >;
    out skel qt;
  `;
  const url = 'https://overpass-api.de/api/interpreter';
  const res = await fetch(url, { method: 'POST', body: q });
  if (!res.ok) throw new Error('Overpass request failed: ' + res.statusText);
  const data = await res.json();

  // Overpass returns nodes and ways separately. Build node map then ways as coordinate arrays.
  const nodes = new Map();
  for (const el of data.elements) {
    if (el.type === 'node') nodes.set(el.id, { lat: el.lat, lng: el.lon });
  }
  const ways = [];
  for (const el of data.elements) {
    if (el.type === 'way') {
      const coords = [];
      for (const nid of el.nodes) {
        const n = nodes.get(nid);
        if (n) coords.push({ lat: n.lat, lng: n.lng });
      }
      // skip degenerate ways
      if (coords.length >= 2) {
        ways.push({
          id: el.id,
          tags: el.tags || {},
          coordinates: coords
        });
      }
    }
  }
  return ways;
}

export async function fetchRoadsWithGoogleSampling(centerLatLng, radiusMeters = 100, googleApiKey) {
  // NOTE: This approach approximates the set of roads by sampling many points in the circle
  // and calling Google Roads Nearest Roads / Snap to Roads. Google "Nearest Roads" accepts up to 100 points per request.
  // Strategy:
  //  - Build a grid of points within radius with spacing s (e.g., 10-20m).
  //  - Batch into groups of <=100 and call Nearest Roads.
  //  - Collect snapped points and reconstruct segments (coalesce by placeId).
  //
  // Limitations: API quotas, up to 100 coordinates per request, missing small roads if spacing too large.
  const spacingMeters = 12; // adjust to balance coverage / quota
  const points = pointsInCircle(centerLatLng, radiusMeters, spacingMeters);
  const batches = [];
  for (let i = 0; i < points.length; i += 100) batches.push(points.slice(i, i + 100));
  const segmentsByPlace = new Map();

  for (const batch of batches) {
    const pathParam = batch.map(p => `${p.lat},${p.lng}`).join('|');
    const url = `https://roads.googleapis.com/v1/nearestRoads?points=${encodeURIComponent(pathParam)}&key=${googleApiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error('Google Roads API failed: ' + text);
    }
    const data = await res.json();
    // data.snappedPoints -> group by placeId then order by originalIndex
    if (!data.snappedPoints) continue;
    for (const sp of data.snappedPoints) {
      const pid = sp.placeId || ('p_' + (sp.originalIndex || Math.random()));
      const loc = { lat: sp.location.latitude, lng: sp.location.longitude, originalIndex: sp.originalIndex };
      if (!segmentsByPlace.has(pid)) segmentsByPlace.set(pid, []);
      segmentsByPlace.get(pid).push(loc);
    }
  }  

  // Build segments array
  const segments = [];
  for (const [placeId, pts] of segmentsByPlace.entries()) {
    // sort by originalIndex to preserve path order
    pts.sort((a, b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0));
    segments.push({ placeId, coordinates: pts.map(p => ({ lat: p.lat, lng: p.lng })) });
  }
  return segments;
}

function metersToDegreesLat(m) { return m / 111320; }
function metersToDegreesLng(m, lat) { return m / (111320 * Math.cos(lat * Math.PI / 180)); }

function pointsInCircle(center, radiusMeters, spacingMeters) {
  const points = [];
  const latStep = metersToDegreesLat(spacingMeters);
  const lngStepBase = metersToDegreesLng(spacingMeters, center.lat);
  // simple square grid covering bounding box then test circle
  const latMin = center.lat - metersToDegreesLat(radiusMeters);
  const latMax = center.lat + metersToDegreesLat(radiusMeters);
  const lngMin = center.lng - metersToDegreesLng(radiusMeters, center.lat);
  const lngMax = center.lng + metersToDegreesLng(radiusMeters, center.lat);
  for (let lat = latMin; lat <= latMax; lat += latStep) {
    const lngStep = metersToDegreesLng(spacingMeters, lat);
    for (let lng = lngMin; lng <= lngMax; lng += lngStep) {
      const d = haversineMeters(center.lat, center.lng, lat, lng);
      if (d <= radiusMeters) points.push({ lat, lng });
    }
  }
  return points;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
