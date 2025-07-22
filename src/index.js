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
    const allowedGuildIds = process.env.GUILD_IDS.split(',').map(id => id.trim());
    const targetGuilds = client.guilds.cache.map(g => g.id)
    .filter(id => allowedGuildIds.includes(id));
    if (!targetGuilds.length) {
        console.error('❌ Aucune guild autorisée n’est jointe → arrêt');
        process.exit(1);
    }
    
    // 2️⃣ Connexion à MongoDB
    await connectToDatabase();
    console.log('✅ MongoDB connecté');
    const db = mongoose.connection.db;
    
    // 3️⃣ Initialisation + synchronisation playersList (+ money)
    for (const guildId of targetGuilds) {
        const collName = `server_${guildId}`;
        const coll     = db.collection(collName);
        const guild    = client.guilds.cache.get(guildId);
        const members  = await guild.members.fetch();
        
        // 3.a Collection
        if (!(await db.listCollections({ name: collName }).hasNext())) {
            await db.createCollection(collName);
            console.log(`🗄️ Collection créée : ${collName}`);
        }
        
        // 3.b playersList existant ?
        const existing = await coll.findOne({ _id: 'playersList' });
        if (!existing) {
            // Premier lancement : insérer tous les membres + money à 0
            const players = members.map(m => ({
                userId:              m.user.id,
                tag:                 m.user.tag,
                joinedAt:            m.joinedAt,
                roles:               m.roles.cache.map(r => r.id),
                money:               0,
                lastExclusiveChange: null,
            }));
            await coll.insertOne({ _id: 'playersList', createdAt: new Date(), players });
            console.log(`🧩 playersList initialisé pour ${guildId} (${players.length} joueurs)`);
        } else {
            // Synchronisation : on corrige les rôles ET on ajoute money=0 si manquant
            const dbPlayers = Array.isArray(existing.players) ? existing.players : [];
            const currentMap = new Map(
                members.map(m => [m.user.id, m.roles.cache.map(r => r.id)])
            );
            
            for (const p of dbPlayers) {
                const actualRoles = currentMap.get(p.userId) || [];
                const oldRoles    = Array.isArray(p.roles) ? p.roles : [];
                const sameRoles   = oldRoles.length === actualRoles.length
                && oldRoles.every(rid => actualRoles.includes(rid));
                
                const hasMoney    = typeof p.money === 'number';
                
                // Si roles différents ou money manquant, on met à jour
                if (!sameRoles || !hasMoney) {
                    const update = { 'players.$.roles': actualRoles };
                    if (!hasMoney) update['players.$.money'] = 0;
                    await coll.updateOne(
                        { _id: 'playersList', 'players.userId': p.userId },
                        { $set: update }
                    );
                    console.log(
                        `🔄 Sync ${!sameRoles ? 'roles' : ''}${!sameRoles && !hasMoney ? ' & ' : ''}` +
                        `${!hasMoney ? 'money' : ''} pour ${p.userId} dans ${guildId}`
                    );
                }
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
    cron.schedule('0 0 * * *', async () => {
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
