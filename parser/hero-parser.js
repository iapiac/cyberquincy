LimitedStringSetValuesParser = require('./limited-string-set-values-parser.js');

module.exports = class HeroParser {
    type() {
        return 'hero';
    }

    constructor(...permitted_heroes) {
        this.delegateParser = new LimitedStringSetValuesParser(
            this.type(),
            Aliases.allHeroes(),
            permitted_heroes.map(d => d.toLowerCase()),
        );
    }

    parse(arg) {
        // Delegate the parsing work to the StringSetValuesParser
        return this.delegateParser.parse(arg);
    }
};