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
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,  // pour fetch tous les membres
    ],
});

client.once('ready', async () => {
    console.log(`👋 Connecté en tant que ${client.user.tag}`);
    
    // 1️⃣ Récupère et filtre les guildes autorisées
    const allowedGuilds = process.env.GUILD_IDS
    .split(',')
    .map(id => id.trim());
    const joined = client.guilds.cache.map(g => g.id);
    const targetGuilds = joined.filter(id => allowedGuilds.includes(id));
    if (!targetGuilds.length) {
        console.error('❌ Aucune guild autorisée n’est jointe → arrêt');
        return process.exit(1);
    }
    
    // 2️⃣ Connexion à MongoDB
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    // 3️⃣ Pour chaque guild, on synchronise la collection et son doc 'playersList'
    for (const guildId of targetGuilds) {
        const collName = `server_${guildId}`;
        const coll = db.collection(collName);
        
        // 3.a Collection : création si absente
        const exists = await db.listCollections({ name: collName }).hasNext();
        if (!exists) {
            await db.createCollection(collName);
            console.log(`🗄️ Collection ${collName} créée`);
        }
        
        // 3.b Fetch membres Discord
        const guild = client.guilds.cache.get(guildId);
        const members = await guild.members.fetch();  // Map<id, GuildMember>

        const currentPlayers = members.map(m => ({
            userId:   m.user.id,
            tag:      m.user.tag,
            joinedAt: m.joinedAt,
            roles:    m.roles.cache.map(r => r.id),      // ← tableau de role IDs
            lastExclusiveChange: null,
        }));
        
        // 3.c Récupère le doc playersList existant (s’il y en a un)
        const doc = await coll.findOne({ _id: 'playersList' });
        
        if (!doc) {
            // Premier lancement : on insère tout
            await coll.insertOne({
                _id:       'playersList',
                createdAt: new Date(),
                players:   currentPlayers,
            });
            console.log(`🧩 Initialisation de ${currentPlayers.length} joueurs pour ${guildId}`);
        } else {
            // Synchronisation incrémentale
            const existing = doc.players;  // array of { userId, tag, joinedAt }
            const existingIds = new Set(existing.map(p => p.userId));
            const currentIds  = new Set(currentPlayers.map(p => p.userId));
            
            //  ➕ Nouveaux arrivants
            const toAdd = currentPlayers.filter(p => !existingIds.has(p.userId));
            //  ➖ Ceux qui sont partis
            const toRemoveIds = existing
            .filter(p => !currentIds.has(p.userId))
            .map(p => p.userId);
            
            // 3.d Applique les modifications
            const updateOps = {};
            if (toAdd.length) {
                updateOps.$push = { players: { $each: toAdd } };
            }
            if (toRemoveIds.length) {
                updateOps.$pull = { players: { userId: { $in: toRemoveIds } } };
            }
            
            if (Object.keys(updateOps).length) {
                await coll.updateOne({ _id: 'playersList' }, updateOps);
                console.log(
                    `🔄 Synchro pour ${guildId} : +${toAdd.length} / -${toRemoveIds.length}`
                );
            } else {
                console.log(`ℹ️ Liste déjà à jour pour ${guildId}`);
            }
        }
    }
    
    console.log('✅ Démarrage complet');
});

client.on(Events.GuildMemberAdd,    onGuildMemberAdd);
client.on(Events.GuildMemberRemove, onGuildMemberRemove);
client.on(Events.GuildMemberUpdate, onGuildMemberUpdate);
client.on(Events.InteractionCreate, onInteractionCreate);




client.login(process.env.DISCORD_TOKEN);



// import { interactionCreate } from "./infrastructure/discord/events/interactionCreate.js";

// dotenv.config();

// const client = new Client({
//     intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
// });

// client.once(Events.ClientReady, () => {
    //     console.log(`🤖 Bot prêt : ${client.user.tag}`);
// });

// client.on(Events.InteractionCreate, interactionCreate.execute);


// client.login(process.env.DISCORD_TOKEN);
