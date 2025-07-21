const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');

admin.initializeApp();
const db = admin.firestore();

exports.exportInventory = functions.region('us-central1').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const snap = await db
      .collection('negocio-tenis')
      .doc('shared_data')
      .collection('inventario')
      .where('status', '==', 'disponible')
      .get();

    const convertTimestamps = (obj) => {
      if (obj instanceof Timestamp) {
        return { seconds: obj.seconds, nanoseconds: obj.nanoseconds };
      }
      if (Array.isArray(obj)) return obj.map(convertTimestamps);
      if (obj && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [k, convertTimestamps(v)]),
        );
      }
      return obj;
    };

    const data = snap.docs.map((d) =>
      convertTimestamps({ id: d.id, ...d.data() }),
    );
    res.status(200).json(data);
  } catch (err) {
    console.error('Failed to export inventory', err);
    res.status(500).send('Internal Error');
  }
});
