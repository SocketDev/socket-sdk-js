/**
 * @fileoverview Analyze all socket-* repos for rolldown comparison.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from '@socketsecurity/lib/logger';
import { printHeader } from '@socketsecurity/lib/stdio/header';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPath = path.resolve(__dirname, '..');
const projectsDir = path.resolve(rootPath, '..');

const repos = [
  'socket-sdk-js',
  'socket-packageurl-js',
  'socket-cli',
  'socket-registry'
];

/**
 * Analyze a repo's build configuration.
 */
function analyzeRepo(repoName) {
  const repoPath = path.join(projectsDir, repoName);

  if (!existsSync(repoPath)) {
    return {
      exists: false,
      name: repoName
    };
  }

  const pkgPath = path.join(repoPath, 'package.json');
  if (!existsSync(pkgPath)) {
    return {
      exists: true,
      hasPackageJson: false,
      name: repoName,
      path: repoPath
    };
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  // Check for build tools
  const hasEsbuild = Boolean(pkg.devDependencies?.esbuild || pkg.dependencies?.esbuild);
  const hasRollup = Boolean(pkg.devDependencies?.rollup || pkg.dependencies?.rollup);
  const hasVite = Boolean(pkg.devDependencies?.vite || pkg.dependencies?.vite);

  // Check for build script
  const buildScript = pkg.scripts?.build || '';

  // Check for esbuild config
  const hasEsbuildConfig = existsSync(path.join(repoPath, '.config', 'esbuild.config.mjs')) ||
                           existsSync(path.join(repoPath, 'esbuild.config.mjs'));

  // Check for rollup config
  const hasRollupConfig = existsSync(path.join(repoPath, '.config', 'rollup.config.mjs')) ||
                          existsSync(path.join(repoPath, 'rollup.config.mjs')) ||
                          existsSync(path.join(repoPath, '.config', 'rollup.cli-js.config.mjs'));

  // Estimate bundle entries
  let entryPoints = [];
  if (pkg.bin) {
    entryPoints = Object.keys(pkg.bin);
  } else if (pkg.main) {
    entryPoints = ['main'];
  } else if (pkg.exports) {
    entryPoints = Object.keys(pkg.exports).filter(k => k !== './package.json');
  }

  return {
    exists: true,
    hasPackageJson: true,
    name: repoName,
    path: repoPath,
    packageName: pkg.name,
    version: pkg.version,
    hasEsbuild,
    hasRollup,
    hasVite,
    buildScript,
    hasEsbuildConfig,
    hasRollupConfig,
    entryPoints,
    entryCount: entryPoints.length,
    isPrivate: pkg.private,
    isMonorepo: pkg.workspaces !== undefined
  };
}

/**
 * Print analysis results.
 */
function printAnalysis(analysis) {
  printHeader('Socket Repos Build Analysis');

  logger.step('Repository Overview');
  logger.log('');

  for (const repo of analysis) {
    if (!repo.exists) {
      logger.warn(`❌ ${repo.name} - Not found`);
      continue;
    }

    logger.substep(`${repo.name} (${repo.packageName})`);
    logger.log(`  Version: ${repo.version}`);
    logger.log(`  Private: ${repo.isPrivate ? 'Yes' : 'No'}`);
    logger.log(`  Monorepo: ${repo.isMonorepo ? 'Yes' : 'No'}`);
    logger.log(`  Entry points: ${repo.entryCount}`);
    logger.log(`  Build tools:`);

    if (repo.hasEsbuild) {logger.log(`    ✅ esbuild${repo.hasEsbuildConfig ? ' (with config)' : ''}`);}
    if (repo.hasRollup) {logger.log(`    ✅ rollup${repo.hasRollupConfig ? ' (with config)' : ''}`);}
    if (repo.hasVite) {logger.log(`    ✅ vite`);}
    if (!repo.hasEsbuild && !repo.hasRollup && !repo.hasVite) {logger.log(`    ❌ No bundler found`);}

    logger.log(`  Build script: ${repo.buildScript || '(none)'}`);
    logger.log('');
  }

  logger.step('Rolldown Compatibility Analysis');
  logger.log('');

  const compatible = analysis.filter(r => r.exists && r.hasPackageJson && r.hasEsbuild);
  const needsSetup = analysis.filter(r => r.exists && r.hasPackageJson && !r.hasEsbuild);

  logger.substep(`Compatible repos (using esbuild): ${compatible.length}`);
  for (const repo of compatible) {
    logger.log(`  ✅ ${repo.name} - ${repo.hasEsbuildConfig ? 'Has config' : 'Needs config'}`);
  }
  logger.log('');

  if (needsSetup.length > 0) {
    logger.substep(`Repos needing setup: ${needsSetup.length}`);
    for (const repo of needsSetup) {
      const current = repo.hasRollup ? 'rollup' : repo.hasVite ? 'vite' : 'unknown';
      logger.log(`  ⚠️  ${repo.name} - Currently using ${current}`);
    }
    logger.log('');
  }

  logger.step('Recommendation');
  logger.log('');
  logger.info('Based on socket-sdk-js analysis:');
  logger.info('• esbuild is 84% faster for incremental builds');
  logger.info('• esbuild produces 43% smaller bundles');
  logger.info('• Recommended: Keep esbuild, skip rolldown migration');
  logger.log('');

  logger.substep(`Repos to analyze: ${compatible.length}`);
  for (const repo of compatible) {
    logger.log(`  • ${repo.name} - ${repo.entryCount} entry point(s)`);
  }
  logger.log('');

  logger.substep('Priority for testing:');
  // Prioritize by complexity (entry points)
  const sorted = [...compatible].sort((a, b) => b.entryCount - a.entryCount);
  for (let i = 0; i < sorted.length; i++) {
    const repo = sorted[i];
    logger.log(`  ${i + 1}. ${repo.name} (${repo.entryCount} entries) ${repo.isMonorepo ? '[MONOREPO]' : ''}`);
  }
}

async function main() {
  try {
    const analysis = repos.map(analyzeRepo);
    printAnalysis(analysis);

    // Save to JSON
    const outputPath = path.join(__dirname, '..', 'repos-analysis.json');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(outputPath, JSON.stringify(analysis, null, 2));
    logger.success(`Analysis saved to repos-analysis.json`);

    process.exitCode = 0;
  } catch (error) {
    logger.error(`Analysis failed: ${error.message}`);
    console.error(error);
    process.exitCode = 1;
  }
}

main().catch(console.error);
