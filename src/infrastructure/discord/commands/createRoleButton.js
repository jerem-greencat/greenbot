import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
    .setName('create-role-button')
    .setDescription('Publie un message avec des boutons pour choisir un rôle exclusif.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // 1️⃣ Sécurité : seuls les admins peuvent l’exécuter
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Vous devez être administrateur pour utiliser cette commande.', ephemeral: true });
        }
        
        // 2️⃣ Création des boutons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
            .setCustomId('select_excl_Bear')
            .setLabel('🐻🔴 Bear 🔴🐻')
            .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
            .setCustomId('select_excl_Wolf')
            .setLabel('🐺🔵 Wolf 🔵🐺')
            .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
            .setCustomId('select_excl_Neutral')
            .setLabel('⚪️ Neutre ⚪️')
            .setStyle(ButtonStyle.Primary),
        );
        
        // 3️⃣ Envoi du message
        await interaction.reply({
            content: 'Choisissez le rôle souhaité :',
            components: [row],
        });
    },
};




// import {
//     SlashCommandBuilder,
//     ActionRowBuilder,
//     ButtonBuilder,
//     ButtonStyle
// } from "discord.js";

// const roles = [
//     { value: "bear", label: "🐻🔴 Bear 🔴🐻", style: ButtonStyle.Secondary },
//     { value: "wolf", label: "🐺🔵 Wolf 🔵🐺", style: ButtonStyle.Secondary },
//     { value: "neutre", label: "⚪️ Neutre ⚪️", style: ButtonStyle.Secondary },
// ];

// export const data = new SlashCommandBuilder()
// .setName("create-role-button")
// .setDescription("Crée des boutons pour que les utilisateurs choisissent un rôle")
// .addStringOption(option =>
    //     option.setName("roles")
//     .setDescription("Ex: bear,wolf,neutre")
//     .setRequired(true)
// );

// function parseRoles(input) {
//     return input
//     .split(",")
//     .map(s => s.trim().toLowerCase())
//     .filter(r => ["bear", "wolf", "neutre"].includes(r));
// }

// export async function execute(interaction) {
//     const input = interaction.options.getString("roles");
//     const selectedRoles = parseRoles(input);

//     if (selectedRoles.length === 0) {
//         return interaction.reply({
//             content: "Merci de sélectionner au moins un rôle valide : bear, wolf, neutre.",
//             ephemeral: true
//         });
//     }

//     const buttons = selectedRoles.map(roleKey => {
    //         const role = roles.find(r => r.value === roleKey);
//         return new ButtonBuilder()
//         .setCustomId(`role:${role.value}`)
//         .setLabel(role.label)
//         .setStyle(role.style);
//     });

//     const row = new ActionRowBuilder().addComponents(buttons);

//     // Répondre avec les boutons
//     await interaction.reply({
//         content: "Choisissez votre rôle :",
//         components: [row],
//         ephemeral: false
//     });

//     // Générer un message d'aperçu des rôles
//     const initialCounts = selectedRoles
//     .map(roleKey => {
    //         const r = roles.find(r => r.value === roleKey);
//         return `${r.label} : 0`;
//     })
//     .join("\n");

//     await interaction.channel.send({
//         content: `**Répartition actuelle des rôles :**\n${initialCounts}`
//     });
// }
