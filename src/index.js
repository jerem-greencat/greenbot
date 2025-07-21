// src/index.js

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
    
    // 1️⃣ Filtrer les guildes autorisées depuis le .env
    const allowedGuildIds = process.env.GUILD_IDS
    .split(',')
    .map(id => id.trim());
    const joinedGuildIds = client.guilds.cache.map(g => g.id);
    const targetGuilds   = joinedGuildIds.filter(id => allowedGuildIds.includes(id));
    
    if (targetGuilds.length === 0) {
        console.error('❌ Aucune des guildes autorisées n’est jointe → arrêt du bot');
        return process.exit(1);
    }
    
    // 2️⃣ Se connecter à MongoDB
    await connectToDatabase();
    console.log('✅ MongoDB connecté');
    const db = mongoose.connection.db;
    
    // 3️⃣ Initialiser collections & document playersList pour chaque guild
    for (const guildId of targetGuilds) {
        const collName = `server_${guildId}`;
        const coll     = db.collection(collName);
        
        // Créer la collection si elle n’existe pas
        if (!(await db.listCollections({ name: collName }).hasNext())) {
            await db.createCollection(collName);
            console.log(`🗄️ Collection créée : ${collName}`);
        }
        
        // Initialiser le document playersList si absent
        const existing = await coll.findOne({ _id: 'playersList' });
        if (!existing) {
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
            console.log(`🧩 Initialisation playersList pour ${guildId} (${players.length} joueurs)`);
        } else {
            console.log(`ℹ️ playersList déjà initialisé pour ${guildId}`);
        }
    }
    
    // 4️⃣ Enregistrer les listeners qui utilisent la base de données
    client.on(Events.GuildMemberAdd,    onGuildMemberAdd);
    client.on(Events.GuildMemberRemove, onGuildMemberRemove);
    client.on(Events.GuildMemberUpdate, onGuildMemberUpdate);
    client.on(Events.InteractionCreate, onInteractionCreate);
    
    console.log('✅ Listeners enregistrés — démarrage complet');
});

client.login(process.env.DISCORD_TOKEN);
