export async function execute(interaction) {
    const input = interaction.options.getString("roles");
    const selectedRoles = parseRoles(input);
    
    if (selectedRoles.length === 0) {
        return interaction.reply({ content: "Merci de sélectionner au moins un rôle valide : bear, wolf, neutre.", ephemeral: true });
    }
    
    const buttons = selectedRoles.map(roleKey => {
        const role = roles.find(r => r.value === roleKey);
        return new ButtonBuilder()
        .setCustomId(`role:${role.value}`)
        .setLabel(role.label)
        .setStyle(role.style);
    });
    
    const row = new ActionRowBuilder().addComponents(buttons);
    
    // On répond avec un message visible par tous (non éphémère)
    await interaction.reply({
        content: "Choisissez votre rôle :",
        components: [row],
        ephemeral: false,
    });
    
    // On envoie un message d’aperçu dans le même canal
    await interaction.channel.send({
        content: "**Répartition actuelle des rôles :**\n🐻 Bear : 0\n🐺 Wolf : 0\n⚪️ Neutre : 0"
    });
}
