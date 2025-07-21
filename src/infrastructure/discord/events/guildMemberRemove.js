import mongoose from 'mongoose';

export default async function onGuildMemberRemove(member) {
    const db       = mongoose.connection.db;
    const collName = `server_${member.guild.id}`;
    const coll     = db.collection(collName);
    
    // Supprime le joueur de la liste
    await coll.updateOne(
        { _id: 'playersList' },
        {
            $pull: {
                players: { userId: member.user.id }
            },
        }
    );
    
    console.log(`➖ Membre supprimé de la base : ${member.user.tag}`);
}
