const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

async function main() {
  const credPath = process.argv[2];
  if (!credPath || !fs.existsSync(credPath)) {
    console.error('Usage: node export-inventory.js <serviceAccount.json>');
    process.exit(1);
  }

  initializeApp({ credential: cert(require(credPath)) });
  const db = getFirestore();

  const inventario = db
    .collection('negocio-tenis')
    .doc('shared_data')
    .collection('inventario');

  const snap = await inventario.where('status', '==', 'disponible').get();

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
  fs.writeFileSync('inventory.json', JSON.stringify(data, null, 2));
  console.log(`Exported ${data.length} products to inventory.json`);
}

main().catch((err) => {
  console.error('Failed to export inventory:', err);
  process.exit(1);
});
