const { existsSync, readFileSync } = require("fs");
const { join } = require("path");

const { platform, arch } = process;

let nativeBinding = null;
let loadError = null;

function isMusl() {
  if (!process.report || typeof process.report.getReport !== "function") {
    try {
      const lddPath = require("child_process")
        .execSync("which ldd")
        .toString()
        .trim();
      return readFileSync(lddPath, "utf8").includes("musl");
    } catch {
      return true;
    }
  } else {
    const { glibcVersionRuntime } = process.report.getReport().header;
    return !glibcVersionRuntime;
  }
}

switch (platform) {
  case "android":
    switch (arch) {
      case "arm64":
        try {
          nativeBinding = require("./image-core-native.android-arm64.node");
        } catch (e) {
          loadError = e;
        }
        break;
      case "arm":
        try {
          nativeBinding = require("./image-core-native.android-arm-eabi.node");
        } catch (e) {
          loadError = e;
        }
        break;
      default:
        loadError = new Error(`Unsupported architecture on Android ${arch}`);
    }
    break;
  case "win32":
    switch (arch) {
      case "x64":
        try {
          nativeBinding = require("./image-core-native.win32-x64-msvc.node");
        } catch (e) {
          loadError = e;
        }
        break;
      case "ia32":
        try {
          nativeBinding = require("./image-core-native.win32-ia32-msvc.node");
        } catch (e) {
          loadError = e;
        }
        break;
      case "arm64":
        try {
          nativeBinding = require("./image-core-native.win32-arm64-msvc.node");
        } catch (e) {
          loadError = e;
        }
        break;
      default:
        loadError = new Error(`Unsupported architecture on Windows: ${arch}`);
    }
    break;
  case "darwin":
    switch (arch) {
      case "x64":
        try {
          nativeBinding = require("./image-core-native.darwin-x64.node");
        } catch (e) {
          loadError = e;
        }
        break;
      case "arm64":
        try {
          nativeBinding = require("./image-core-native.darwin-arm64.node");
        } catch (e) {
          loadError = e;
        }
        break;
      default:
        loadError = new Error(`Unsupported architecture on macOS: ${arch}`);
    }
    break;
  case "freebsd":
    if (arch !== "x64") {
      loadError = new Error(`Unsupported architecture on FreeBSD: ${arch}`);
      break;
    }
    try {
      nativeBinding = require("./image-core-native.freebsd-x64.node");
    } catch (e) {
      loadError = e;
    }
    break;
  case "linux":
    switch (arch) {
      case "x64":
        if (isMusl()) {
          try {
            nativeBinding = require("./image-core-native.linux-x64-musl.node");
          } catch (e) {
            loadError = e;
          }
        } else {
          try {
            nativeBinding = require("./image-core-native.linux-x64-gnu.node");
          } catch (e) {
            loadError = e;
          }
        }
        break;
      case "arm64":
        if (isMusl()) {
          try {
            nativeBinding = require("./image-core-native.linux-arm64-musl.node");
          } catch (e) {
            loadError = e;
          }
        } else {
          try {
            nativeBinding = require("./image-core-native.linux-arm64-gnu.node");
          } catch (e) {
            loadError = e;
          }
        }
        break;
      case "arm":
        if (isMusl()) {
          try {
            nativeBinding = require("./image-core-native.linux-arm-musleabihf.node");
          } catch (e) {
            loadError = e;
          }
        } else {
          try {
            nativeBinding = require("./image-core-native.linux-arm-gnueabihf.node");
          } catch (e) {
            loadError = e;
          }
        }
        break;
      case "riscv64":
        if (isMusl()) {
          try {
            nativeBinding = require("./image-core-native.linux-riscv64-musl.node");
          } catch (e) {
            loadError = e;
          }
        } else {
          try {
            nativeBinding = require("./image-core-native.linux-riscv64-gnu.node");
          } catch (e) {
            loadError = e;
          }
        }
        break;
      case "s390x":
        try {
          nativeBinding = require("./image-core-native.linux-s390x-gnu.node");
        } catch (e) {
          loadError = e;
        }
        break;
      default:
        loadError = new Error(`Unsupported architecture on Linux: ${arch}`);
    }
    break;
  default:
    loadError = new Error(`Unsupported OS: ${platform}, architecture: ${arch}`);
}

if (!nativeBinding) {
  if (loadError) {
    throw loadError;
  }
  throw new Error(`Failed to load native binding`);
}

const {
  parseImageFromPath,
  parseImageFromBytes,
  computeSha256,
  computeThumbhash,
} = nativeBinding;

module.exports.parseImageFromPath = parseImageFromPath;
module.exports.parseImageFromBytes = parseImageFromBytes;
module.exports.computeSha256 = computeSha256;
module.exports.computeThumbhash = computeThumbhash;
