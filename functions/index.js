const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

async function generateInventory() {
  const snap = await db
    .collection('negocio-tenis')
    .doc('shared_data')
    .collection('inventario')
    .where('status', '==', 'disponible')
    .get();
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const bucket = admin.storage().bucket();
  await bucket.file('inventory.json').save(JSON.stringify(data, null, 2), {
    contentType: 'application/json',
    public: true,
  });
}

exports.exportInventory = functions.https.onRequest(async (req, res) => {
  try {
    await generateInventory();
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send('Inventory exported');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

exports.exportInventoryOnChange = functions.firestore
  .document('negocio-tenis/shared_data/inventario/{id}')
  .onWrite(async () => {
    await generateInventory();
  });
