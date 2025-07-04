const fs = require('fs');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

async function main() {
  const credentialsPath = process.argv[2];
  if (!credentialsPath) {
    console.error('Usage: node clear-fotos.js <serviceAccount.json>');
    process.exit(1);
  }
  if (!fs.existsSync(credentialsPath)) {
    console.error('Credentials file not found:', credentialsPath);
    process.exit(1);
  }
  initializeApp({
    credential: cert(require(credentialsPath)),
  });

  const db = getFirestore();
  const inventarioRef = db.collection('negocio-tenis').doc('shared_data').collection('inventario');

  const snapshot = await inventarioRef.get();
  const batch = db.batch();
  snapshot.forEach((doc) => {
    batch.update(doc.ref, { foto: '' });
  });
  await batch.commit();
  console.log(`Updated ${snapshot.size} products`);
}

main().catch((err) => {
  console.error('Failed to clear fotos:', err);
  process.exit(1);
});

