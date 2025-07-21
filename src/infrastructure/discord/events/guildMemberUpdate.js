// src/infrastructure/discord/events/guildMemberUpdate.js
import mongoose from 'mongoose';
import { AuditLogEvent } from 'discord.js';

export default async function onGuildMemberUpdate(oldMember, newMember) {
    const db   = mongoose.connection.db;
    const coll = db.collection(`server_${newMember.guild.id}`);
    
    // 1. Récupère les noms exclusifs et leurs objets Role
    const exclusiveNames = [
        process.env.BEAR_ROLE_NAME,
        process.env.WOLF_ROLE_NAME,
        process.env.NEUTRAL_ROLE_NAME,
    ].filter(Boolean);
    
    const guildRoles = newMember.guild.roles.cache;
    const exclusiveRoles = exclusiveNames
    .map(name => guildRoles.find(r => r.name === name))
    .filter(Boolean);
    
    // 2. IDs des rôles AVANT / APRÈS
    const oldIds = oldMember.roles.cache.map(r => r.id);
    const newIds = newMember.roles.cache.map(r => r.id);
    
    // 3. Détecte l’exclusif ajouté
    const addedIds     = newIds.filter(id => !oldIds.includes(id));
    const newExclRole  = exclusiveRoles.find(r => addedIds.includes(r.id));
    if (!newExclRole) return;  // pas un exclusif → on sort
    
    // 4. Qui a fait le changement ? On regarde les Audit Logs
    const audit = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 5,
    });
    // on cherche la première entrée qui cible ce membre
    const entry = audit.entries.find(e => e.targetId === newMember.id);
    let executorIsAdmin = false;
    if (entry) {
        try {
            const execMember = await newMember.guild.members.fetch(entry.executor.id);
            executorIsAdmin = execMember.permissions.has('Administrator');
        } catch {
            executorIsAdmin = false;
        }
    }
    
    // 5. Récupère la date du dernier changement exclusif en base
    const playerDoc = await coll.findOne(
        { _id: 'playersList', 'players.userId': newMember.user.id },
        { projection: { 'players.$': 1 } }
    );
    const player = playerDoc.players[0];
    const lastChange = player.lastExclusiveChange
    ? new Date(player.lastExclusiveChange)
    : new Date(0);
    
    const now = Date.now();
    const delay = 48 * 60 * 60 * 1000; // 48 h en ms
    
    // 6. Si ce n'est pas l'admin ET que c'est trop tôt → on bloque
    if (!executorIsAdmin && now - lastChange < delay) {
        await newMember.roles.remove(newExclRole.id);
        
        // (Optionnel) remet l’ancien exclusif si tu veux
        const oldExclRole = exclusiveRoles.find(r => oldIds.includes(r.id));
        if (oldExclRole) {
            await newMember.roles.add(oldExclRole.id);
        }
        
        try {
            await newMember.send(
                `🕒 Tu peux changer ton rôle exclusif qu'une fois toutes les 48 heures. ` +
                `Dernière modif : ${lastChange.toLocaleString()}.`
            );
        } catch {}
        
        console.log(
            `⚠️ ${newMember.user.tag} a tenté de changer d'exclusif trop tôt (executor ${entry?.executor.tag || 'inconnu'}).`
        );
        return;
    }
    
    // 7. Sinon (admin ou délai OK) → on retire les autres exclusifs et on met à jour
    const toRemove = exclusiveRoles
    .filter(r => r.id !== newExclRole.id)
    .map(r => r.id);
    await newMember.roles.remove(toRemove);
    
    // refetch pour avoir le cache rôles à jour
    const updatedMember = await newMember.fetch();
    const updatedRoleIds = updatedMember.roles.cache.map(r => r.id);
    
    // on applique en base : nouveau tableau roles + timestamp
    await coll.updateOne(
        { _id: 'playersList' },
        {
            $set: {
                'players.$[p].roles':               updatedRoleIds,
                'players.$[p].lastExclusiveChange': new Date(),
            },
        },
        { arrayFilters: [{ 'p.userId': newMember.user.id }] }
    );
    
    console.log(
        `✅ Exclusif "${newExclRole.name}" forcé pour ${newMember.user.tag}` +
        (executorIsAdmin ? ' (par admin)' : '')
    );
}
