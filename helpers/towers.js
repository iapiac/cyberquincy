const gHelper = require('../helpers/general.js');

function towerUpgradeToTower(towerUpgrade) {
    if (!towerUpgrade) return null;
    canonical = Aliases.getCanonicalForm(towerUpgrade);
    if (!canonical) return null;
    return canonical.slice(0, -4);
}

function allTowerUpgrades() {
    return []
        .concat(allPrimaryTowerUpgrades())
        .concat(allMilitaryTowerUpgrades())
        .concat(allMagicTowerUpgrades())
        .concat(allSupportTowerUpgrades());
}

// Gets all 0-0-0 tower names
function allTowers() {
    return []
        .concat(allPrimaryTowers())
        .concat(allMilitaryTowers())
        .concat(allMagicTowers())
        .concat(allSupportTowers());
}

function allTowerPaths() {
    return allTowers()
        .map((t) => {
            return [`${t}#top-path`, `${t}#middle-path`, `${t}#bottom-path`];
        })
        .flat();
}

function isTowerUpgrade(candidate) {
    if (!candidate || !gHelper.is_str(candidate)) return false;
    return allTowerUpgrades().includes(candidate.toLowerCase());
}

function isTower(candidate) {
    if (!candidate || !gHelper.is_str(candidate)) return false;
    return allTowers().includes(candidate.toLowerCase());
}

function isTowerPath(candidate) {
    if (!candidate || !gHelper.is_str(candidate)) return false;
    return allTowerPaths().includes(candidate.toLowerCase());
}

function allPrimaryTowers() {
    return allGroupTowers('PRIMARY');
}

function allMilitaryTowers() {
    return allGroupTowers('MILITARY');
}

function allMagicTowers() {
    return allGroupTowers('MAGIC');
}

function allSupportTowers() {
    return allGroupTowers('SUPPORT');
}

function allPrimaryTowerUpgrades() {
    return allGroupTowerUpgrades('PRIMARY');
}

function allMilitaryTowerUpgrades() {
    return allGroupTowerUpgrades('MILITARY');
}

function allMagicTowerUpgrades() {
    return allGroupTowerUpgrades('MAGIC');
}

function allSupportTowerUpgrades() {
    return allGroupTowerUpgrades('SUPPORT');
}

function allGroupTowers(group) {
    return allGroupTowerCanonicals(group).filter((u) => !u.includes('#'));
}

function allGroupTowerUpgrades(group) {
    return allGroupTowerCanonicals(group).filter((u) => u.includes('#'));
}

GROUP_TO_TOWER = {
    PRIMARY: 'DART',
    MILITARY: 'HELI',
    MAGIC: 'WIZ',
    SUPPORT: 'FARM',
};

function allGroupTowerCanonicals(group) {
    return Aliases.getAliasGroupsFromSameImmediateDirectoryAs(
        GROUP_TO_TOWER[group]
    ).map((ag) => ag.canonical);
}

function allWaterTowers() {
    return ['sub', 'bucc', 'brick'].map((t) => Aliases.getCanonicalForm(t));
}

function isWaterTowerUpgrade(towerUpgrade) {
    return allWaterTowers().includes(
        Aliases.isHero(towerUpgrade)
            ? towerUpgrade
            : Towers.towerUpgradeToTower(towerUpgrade)
    );
}

function towerUpgradeToIndexNormalForm(upgrade) {
    const indexNormalUnformatted = Aliases.getAliasSet(upgrade)[1];
    return Aliases.toIndexNormalForm(indexNormalUnformatted);
}

function towerUpgradeFromTowerAndPathAndTier(tower, path, tier) {
    // Re-assign tower to canonical and ensure that it exists and is a tower
    if (
        !(tower = Aliases.getCanonicalForm(tower)) ||
        !allTowers().includes(tower)
    ) {
        throw 'First argument must be a tower';
    }

    // Validate path
    if (isNaN(path)) {
        throw 'Second argument `path` must be 1, 2, or 3';
    }
    try {
        path = parseInt(path);
    } catch (e) {
        throw 'Second argument `path` must be 1, 2, or 3';
    }

    if (path < 1 || path > 3) {
        throw 'Second argument `path` must be 1, 2, or 3';
    }

    // Validate tier
    if (!tier) {
        return towerUpgradeToIndexNormalForm(`${tower}#222`);
    }

    if (isNaN(tier)) {
        throw 'Third argument `tier` must be an integer between 0 and 5 inclusive';
    }
    try {
        tier = parseInt(tier);
    } catch (e) {
        throw 'Third argument `tier` must be an integer between 0 and 5 inclusive';
    }

    if (tier < 0 || tier > 5) {
        throw 'Third argument `tier` must be an integer between 0 and 5 inclusive';
    }

    // Convert path + tier to appropriate upgrade string like 003 or 400
    const upgradeInt = tier * Math.pow(10, 3 - path);
    const upgradeStr = upgradeInt.toString().padStart(3, '0');

    // Combine tower with upgrade string to get tower upgrade canonical like wizard#300
    return towerUpgradeToIndexNormalForm(`${tower}#${upgradeStr}`);
}

function pathTierFromUpgradeSet(upgradeSet) {
    upgrades = upgradeSet.split('');
    let sortedUpgrades = [...upgrades].sort();
    const tier = sortedUpgrades[2];
    const path = upgrades.findIndex((u) => u == tier) + 1;
    return [path, tier];
}

function crossPathTierFromUpgradeSet(upgradeSet) {
    upgrades = upgradeSet.split('');
    let sortedUpgrades = [...upgrades].sort();
    let crossTier = sortedUpgrades[1];
    let crossPath = upgrades.findIndex((u) => u == crossTier) + 1;
    if (sortedUpgrades[1] == sortedUpgrades[2]) {
        upgrades[crossPath - 1] = 0;
        crossPath = upgrades.findIndex((u) => u == crossTier) + 1;
    }

    return [crossPath, crossTier];
}

function isValidUpgradeSet(u) {
    if (!gHelper.is_str(u) || u.length !== 3) return false;

    if (isNaN(u)) return false;

    // Get array of 3 digits, sorted in ascending order
    uSorted = u
        .split('')
        .map((c) => parseInt(c))
        .sort();

    if (uSorted[0] !== 0) return false;

    if (uSorted[1] > 2) return false;

    if (uSorted[2] > 5) return false;

    return true;
}

function formatTower(tower) {
    if (isTower(tower)) {
        return `${towerUpgradeToIndexNormalForm(tower)}`;
    } else if (isTowerPath(tower)) {
        [towerName, path] = tower.split('#');
        return (
            `${gHelper.toTitleCase(path.split('-').join(' '))} ` +
            `${towerUpgradeToIndexNormalForm(towerName)}`
        );
    } else if (isTowerUpgrade(tower)) {
        return `${towerUpgradeToIndexNormalForm(tower)}`;
    } else if (Aliases.isHero(tower)) {
        return `${gHelper.toTitleCase(tower)}`;
    } else {
        throw `Tower ${tower} is not within allotted tower/hero category`;
    }
}
/*
function totalTowerUpgradeCrosspathCost(json, jsonTowerName, upgradeSet) {
    let [path, tier] = Towers.pathTierFromUpgradeSet(upgradeSet);
    let [crossPath, crossTier] = Towers.crossPathTierFromUpgradeSet(upgradeSet);

    const baseCost = parseInt(json[`${jsonTowerName}`].cost);

    let pathCost = 0;
    for (let subTier = 1; subTier <= tier; subTier++) {
        pathCost += parseInt(
            json[`${jsonTowerName}`].upgrades[path - 1][subTier - 1].cost
        );
    }

    let crossPathCost = 0;
    for (let subCrossTier = 1; subCrossTier <= crossTier; subCrossTier++) {
        crossPathCost += parseInt(
            json[`${jsonTowerName}`].upgrades[crossPath - 1][subCrossTier - 1]
                .cost
        );
    }
    return baseCost + pathCost + crossPathCost;
}*/

function totalTowerUpgradeCrosspathCostNew(json, towerName, upgrade) {
    // uses different json format found in ../jsons/costs.json

    let [path, tier] = Towers.pathTierFromUpgradeSet(upgrade);
    let [crossPath, crossTier] = Towers.crossPathTierFromUpgradeSet(upgrade);
    let tower = json[`${towerName}`];

    let totalCost = tower.cost; // base cost of tower

    for (let i = 0; i < tier; i++) {
        // main path of tower
        totalCost += tower.upgrades[`${path}`][i];
    }

    for (let i = 0; i < crossTier; i++) {
        // cross path of tower
        totalCost += tower.upgrades[`${crossPath}`][i];
    }
    return totalCost;
}
function totalTowerUpgradeCrosspathCostNewHard(json, towerName, upgrade) {
    // uses different json format found in ../jsons/costs.json

    let [path, tier] = Towers.pathTierFromUpgradeSet(upgrade);
    let [crossPath, crossTier] = Towers.crossPathTierFromUpgradeSet(upgrade);
    let tower = json[`${towerName}`];

    let totalCost = tower.cost; // base cost of tower

    for (let i = 0; i < tier; i++) {
        // main path of tower
        totalCost += Math.round(tower.upgrades[`${path}`][i] * 1.08);
    }

    for (let i = 0; i < crossTier; i++) {
        // cross path of tower
        totalCost += Math.round(tower.upgrades[`${crossPath}`][i] * 1.08);
    }
}
function upgradeCost(tower, path, tier) {
    let totalCost = 0;
    for (let i = 1; i <= tier; i++) {
        totalCost += tower.upgrades[`${path}`][tier - 1];
        console.log(tower.upgrades[`${path}`][tier - 1]);
    }
    return totalCost;
}
module.exports = {
    towerUpgradeToTower,
    allTowerUpgrades,
    allTowers,
    allTowerPaths,
    isTowerUpgrade,
    isTower,
    isTowerPath,
    allWaterTowers,
    isWaterTowerUpgrade,
    towerUpgradeToIndexNormalForm,
    towerUpgradeFromTowerAndPathAndTier,
    pathTierFromUpgradeSet,
    crossPathTierFromUpgradeSet,
    isValidUpgradeSet,
    formatTower,
    totalTowerUpgradeCrosspathCostNew,
    totalTowerUpgradeCrosspathCostNewHard,
    upgradeCost,
};
