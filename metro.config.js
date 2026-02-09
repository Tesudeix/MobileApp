const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const exclusionList = require("metro-config/src/defaults/exclusionList");

const projectRoot = __dirname;
const backendRoot = path.resolve(projectRoot, "..", "Yuki");
const escapedBackendRoot = backendRoot.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");

const config = getDefaultConfig(projectRoot);
config.resolver.blockList = exclusionList([
  new RegExp(`${escapedBackendRoot}\\/.*`),
]);
config.watchFolders = [projectRoot];

module.exports = config;
