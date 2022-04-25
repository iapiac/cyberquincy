const MapParser = require('../parser/map-parser');
const NaturalNumberParser = require('../parser/natural-number-parser');
const PersonParser = require('../parser/person-parser');
const TowerParser = require('../parser/tower-parser');

const Parsed = require('../parser/parsed')

const gHelper = require('../helpers/general.js');
const Index = require('../helpers/index.js');
const discordHelper = require('../helpers/discord.js');

const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

const { paleorange } = require('../jsons/colours.json');

const { 
    SlashCommandBuilder, 
    SlashCommandStringOption, 
    SlashCommandIntegerOption, 
} = require('@discordjs/builders');

const mapOption = 
    new SlashCommandStringOption()
        .setName('map')
        .setDescription('Map')
        .setRequired(false);

const tower1Option = 
    new SlashCommandStringOption()
        .setName('tower1')
        .setDescription('A Tower')
        .setRequired(false)

const tower2Option = 
    new SlashCommandStringOption()
        .setName('tower2')
        .setDescription('A Tower')
        .setRequired(false)

const numTowerTypesOption = 
    new SlashCommandIntegerOption()
        .setName('num_tower_types')
        .setDescription('Number of tower types')
        .setRequired(false)

const personOption = 
    new SlashCommandStringOption()
        .setName('person')
        .setDescription('Completer')
        .setRequired(false);

const reloadOption =
    new SlashCommandStringOption()
        .setName('reload')
        .setDescription('Do you need to reload completions from the index but for a much slower runtime?')
        .setRequired(false)
        .addChoice('Yes', 'yes')

builder = 
    new SlashCommandBuilder()
        .setName('fttc')
        .setDescription('Search and Browse Completed FTTC Index Combos')
        .addStringOption(mapOption)
        .addStringOption(tower1Option)
        .addStringOption(tower2Option)
        .addIntegerOption(numTowerTypesOption)
        .addStringOption(personOption)
        .addStringOption(reloadOption)

async function execute(interaction) {
    const validationFailure =  validateInput(interaction);
    if (validationFailure) {
        return interaction.reply({
            content: validationFailure,
            ephemeral: true,
        })
    }

    const parsed = parseAll(interaction).reduce(
        (combinedParsed, nextParsed) => combinedParsed.merge(nextParsed),
        new Parsed()
    )

    await interaction.deferReply()

    const forceReload = interaction.options.getString('reload') ? true : false

    const allCombos = await Index.fetchCombos('fttc', reload=forceReload)

    const mtime = Index.getLastCacheModified('fttc')

    let filteredCombos = filterResults(allCombos, parsed);

    if (filteredCombos.length == 0) {
        const noCombosEmbed = new Discord.MessageEmbed().setTitle(titleNoCombos(parsed)).setColor(paleorange);

        return interaction.editReply({ embeds: [noCombosEmbed] });
    } else {
        return await embedOneOrMultiplePages(interaction, parsed, filteredCombos, mtime);
    }
}
                
////////////////////////////////////////////////////////////
// Parsing SlashCommand Input
////////////////////////////////////////////////////////////

function parseMap(interaction) {
    const map = interaction.options.getString('map')
    if (map) {
        const canonicalMap = Aliases.getCanonicalForm(map)
        if (canonicalMap) {
            return CommandParser.parse([canonicalMap], new MapParser())
        } else {
            const parsed = new Parsed()
            parsed.addError('Canonical not found')
            return parsed;
        }
    } else return new Parsed();
}

function parseTower(interaction, num) {
    const tower = interaction.options.getString(`tower${num}`)
    if (tower) {
        const canonicalTower = Aliases.canonicizeArg(tower)
        if (canonicalTower) {
            return CommandParser.parse([canonicalTower], new TowerParser())
        } else {
            const parsed = new Parsed()
            parsed.addError('Canonical not found')
            return parsed;
        }
    } else return new Parsed();
}

function parsePerson(interaction) {
    const u = interaction.options.getString('person')?.toLowerCase()
    if (u) {
        return CommandParser.parse([`user#${u}`], new PersonParser())
    } else return new Parsed();
}

function parseNumTowerTypes(interaction) {
    const n = interaction.options.getInteger('num_tower_types')
    if (n || n == 0) {
        return CommandParser.parse([n], new NaturalNumberParser())
    } else return new Parsed();
}

function parseAll(interaction) {
    const parsedMap = parseMap(interaction)
    const parsedTower1 = parseTower(interaction, 1)
    const parsedTower2 = parseTower(interaction, 2)
    const parsedPerson = parsePerson(interaction)
    const parsedNumTowerTypes = parseNumTowerTypes(interaction)

    return [parsedMap, parsedTower1, parsedTower2, parsedNumTowerTypes, parsedPerson];
}

function validateInput(interaction) {
    let [parsedMap, parsedTower1, parsedTower2, parsedNumTowerTypes, _,] = parseAll(interaction)

    if (parsedMap.hasErrors()) {
        return `Map not valid`
    }

    if (parsedTower1.hasErrors()) {
        return 'Tower1 did not match a tower'
    }

    if (parsedTower2.hasErrors()) {
        return 'Tower2 did not match a towe'
    }

    if (parsedNumTowerTypes.hasErrors()) {
        return `Number of Combos must be >= 1`
    }

    const parsedTowers = parsedTower1.merge(parsedTower2)
    if (parsedTowers.towers && parsedTowers.towers.length > parsedNumTowerTypes.natural_number) {
        const formattedTowers = parsedTowers.towers.map(t => Aliases.toIndexNormalForm(t))
        return `You searched more towers (${formattedTowers.join(', ')}) than the number of tower types you specified (${parsedNumTowerTypes.natural_number})`
    }

    if (parsedMap.map && parsedNumTowerTypes.hasAny()) {
        return `Map + Number of Tower Types either conflict or are redundant; don't search both`
    }
}

function filterResults(allCombos, parsed) {
    results = allCombos;

    if (parsed.map) {
        results = results.filter((combo) => Aliases.toAliasNormalForm(combo.MAP) == parsed.map);
    }
    
    if (parsed.natural_number) {
        results = results.filter((combo) => combo.TOWERS.length === parsed.natural_number);
    }

    if (parsed.person) {
        results = results.filter((combo) => {
            return combo.PERSON.toLowerCase().split(' ').join('_') === parsed.person.toLowerCase().split(' ').join('_')
        });
    }

    if (parsed.towers) {
        results = results.filter((combo) => parsed.towers.every((specifiedTower) => combo.TOWERS.includes(specifiedTower)));
    }

    if (keepOnlyOG(parsed) || !parsed.hasAny()) {
        results = results.filter((combo) => combo.OG);
    }

    return results;
}

function keepOnlyOG(parsed) {
    return parsed.natural_number && !parsed.person && !parsed.tower;
}

////////////////////////////////////////////////////////////
// Display Combos
////////////////////////////////////////////////////////////

const FTTC_TOWER_ABBREVIATIONS = {
    dart_monkey: 'drt',
    boomerang_monkey: 'boo',
    bomb_shooter: 'bmb',
    tack_shooter: 'tac',
    ice_monkey: 'ice',
    glue_gunner: 'glu',
    sniper_monkey: 'sni',
    monkey_sub: 'sub',
    monkey_buccaneer: 'buc',
    monkey_ace: 'ace',
    heli_pilot: 'hel',
    mortar_monkey: 'mor',
    dartling_gunner: 'dlg',
    wizard_monkey: 'wiz',
    super_monkey: 'sup',
    ninja_monkey: 'nin',
    alchemist: 'alc',
    druid_monkey: 'dru',
    spike_factory: 'spk',
    monkey_village: 'vil',
    engineer: 'eng'
};

async function embedOneOrMultiplePages(interaction, parsed, combos, mtime) {
    // Setup / Data consolidation
    let displayCols = ['TOWERS', 'MAP', 'PERSON', 'LINK'];

    if (parsed.person) {
        displayCols = displayCols.filter((col) => col != 'PERSON');
    }

    if (parsed.map) {
        displayCols = displayCols.filter((col) => col != 'MAP');
    }

    if (displayCols.length === 4) {
        displayCols = displayCols.filter((col) => col != 'PERSON');
    }
    const colData = Object.fromEntries(
        displayCols.map((col) => {
            if (col == 'TOWERS') {
                const boldedAbbreviatedTowers = combos.map((combo) =>
                    combo[col].map((tower) => {
                        if (tower) {
                            const towerCanonical = Aliases.getCanonicalForm(tower);
                            const towerAbbreviation = FTTC_TOWER_ABBREVIATIONS[towerCanonical].toUpperCase();
                            return parsed.towers && parsed.towers.includes(towerCanonical)
                                ? `**${towerAbbreviation}**`
                                : towerAbbreviation;
                        }
                    })
                );
                const colValues = boldedAbbreviatedTowers.map((comboTowers, i) => {
                    let value = comboTowers.join(' | ');
                    if (combos[i].OG && !parsed.towers) {
                        value = `**${value}**`;
                    }
                    return value;
                });
                return [col, colValues]
            } else {
                const colValues = combos.map((combo) => {
                    value = combo[col];
                    if (combo.OG) {
                        value = `**${value}**`;
                    }
                    return value;
                });
                return [col, colValues]
            }
        })
    );
    const numOGCompletions = combos.filter((combo) => combo.OG).length;

    return await displayOneOrMultiplePages(
        interaction, 
        parsed, 
        combos, 
        colData, 
        numOGCompletions, 
        mtime
    )
}

const multipageButtons = new MessageActionRow().addComponents(
    new MessageButton().setCustomId('-1').setLabel('⬅️').setStyle('PRIMARY'),
    new MessageButton().setCustomId('1').setLabel('➡️').setStyle('PRIMARY')
);

async function displayOneOrMultiplePages(
    interaction,
    parsed,
    combos,
    colData,
    numOGCompletions,
    mtime
) {
    MAX_NUM_ROWS = 15;
    const numRows = colData[Object.keys(colData)[0]].length;
    let leftIndex = 0;
    let rightIndex = Math.min(MAX_NUM_ROWS - 1, numRows - 1);

    /**
     * creates embed for next page
     * @param {int} direction
     * @returns {MessageEmbed}
     */
    async function createPage(direction = 1) {
        // The number of rows to be displayed is variable depending on the characters in each link
        // Try 15 and decrement every time it doesn't work.
        for (
            maxNumRowsDisplayed = MAX_NUM_ROWS;
            maxNumRowsDisplayed > 0;
            maxNumRowsDisplayed--
        ) {
            let challengeEmbed = new Discord.MessageEmbed()
                .setTitle(embedTitle(parsed, combos))
                .setDescription(`Index last reloaded ${gHelper.timeSince(mtime)} ago`)
                .setColor(paleorange);

            challengeEmbed.addField(
                '# Combos',
                `**${leftIndex + 1}**-**${rightIndex + 1}** of ${numRows}`
            );

            for (header in colData) {
                const data =
                    numRows <= maxNumRowsDisplayed
                        ? colData[header]
                        : colData[header].slice(leftIndex, rightIndex + 1);

                challengeEmbed.addField(
                    gHelper.toTitleCase(header.split('_').join(' ')),
                    data.join('\n'),
                    true
                );
            }

            if (numOGCompletions == 1) {
                challengeEmbed.setFooter({ text: `---\nOG completion bolded` });
            }
            if (numOGCompletions > 1) {
                challengeEmbed.setFooter({
                    text: `---\n${numOGCompletions} OG completions bolded`
                });
            }

            if (discordHelper.isValidFormBody(challengeEmbed)) return [challengeEmbed, numRows > maxNumRowsDisplayed];

            if (direction > 0) rightIndex--;
            if (direction < 0) leftIndex++;
        }
    }

    async function displayPages(direction = 1) {
        let [embed, multipage] = await createPage(direction);

        await interaction.editReply({
            embeds: [embed],
            components: multipage ? [multipageButtons] : [],
        });

        if (!multipage) return;

        const filter = (selection) => {
            // Ensure user clicking button is same as the user that started the interaction
            if (selection.user.id !== interaction.user.id) {
                return false;
            }
            // Ensure that the button press corresponds with this interaction and wasn't
            // a button press on the previous interaction
            if (selection.message.interaction.id !== interaction.id) {
                return false;
            }
            return true;
        };

        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            componentType: 'BUTTON',
            time: 20000
        });

        collector.on('collect', async (buttonInteraction) => {
            collector.stop();
            buttonInteraction.deferUpdate();

            switch (parseInt(buttonInteraction.customId)) {
                case -1:
                    rightIndex = (leftIndex - 1 + numRows) % numRows;
                    leftIndex = rightIndex - (MAX_NUM_ROWS - 1);
                    if (leftIndex < 0) leftIndex = 0;
                    await displayPages(-1);
                    break;
                case 1:
                    leftIndex = (rightIndex + 1) % numRows;
                    rightIndex = leftIndex + (MAX_NUM_ROWS - 1);
                    if (rightIndex >= numRows) rightIndex = numRows - 1;
                    await displayPages(1);
                    break;
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size == 0) {
                await interaction.editReply({
                    embeds: [embed],
                    components: []
                });
            }
        });
    }

    // Gets the reaction to the pagination message by the command author
    // and respond by turning the page in the correction direction

    await displayPages(1);
}


function embedTitle(parsed, combos) {
    t = combos.length > 1 ? 'All FTTC Combos ' : 'Only FTTC Combo ';
    if (parsed.person) t += `by ${combos[0].PERSON} `;
    if (parsed.natural_number) t += `with ${parsed.natural_number} towers `;
    if (parsed.map) t += `on ${combos[0].MAP} `;
    if (parsed.towers) t += `including ${Towers.towerUpgradeToIndexNormalForm(parsed.towers[0])} `;
    if (parsed.towers && parsed.towers[1]) t += `and ${Towers.towerUpgradeToIndexNormalForm(parsed.towers[1])} `;
    return t.slice(0, t.length - 1);
}

function titleNoCombos(parsed) {
    t = 'No FTTC Combos Found ';
    if (parsed.person) t += `by "${parsed.person}" `;
    if (parsed.natural_number) t += `with ${parsed.natural_number} towers `;
    if (parsed.map) t += `on ${Aliases.toIndexNormalForm(parsed.map)} `;
    if (parsed.towers) t += `including ${Towers.towerUpgradeToIndexNormalForm(parsed.towers[0])} `;
    if (parsed.towers && parsed.towers[1]) t += `and ${Towers.towerUpgradeToIndexNormalForm(parsed.towers[1])} `;
    return t.slice(0, t.length - 1);
}

module.exports = {
    data: builder,
    execute
};