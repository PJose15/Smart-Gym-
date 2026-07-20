// Metro config — monorepo-aware with build-output exclusions.
//
// Metro watches the pnpm workspace root, which includes web-admin's .next
// directory. Next.js churns generated type files there constantly and
// Metro's fallback watcher crashes on its transient paths (UNKNOWN lstat).
// Block build outputs from the watcher entirely.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.blockList = [
  /.*[\\/]\.next[\\/].*/,
  /.*[\\/]apps[\\/]web-admin[\\/]\.next[\\/].*/,
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
