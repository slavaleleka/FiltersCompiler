/* eslint-disable global-require */
module.exports = (() => {
    const fs = require('fs');
    const path = require('path');
    const logger = require('./utils/log.js');

    const FULL_REQUIRED_ENDINGS = ['name', 'description'];
    const ONLY_NAME_REQUIRED_ENDINGS = ['name'];
    const LOCALES_FILE_EXTENSION = '.json';

    const LOCALES_DATA = {
        filters: {
            required: FULL_REQUIRED_ENDINGS,
        },
        groups: {
            required: ONLY_NAME_REQUIRED_ENDINGS,
        },
        tags: {
            required: FULL_REQUIRED_ENDINGS,
        },
    };

    const WARNING_TYPES = {
        MISSED_FILES: 'missed files',
        NO_MESSAGES: 'empty file or no messages in file',
        INVALID_DATA_OBJ: 'invalid message key or no value',
    };

    /**
     * Sync reads file content
     * @param filePath - path to locales file
     */
    const readFile = function (filePath) {
        try {
            return fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');
        } catch (e) {
            return null;
        }
    };

    /**
     * Sync reads directory content
     * @param dirPath - path to directory
     */
    const readDir = (dirPath) => fs.readdirSync(path.resolve(__dirname, dirPath), 'utf8');

    /**
     * Validates messages keys
     * @param {Array} keys locale messages keys
     * @param {string} id filters / groups / tags
     */
    const areValidMessagesKeys = (keys, id) => {
        if (keys.length !== LOCALES_DATA[id].required.length) {
            return false;
        }
        const areValidKeys = keys.reduce((acc, key) => {
            const keyNameParts = key.split('.');
            const propPrefix = id.slice(0, -1);
            const filterId = Number(keyNameParts[1]);
            return keyNameParts.length === 3
                && keyNameParts[0] === propPrefix
                && Number.isInteger(filterId)
                && filterId > 0
                && LOCALES_DATA[id].required.includes(keyNameParts[2])
                && acc;
        }, true);

        return areValidKeys;
    };

    const areValidMessagesValues = (values) => values.every((v) => v !== '');

    const objToDetails = (obj) => {
        const details = Object.keys(obj)
            .reduce((acc, key) => {
                acc.push(`"${key}": "${obj[key]}"`);
                return acc;
            }, []);
        return details;
    };

    const prepareWarnings = (warnings) => {
        const output = warnings
            .reduce((acc, data) => {
                const [type, details] = data;
                acc.push({ type, details });
                return acc;
            }, []);
        return output;
    };

    const logResults = (results) => {
        results.forEach((res) => {
            logger.error(`- ${res.locale}:`);
            res.warnings.forEach((warning) => {
                logger.error(`  - ${warning.type}:`);
                warning.details.forEach((detail) => {
                    logger.error(`      ${detail}`);
                });
            });
        });
    };

    /**
     * Validates locales messages
     * @param {string} dirPath relative path to locales directory
     */
    const validate = (dirPath) => {
        logger.info('Validating locales...');
        const results = [];
        let locales;
        try {
            locales = readDir(dirPath);
        } catch (e) {
            throw new Error(`There is no locales dir '${dirPath}'`);
        }

        if (locales.length === 0) {
            throw new Error(`Locales dir '${dirPath}' is empty`);
        }

        const requiredFiles = Object.keys(LOCALES_DATA)
            .map((el) => `${el}${LOCALES_FILE_EXTENSION}`);

        locales.forEach((locale) => {
            const localeWarnings = [];
            const filesList = readDir(path.join(dirPath, locale));
            // checks all needed files presence
            const missedFiles = requiredFiles
                .filter((el) => !filesList.includes(el));
            if (missedFiles.length !== 0) {
                localeWarnings.push([WARNING_TYPES.MISSED_FILES, missedFiles]);
            }

            const presentFiles = requiredFiles
                .filter((el) => !missedFiles.includes(el));

            presentFiles.forEach((fileName) => {
                const messagesPath = path.join(dirPath, locale, fileName);
                let messagesData;
                try {
                    messagesData = JSON.parse(readFile(messagesPath));
                } catch (e) {
                    localeWarnings.push([WARNING_TYPES.NO_MESSAGES, [fileName]]);
                    return;
                }

                if (messagesData.length === 0) {
                    localeWarnings.push([WARNING_TYPES.NO_MESSAGES, [fileName]]);
                }

                messagesData.forEach((obj) => {
                    const messagesKeys = Object.keys(obj);
                    const messagesValues = Object.values(obj);
                    const extensionLength = LOCALES_FILE_EXTENSION.length;
                    const id = fileName.slice(0, -extensionLength);
                    if (!areValidMessagesKeys(messagesKeys, id)
                        || !areValidMessagesValues(messagesValues)) {
                        localeWarnings.push([WARNING_TYPES.INVALID_DATA_OBJ, objToDetails(obj)]);
                    }
                });
            });

            if (localeWarnings.length !== 0) {
                const warnings = prepareWarnings(localeWarnings);
                const localeResult = {
                    locale,
                    warnings,
                };
                results.push(localeResult);
            }
        });

        if (results.length === 0) {
            logger.info('Validation result: OK');
        } else {
            logger.error('There are issues with:');
            logResults(results);
        }

        return results;
    };

    return {
        validate,
    };
})();
