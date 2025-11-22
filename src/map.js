// map.js
// Main UI glue: destination selection (tap or Find My Location), fetch roads (Overpass recommended),
// render grey roads, highlight on hover/click, allow tap to pick start anchor, then manual drawing from anchor to destination,
// smooth polyline and save address (local or Firestore).

import { fetchRoadsOverpass /*, fetchRoadsWithGoogleSampling */ } from './roadsService.js';
import { startManualDrawing, smoothPolyline } from './drawing.js';
import { saveAddressLocal, getNearbySavedAddresses, listSavedLocal } from './storage.js';

let map, destinationMarker, roadsPolylines = [], highlightedPoly = null, startAnchor = null, drawingController = null;

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 37.7749, lng: -122.4194 },
    zoom: 16,
    clickableIcons: false,
  });

  map.addListener('click', async (e) => {
    await setDestination(e.latLng);
  });

  document.getElementById('btnFindMe').addEventListener('click', async () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const latLng = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
      await setDestination(latLng);
    }, (err) => alert('Geolocation failed: ' + err.message));
  });

  document.getElementById('btnSaveAddress').addEventListener('click', () => {
    if (!destinationMarker) return;
    const lat = destinationMarker.getPosition().lat();
    const lng = destinationMarker.getPosition().lng();
    const addr = { id: 'local_' + Date.now(), lat, lng, label: 'Saved Address ' + new Date().toISOString() };
    saveAddressLocal(addr);
    alert('Address saved locally.');
  });

  loadNearbySavedAddressesIfAny();
}

async function setDestination(latLng) {
  // Place marker
  if (destinationMarker) destinationMarker.setMap(null);
  destinationMarker = new google.maps.Marker({
    position: latLng,
    map,
    title: 'Doorstep (Destination)'
  });
  document.getElementById('btnSaveAddress').disabled = false;

  // fetch roads in 100m radius using Overpass
  const radiusMeters = 100;
  showLoading(true);
  try {
    const ways = await fetchRoadsOverpass({ lat: latLng.lat(), lng: latLng.lng() }, radiusMeters);
    renderRoadWays(ways);
    // Fit map to show roads + destination
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(latLng);
    for (const w of ways) for (const c of w.coordinates) bounds.extend(c);
    map.fitBounds(bounds);
  } catch (err) {
    console.error(err);
    alert('Failed to load roads: ' + err.message);
  } finally {
    showLoading(false);
  }
}

function renderRoadWays(ways) {
  // clear previous
  for (const p of roadsPolylines) p.setMap(null);
  roadsPolylines = [];

  for (const w of ways) {
    const poly = new google.maps.Polyline({
      path: w.coordinates,
      strokeColor: '#999999', // grey
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
      zIndex: 1,
    });
    poly._wayId = w.id;
    poly._tags = w.tags;
    poly.addListener('click', (e) => {
      onRoadClicked(poly, e);
    });
    poly.addListener('mouseover', () => {
      poly.setOptions({ strokeColor: '#666', strokeWeight: 6 });
    });
    poly.addListener('mouseout', () => {
      poly.setOptions({ strokeColor: '#999', strokeWeight: 4 });
    });
    roadsPolylines.push(poly);
  }
}

function onRoadClicked(poly, event) {
  // Any point on the road can be the start anchor — we choose clicked latLng.
  const clickedLatLng = event.latLng;
  if (startAnchor && startAnchor.marker) {
    startAnchor.marker.setMap(null);
    startAnchor = null;
  }
  startAnchor = {
    poly,
    latLng: clickedLatLng
  };
  new google.maps.Marker({
    position: clickedLatLng,
    map,
    title: 'Start Anchor',
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#FF0000', fillOpacity:1, strokeWeight:1 }
  });

  // begin manual drawing from this anchor
  if (drawingController) drawingController.stop();
  drawingController = startManualDrawing(map, { lat: clickedLatLng.lat(), lng: clickedLatLng.lng() }, (path) => {
    // on update
  }, (finalPath) => {
    // on finish
    // Smooth polyline, snap to ground is implicit (we used map clicks)
    const sm = smoothPolyline(finalPath, 2);
    // Replace drawing polyline with smoothed version
    if (drawingController && drawingController.getPolyline) {
      const dpoly = drawingController.getPolyline();
      dpoly.setPath(sm);
      dpoly.setOptions({ strokeColor: '#0033CC', strokeWeight: 4 });
    }
    // Offer to save address/route as needed
    const save = confirm('Save this route to this destination? (saved address remains the same)');
    if (save && destinationMarker) {
      const addr = { id: 'local_' + Date.now(), lat: destinationMarker.getPosition().lat(), lng: destinationMarker.getPosition().lng(), label: 'Saved '+new Date().toISOString(), route: sm };
      saveAddressLocal(addr);
      alert('Saved locally');
    }
  });
}

function showLoading(yes) {
  // simple UI touch
  document.getElementById('btnFindMe').disabled = yes;
}

function loadNearbySavedAddressesIfAny() {
  // If user is near a saved address within 100m, show list
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const nearby = getNearbySavedAddresses(c, 100);
    const container = document.getElementById('savedAddressesContainer');
    if (!nearby || nearby.length === 0) return;
    container.classList.remove('hidden');
    container.innerHTML = '<strong>Saved addresses near you</strong><br/>';
    nearby.forEach(a => {
      const el = document.createElement('div');
      el.style.margin = '6px 0';
      el.innerHTML = `<button data-id="${a.id}">Select</button> ${a.label}`;
      el.querySelector('button').addEventListener('click', () => {
        // show this address on map
        setDestination(new google.maps.LatLng(a.lat, a.lng));
      });
      container.appendChild(el);
    });
  }, (err) => {
    // ignore
  });
}

window.initMap = initMap;
document.addEventListener('DOMContentLoaded', () => initMap());
