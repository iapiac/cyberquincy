const { SlashCommandBuilder } = require('discord.js');
const { red, cyber } = require('../jsons/colors.json');
const bHelper = require("../helpers/bloons-general.js");

const builder = new SlashCommandBuilder()
.setName('nft')
.setDescription('Calculate Quincy Action Figure buy/sell price in Shol Geraldo\'s shop')
.addIntegerOption(option => option.setName('unlock_round').setDescription("Start of round when the action figure is unlocked").setRequired(true).setMinValue(1))
.addIntegerOption(option => option.setName('start_round').setDescription("Round when the action figure is bought").setRequired(true).setMinValue(1))
.addIntegerOption(option => option.setName('end_round').setDescription("Round when the action figure is sold").setRequired(true).setMinValue(1))
.addStringOption(option => option
    .setName('difficulty')
    .setDescription("Gamemode difficulty")
    .setRequired(true)
    .addChoices(
        { name: 'Easy (Primary only, Deflation)', value: 'easy' },
        { name: 'Medium (Military only, Reverse, Apopalypse)', value: 'medium' },
        { name: 'Hard (Magic only, Double HP)', value: 'hard' },
        { name: 'Impoppable', value: 'impoppable' }
    )
)
.addBooleanOption(option => option
    .setName('better_sell_deals')
    .setDescription("Whether the Better Sell Deals MK is enabled")
    .setRequired(false)
);

/**
 * @param {number} unlock_round
 * @param {number} round
 */
function raw_nft_value(unlock_round, round) {
    let raw_result = 750
    * Math.pow(1.1, Math.min(round - unlock_round, 31 - unlock_round))
    * Math.pow(1.05, Math.max(Math.min(round - 31, 80 - 31), 0))
    * Math.pow(1.02, Math.max(round - 81, 0));
    return raw_result;
}

async function execute(interaction) {
    let unlock_round = interaction.options.getInteger("start_round");
    let start_round = interaction.options.getInteger("start_round");
    let end_round = interaction.options.getInteger("end_round");
    let difficulty = interaction.options.getString("difficulty");
    let better_sell_deals = interaction.options.getBoolean("better_sell_deals") ?? false;

    if (end_round < start_round) {
        return await interaction.reply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setTitle(`End round ${end_round} must be greater than or equal to the start round ${start_round}`)
                    .setColor(red)
            ]
        });
    }

    let start_price = bHelper.difficultyDiscountPriceMult(
        raw_nft_value(unlock_round, start_round), difficulty, 0, false
    );
    let end_price = Math.round(raw_nft_value(unlock_round, end_round) * (better_sell_deals ? 1 : 0.95));

    return await interaction.reply({
        embeds: [
            new Discord.EmbedBuilder()
                .setTitle(`You will make a profit of $${end_price - start_price}`)
                .setDescription(`Buy price: $${start_price}\nSell price: $${end_price}\n(Better Sell Deals MK enabled: ${better_sell_deals})`)
                .setColor(cyber)
        ]
    });
}

module.exports = {
    data: builder,
    execute
}
