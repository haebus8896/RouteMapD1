// drawing.js
// Manual polyline drawing helper: start from anchor polyline vertex, allow user to draw freehand,
// optionally snap each vertex to ground (map projection) and smooth on save.
// 
// Exports:
// - startManualDrawing(map, startLatLng, onUpdate, onFinish)
// - smoothPolyline(coords, iterations = 2) => Chaikin smoothing

export function startManualDrawing(map, startLatLng, onUpdate, onFinish) {
  let drawing = true;
  const path = [startLatLng];
  const poly = new google.maps.Polyline({
    map,
    path,
    strokeColor: '#3366FF',
    strokeOpacity: 1.0,
    strokeWeight: 4,
    clickable: false,
    geodesic: true
  });

  function onMove(e) {
    if (!drawing) return;
    const latLng = e.latLng;
    path.push({ lat: latLng.lat(), lng: latLng.lng() });
    poly.setPath(path);
    onUpdate && onUpdate(path);
  }

  function onUp(e) {
    // keep drawing until user double-clicks or presses Finish externally
  }

  map.addListener('mousemove', onMove);
  map.addListener('click', onMove);

  // Return controller to stop drawing and finish
  return {
    stop() {
      drawing = false;
      google.maps.event.clearListeners(map, 'mousemove');
      google.maps.event.clearListeners(map, 'click');
      onFinish && onFinish(path);
      return path;
    },
    getPolyline() {
      return poly;
    }
  };
}

// Chaikin smoothing
export function smoothPolyline(coords, iterations = 2) {
  function iterate(points) {
    const newPts = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i], q = points[i+1];
      const pa = { lat: p.lat * 0.75 + q.lat * 0.25, lng: p.lng * 0.75 + q.lng * 0.25 };
      const pb = { lat: p.lat * 0.25 + q.lat * 0.75, lng: p.lng * 0.25 + q.lng * 0.75 };
      newPts.push(pa, pb);
    }
    // optionally include endpoints
    newPts.unshift(points[0]);
    newPts.push(points[points.length-1]);
    return newPts;
  }

  let out = coords.slice();
  for (let i=0; i<iterations; i++) out = iterate(out);
  return out;
}