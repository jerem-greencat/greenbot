// src/infrastructure/discord/events/guildMemberUpdate.js
import mongoose from 'mongoose';
import { AuditLogEvent } from 'discord.js';

export default async function onGuildMemberUpdate(oldMember, newMember) {
    const db   = mongoose.connection.db;
    const coll = db.collection(`server_${newMember.guild.id}`);
    
    // 1️⃣ Récupère les rôles exclusifs configurés
    const exclusiveNames = [
        process.env.BEAR_ROLE_NAME,
        process.env.WOLF_ROLE_NAME,
        process.env.NEUTRAL_ROLE_NAME,
    ].filter(Boolean);
    const guildRoles = newMember.guild.roles.cache;
    const exclusiveRoles = exclusiveNames
    .map(name => guildRoles.find(r => r.name === name))
    .filter(Boolean);
    
    // 2️⃣ Quels IDs avant / après ?
    const oldIds = oldMember.roles.cache.map(r => r.id);
    const newIds = newMember.roles.cache.map(r => r.id);
    
    // 3️⃣ Y a-t-il un exclusif ajouté ?
    const addedIds = newIds.filter(id => !oldIds.includes(id));
    const newExcl  = exclusiveRoles.find(r => addedIds.includes(r.id));
    if (!newExcl) return; // rien d’exclusif → on sort
    
    // 4️⃣ Qui a fait le changement ? (Audit Logs)
    const audit = await newMember.guild.fetchAuditLogs({
        type:  AuditLogEvent.MemberRoleUpdate,
        limit: 5,
    });
    const entry = audit.entries.find(e => e.targetId === newMember.id);
    const executorId = entry?.executor?.id;
    
    // 5️⃣ Bypass si c’est **le bot** lui-même
    const botId = newMember.client.user.id;
    if (executorId === botId) {
        // C’est nous : on ne ré-enclenche pas la logique de blocage
        return;
    }
    
    // 6️⃣ Sinon, déterminer si c’est un vrai admin
    let executorIsAdmin = false;
    if (entry) {
        try {
            const execMember = await newMember.guild.members.fetch(executorId);
            executorIsAdmin = execMember.permissions.has('Administrator');
        } catch {
            executorIsAdmin = false;
        }
    }
    
    // 7️⃣ Récupère la date du dernier changement exclusif en base
    const playerDoc = await coll.findOne(
        { _id: 'playersList', 'players.userId': newMember.user.id },
        { projection: { 'players.$': 1 } }
    );
    const player = playerDoc?.players?.[0] || {};
    const lastChange = player.lastExclusiveChange
    ? new Date(player.lastExclusiveChange)
    : new Date(0);
    
    // 8️⃣ Si pas admin ET trop tôt → on remet l’ancien exclusif et on sort
    const now   = Date.now();
    const delay = 48 * 60 * 60 * 1000;
    if (!executorIsAdmin && (now - lastChange) < delay) {
        // retire le nouveau exclusif ajouté
        await newMember.roles.remove(newExcl.id);
        // remet l’ancien s’il existait
        const oldExcl = exclusiveRoles.find(r => oldIds.includes(r.id));
        if (oldExcl) {
            await newMember.roles.add(oldExcl.id);
        }
        return;
    }
    
    // 9️⃣ OK → on retire les autres et on met à jour en base + timestamp
    const toRemove = exclusiveRoles
    .filter(r => r.id !== newExcl.id)
    .map(r => r.id);
    if (toRemove.length) {
        await newMember.roles.remove(toRemove);
    }
    
    const updated = await newMember.fetch();
    const updatedIds = updated.roles.cache.map(r => r.id);
    await coll.updateOne(
        { _id: 'playersList' },
        {
            $set: {
                'players.$[p].roles':               updatedIds,
                'players.$[p].lastExclusiveChange': new Date()
            }
        },
        { arrayFilters: [{ 'p.userId': newMember.user.id }] }
    );
}
