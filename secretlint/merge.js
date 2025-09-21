#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Merge secretlint configuration files
 * Usage: node merge.js [external-config-path]
 * If no external config provided, uses default config only
 * Output: .secretlintrc.json
 */

function mergeSecretlintConfig(defaultConfig, externalConfig) {
    // Start with default config as base
    const merged = JSON.parse(JSON.stringify(defaultConfig));

    // If external config has rules, merge them
    if (externalConfig.rules && Array.isArray(externalConfig.rules)) {
        // Create a map of existing rules by id for easy lookup
        const existingRules = new Map();
        merged.rules.forEach((rule, index) => {
            existingRules.set(rule.id, index);
        });

        // Process external rules
        externalConfig.rules.forEach(externalRule => {
            const existingIndex = existingRules.get(externalRule.id);

            if (existingIndex !== undefined) {
                // Rule exists, merge options if present
                const existingRule = merged.rules[existingIndex];
                if (externalRule.options) {
                    if (existingRule.options) {
                        // Special handling for patterns array - merge duplicates intelligently
                        if (existingRule.options.patterns && externalRule.options.patterns) {
                            const mergedPatterns = [...existingRule.options.patterns];

                            externalRule.options.patterns.forEach(newPattern => {
                                const existingPatternIndex = mergedPatterns.findIndex(existing =>
                                    existing.name === newPattern.name
                                );

                                if (existingPatternIndex !== -1) {
                                    // Merge patterns with same name
                                    const existing = mergedPatterns[existingPatternIndex];

                                    // If patterns are different, combine them with OR operator
                                    if (existing.pattern !== newPattern.pattern) {
                                        // Remove leading/trailing slashes and flags for processing
                                        const existingPattern = existing.pattern.replace(/^\/|\/[gimuy]*$/g, '');
                                        const newPatternClean = newPattern.pattern.replace(/^\/|\/[gimuy]*$/g, '');

                                        // Extract flags (assume 'gi' as default)
                                        const existingFlags = existing.pattern.match(/\/([gimuy]*)$/)?.[1] || 'gi';
                                        const newFlags = newPattern.pattern.match(/\/([gimuy]*)$/)?.[1] || 'gi';

                                        // Merge flags
                                        const combinedFlags = [...new Set([...existingFlags, ...newFlags])].join('');

                                        // Combine patterns with OR
                                        const combinedPattern = `/(${existingPattern})|(${newPatternClean})/${combinedFlags}`;

                                        mergedPatterns[existingPatternIndex] = {
                                            ...existing,
                                            ...newPattern, // Take other properties from new pattern
                                            pattern: combinedPattern,
                                            name: `${existing.name} (Combined)`
                                        };
                                    }
                                    // If patterns are the same, just update other properties
                                    else {
                                        mergedPatterns[existingPatternIndex] = {
                                            ...existing,
                                            ...newPattern
                                        };
                                    }
                                } else {
                                    // No duplicate name, add as new pattern
                                    mergedPatterns.push(newPattern);
                                }
                            });

                            // Deep merge other options except patterns
                            const { patterns: _, ...otherExternalOptions } = externalRule.options;
                            const { patterns: __, ...otherExistingOptions } = existingRule.options;
                            
                            merged.rules[existingIndex].options = {
                                ...otherExistingOptions,
                                ...otherExternalOptions,
                                patterns: mergedPatterns
                            };
                        } else if (externalRule.options.patterns) {
                            // Only external has patterns, use external patterns + merge other options
                            merged.rules[existingIndex].options = {
                                ...existingRule.options,
                                ...externalRule.options
                            };
                        } else if (existingRule.options.patterns) {
                            // Only existing has patterns, keep existing patterns + merge other options
                            const { patterns, ...otherExternalOptions } = externalRule.options;
                            merged.rules[existingIndex].options = {
                                ...existingRule.options,
                                ...otherExternalOptions
                            };
                        } else {
                            // Neither has patterns, simple merge
                            merged.rules[existingIndex].options = {
                                ...existingRule.options,
                                ...externalRule.options
                            };
                        }
                    } else {
                        merged.rules[existingIndex].options = externalRule.options;
                    }
                }
            } else {
                // New rule, add it
                merged.rules.push(externalRule);
            }
        });
    }

    // Merge other top-level properties
    Object.keys(externalConfig).forEach(key => {
        if (key !== 'rules') {
            merged[key] = externalConfig[key];
        }
    });

    return merged;
}

function main() {
    // Get command line arguments
    const args = process.argv.slice(2);

    const defaultConfigPath = '.default.secretlintrc.json';
    const outputPath = '.secretlintrc.json';

    // If no external config provided, just copy default config
    if (args.length === 0) {
        console.log('ℹ️  No external config provided, using default config only');

        try {
            if (!fs.existsSync(defaultConfigPath)) {
                console.error(`Default config file not found: ${defaultConfigPath}`);
                process.exit(1);
            }

            console.log(`Reading default config from: ${defaultConfigPath}`);
            const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));

            console.log(`Writing default config to: ${outputPath}`);
            fs.writeFileSync(outputPath, JSON.stringify(defaultConfig, null, 4));

            console.log('✅ Default config copied successfully!');
            console.log(`📄 Output file: ${path.resolve(outputPath)}`);

            console.log('\n📊 Summary:');
            console.log(`- Rules: ${defaultConfig.rules?.length || 0}`);

            return;
        } catch (error) {
            console.error('❌ Error processing default config:', error.message);
            process.exit(1);
        }
    }

    const externalConfigPath = args[0];

    try {
        // Check if default config exists
        if (!fs.existsSync(defaultConfigPath)) {
            console.error(`Default config file not found: ${defaultConfigPath}`);
            process.exit(1);
        }

        // Check if external config exists
        if (!fs.existsSync(externalConfigPath)) {
            console.log(`⚠️  External config file not found: ${externalConfigPath}`);
            console.log('ℹ️  Using default config only');

            const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
            fs.writeFileSync(outputPath, JSON.stringify(defaultConfig, null, 4));

            console.log('✅ Default config copied successfully!');
            console.log(`📄 Output file: ${path.resolve(outputPath)}`);
            return;
        }

        // Read and parse config files
        console.log(`Reading default config from: ${defaultConfigPath}`);
        const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));

        console.log(`Reading external config from: ${externalConfigPath}`);
        const externalConfigContent = fs.readFileSync(externalConfigPath, 'utf8').trim();

        // Check if external config is empty
        if (!externalConfigContent) {
            console.log('ℹ️  External config file is empty, using default config only');

            fs.writeFileSync(outputPath, JSON.stringify(defaultConfig, null, 4));
            console.log('✅ Default config copied successfully!');
            console.log(`📄 Output file: ${path.resolve(outputPath)}`);
            return;
        }

        const externalConfig = JSON.parse(externalConfigContent);

        // Check if external config has no rules or empty rules
        if (!externalConfig.rules || !Array.isArray(externalConfig.rules) || externalConfig.rules.length === 0) {
            console.log('ℹ️  External config has no rules, using default config with other properties merged');

            const mergedConfig = { ...defaultConfig, ...externalConfig };
            if (!externalConfig.rules) {
                mergedConfig.rules = defaultConfig.rules;
            }

            fs.writeFileSync(outputPath, JSON.stringify(mergedConfig, null, 4));
            console.log('✅ Config merged successfully!');
            console.log(`📄 Output file: ${path.resolve(outputPath)}`);
            return;
        }

        // Merge configurations
        console.log('Merging configurations...');
        const mergedConfig = mergeSecretlintConfig(defaultConfig, externalConfig);

        // Write output
        console.log(`Writing merged config to: ${outputPath}`);
        fs.writeFileSync(outputPath, JSON.stringify(mergedConfig, null, 4));

        console.log('✅ Merge completed successfully!');
        console.log(`📄 Output file: ${path.resolve(outputPath)}`);

        // Show summary
        console.log('\n📊 Merge Summary:');
        console.log(`- Default rules: ${defaultConfig.rules?.length || 0}`);
        console.log(`- External rules: ${externalConfig.rules?.length || 0}`);
        console.log(`- Merged rules: ${mergedConfig.rules?.length || 0}`);

    } catch (error) {
        console.error('❌ Error during merge:', error.message);

        if (error.code === 'ENOENT') {
            console.error('File not found. Please check the file path.');
        } else if (error instanceof SyntaxError) {
            console.error('Invalid JSON format in config file.');
        }

        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { mergeSecretlintConfig };