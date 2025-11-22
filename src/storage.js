// storage.js
// Simple localStorage-based saved-addresses plus an example Firestore wrapper (sketch).
//
// - saveAddressLocal({id, lat, lng, label, owner})
// - getNearbySavedAddresses(centerLatLng, radiusMeters)
// - (Optional) Firestore: initializeFirestore(config), saveAddressFirestore, queryNearbyFirestore
// 
// NOTE: For "show existing saved addresses to ANY user near that location" you'll need server-side storage.
// I outline Firestore usage as an example. Replace with your backend.

const LOCAL_KEY = 'rmd1.savedAddresses.v1';

export function saveAddressLocal(addr) {
  const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  list.push(addr);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  return addr;
}

export function listSavedLocal() {
  return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
}

export function getNearbySavedAddresses(center, radiusMeters = 100) {
  const all = listSavedLocal();
  return all.filter(a => haversineMeters(center.lat, center.lng, a.lat, a.lng) <= radiusMeters);
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

/* Firestore sketch (optional)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

let db = null;
export function initFirestore(firebaseConfig) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}
export async function saveAddressFirestore(addr) {
  if (!db) throw new Error('Firestore not initialized');
  const col = collection(db, 'savedAddresses');
  await addDoc(col, addr);
}
export async function queryNearbyFirestore(center, radiusMeters) {
  // For real production-scale proximity queries, use geohashes / geoqueries plugin or build geospatial index.
  // This sketch does a simple bounding-box filter then refine client-side.
}*/
