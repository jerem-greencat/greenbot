import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import mongoose from 'mongoose';
import { connectToDatabase } from './infrastructure/database/mongoose.js';

import onGuildMemberAdd    from './infrastructure/discord/events/guildMemberAdd.js';
import onGuildMemberRemove from './infrastructure/discord/events/guildMemberRemove.js';
import onGuildMemberUpdate from './infrastructure/discord/events/guildMemberUpdate.js';
import onInteractionCreate from './infrastructure/discord/events/interactionCreate.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
    ],
});

client.once(Events.ClientReady, async () => {
    console.log(`👋 Connecté en tant que ${client.user.tag}`);
    
    // ––– Filtrer les guildes autorisées
    const allowed = process.env.GUILD_IDS.split(',').map(id => id.trim());
    const joined = client.guilds.cache.map(g => g.id);
    const targetGuilds = joined.filter(id => allowed.includes(id));
    if (!targetGuilds.length) {
        console.error('❌ Aucune guild autorisée n’est jointe → arrêt');
        return process.exit(1);
    }
    
    // ––– Connexion à MongoDB
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    // ––– Pour chaque guild : créer la collection + doc playersList (sinon)
    for (const guildId of targetGuilds) {
        const collName = `server_${guildId}`;
        const coll = db.collection(collName);
        
        // Création de la collection si nécessaire
        if (!(await db.listCollections({ name: collName }).hasNext())) {
            await db.createCollection(collName);
            console.log(`🗄️ Collection ${collName} créée`);
        }
        
        // Initialisation du document playersList
        const existing = await coll.findOne({ _id: 'playersList' });
        if (!existing) {
            // Fetch members & construire la liste
            const guild   = client.guilds.cache.get(guildId);
            const members = await guild.members.fetch();
            const players = members.map(m => ({
                userId:              m.user.id,
                tag:                 m.user.tag,
                joinedAt:            m.joinedAt,
                roles:               m.roles.cache.map(r => r.id),
                lastExclusiveChange: null,
            }));
            
            await coll.insertOne({
                _id:       'playersList',
                createdAt: new Date(),
                players,
            });
            console.log(`🧩 Liste de ${players.length} joueurs initialisée pour ${guildId}`);
        } else {
            console.log(`ℹ️ playersList déjà présent pour ${guildId}`);
        }
    }
    
    console.log('✅ Démarrage complet');
});

// Brancher les events
client.on(Events.GuildMemberAdd,    onGuildMemberAdd);
client.on(Events.GuildMemberRemove, onGuildMemberRemove);
client.on(Events.GuildMemberUpdate, onGuildMemberUpdate);
client.on(Events.InteractionCreate, onInteractionCreate);

client.login(process.env.DISCORD_TOKEN);
