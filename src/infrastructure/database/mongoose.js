// src/infrastructure/database/mongoose.js
import mongoose from 'mongoose';

export async function connectToDatabase() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI non défini dans .env');
        process.exit(1);
    }
    try {
        await mongoose.connect(uri, {
            useNewUrlParser:    true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connecté à MongoDB Atlas');
    } catch (err) {
        console.error('❌ Erreur de connexion à MongoDB :', err);
        process.exit(1);
    }
}
