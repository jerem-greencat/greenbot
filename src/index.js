// src/index.js

import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import mongoose from 'mongoose';
import cron from 'node-cron';

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
    
    // 1️⃣ Filtrer les guildes autorisées
    const allowedGuildIds = process.env.GUILD_IDS
    .split(',')
    .map(id => id.trim());
    const joinedGuildIds = client.guilds.cache.map(g => g.id);
    const targetGuilds   = joinedGuildIds.filter(id => allowedGuildIds.includes(id));
    if (targetGuilds.length === 0) {
        console.error('❌ Aucune guild autorisée n’est jointe → arrêt');
        return process.exit(1);
    }
    
    // 2️⃣ Connexion à MongoDB
    await connectToDatabase();
    console.log('✅ MongoDB connecté');
    const db = mongoose.connection.db;
    
    // 3️⃣ Initialisation + synchronisation playersList
    for (const guildId of targetGuilds) {
        const collName = `server_${guildId}`;
        const coll     = db.collection(collName);
        const guild    = client.guilds.cache.get(guildId);
        
        // 3.a Création collection
        if (!(await db.listCollections({ name: collName }).hasNext())) {
            await db.createCollection(collName);
            console.log(`🗄️ Collection créée : ${collName}`);
        }
        
        // 3.b Récupération/insertion playersList
        const existing = await coll.findOne({ _id: 'playersList' });
        const members  = await guild.members.fetch();
        
        if (!existing) {
            // premier lancement : on insère tout
            const players = members.map(m => ({
                userId:              m.user.id,
                tag:                 m.user.tag,
                joinedAt:            m.joinedAt,
                roles:               m.roles.cache.map(r => r.id),
                lastExclusiveChange: null,
            }));
            await coll.insertOne({ _id: 'playersList', createdAt: new Date(), players });
            console.log(`🧩 playersList initialisé pour ${guildId} (${players.length} joueurs)`);
            
        } else {
            // synchronisation : DB vs Discord
            const dbPlayers = Array.isArray(existing.players) ? existing.players : [];
            const currentMap = new Map(
                members.map(m => [m.user.id, m.roles.cache.map(r => r.id)])
            );
            const updates = [];
            
            for (const p of dbPlayers) {
                const actual   = currentMap.get(p.userId) || [];
                const oldRoles = Array.isArray(p.roles) ? p.roles : [];
                const same = oldRoles.length === actual.length &&
                oldRoles.every(rid => actual.includes(rid));
                if (!same) updates.push({ userId: p.userId, roles: actual });
            }
            
            for (const { userId, roles } of updates) {
                await coll.updateOne(
                    { _id: 'playersList', 'players.userId': userId },
                    { $set: { 'players.$.roles': roles } }
                );
                console.log(`🔄 Rôles synchronisés en base pour ${userId} (${guildId})`);
            }
            if (updates.length === 0) {
                console.log(`ℹ️ playersList déjà synchronisé pour ${guildId}`);
            }
        }
    }
    
    // 4️⃣ Enregistrement des listeners
    client.on(Events.GuildMemberAdd,    onGuildMemberAdd);
    client.on(Events.GuildMemberRemove, onGuildMemberRemove);
    client.on(Events.GuildMemberUpdate, onGuildMemberUpdate);
    client.on(Events.InteractionCreate, onInteractionCreate);
    console.log('✅ Listeners enregistrés — démarrage complet');
    
    // 5️⃣ Cron à 12:00 (dev) / 00:00 (prod) Europe/Paris
    cron.schedule('0 12 * * *', async () => {
        for (const guild of client.guilds.cache.values()) {
            const coll = db.collection(`server_${guild.id}`);
            const cfg  = await coll.findOne({ _id: 'config' });
            if (!cfg?.reportChannelId) continue;
            
            const channel = guild.channels.cache.get(cfg.reportChannelId);
            if (!channel?.isTextBased()) continue;
            
            // 5.a) Supprimer l’ancien rapport
            if (cfg.lastReportMessageId) {
                try {
                    const oldMsg = await channel.messages.fetch(cfg.lastReportMessageId);
                    await oldMsg.delete();
                } catch {}
            }
            
            // 5.b) Récupérer dynamiquement les IDs des rôles Bear & Wolf
            const bearRoleName = process.env.BEAR_ROLE_NAME;
            const wolfRoleName = process.env.WOLF_ROLE_NAME;
            const bearRole     = guild.roles.cache.find(r => r.name === bearRoleName);
            const wolfRole     = guild.roles.cache.find(r => r.name === wolfRoleName);
            const bearId       = bearRole?.id;
            const wolfId       = wolfRole?.id;
            if (!bearId || !wolfId) {
                console.warn(`⚠️ Rôles Bear/Wolf introuvables dans ${guild.id}`);
                continue;
            }
            
            // 5.c) Filtrer en base selon les IDs récupérés
            const playersDoc = await coll.findOne({ _id: 'playersList' });
            const players    = Array.isArray(playersDoc?.players) ? playersDoc.players : [];
            
            const bears = players
            .filter(p => p.roles.includes(bearId))
            .map(p => `<@${p.userId}>`);
            
            const wolves = players
            .filter(p => p.roles.includes(wolfId))
            .map(p => `<@${p.userId}>`);
            
            // 5.d) Envoyer et enregistrer nouveau message
            const dateStr = new Date().toLocaleDateString('fr-FR');
            const msgBody = [
                `**📊 Rapport quotidien — ${dateStr}**`,
                ``,
                `**🐻 Bears (${bears.length})**`,
                bears.length ? bears.join(' ') : '_Aucun_',
                ``,
                `**🐺 Wolves (${wolves.length})**`,
                wolves.length ? wolves.join(' ') : '_Aucun_'
            ].join('\n');
            
            const sent = await channel.send(msgBody);
            await coll.updateOne(
                { _id: 'config' },
                { $set: { lastReportMessageId: sent.id } },
                { upsert: true }
            );
        }
    }, {
        scheduled: true,
        timezone: 'Europe/Paris'
    });
});

client.login(process.env.DISCORD_TOKEN);
