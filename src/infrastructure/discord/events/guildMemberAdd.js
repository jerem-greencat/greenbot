// src/infrastructure/discord/events/guildMemberAdd.js
import mongoose from 'mongoose';

export default async function onGuildMemberAdd(member) {
    const db        = mongoose.connection.db;
    const collName = `server_${member.guild.id}`;
    const coll      = db.collection(collName);
    
    // Si jamais la doc playersList n'existe pas (au cas où)
    const doc = await coll.findOne({ _id: 'playersList' });
    if (!doc) {
        await coll.insertOne({
            _id:       'playersList',
            createdAt: new Date(),
            players:   [],
        });
    }
    
    // Ajoute le nouveau membre sans duplication
    await coll.updateOne(
        { _id: 'playersList' },
        {
            $addToSet: {
                players: {
                    userId:   member.user.id,
                    tag:      member.user.tag,
                    roles:    member.roles.cache.map(r => r.id),
                    joinedAt: member.joinedAt,
                },
            },
        }
    );
    
    console.log(`➕ Membre ajouté en base : ${member.user.tag}`);
}
