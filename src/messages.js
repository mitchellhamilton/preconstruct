// @flow

export let errors = {
  noEntryPoint:
    "no entrypoint was provided, please create a file at src/index.js",
  deniedWriteMainField:
    "changing the main field is required for preconstruct to build",
  invalidModuleField: "module field is invalid",
  invalidMainField: "main field is invalid",
  invalidUmdMainField: "umd:main field is invalid",
  invalidBrowserField: "browser field is invalid",
  invalidReactNativeField: "react-native field is invalid",
  umdNameNotSpecified:
    "the umd:main field is specified but a umdName option is not specified. please add it to the preconstruct field in your package.json",
  deniedWriteBrowserField:
    "building browser bundles for modules that include typeof window or typeof document is currently required"
};

import { createPromptConfirmLoader } from "./prompt";

export let confirms = {
  writeMainField: createPromptConfirmLoader(
    "preconstruct is going to change the main field in your package.json, are you okay with that?"
  ),
  writeModuleField: createPromptConfirmLoader(
    "would you like to generate module builds? this will write to the module field in your package.json"
  ),
  fixModuleField: createPromptConfirmLoader(
    "would you like to fix the module field?"
  ),
  writeUmdBuilds: createPromptConfirmLoader(
    "would you like to generate UMD builds?"
  ),
  shouldInstallObjectAssign: createPromptConfirmLoader(
    "Object.assign is polyfilled with object-assign to reduce bundle size when used with react. would you like to install object-assign automatically?"
  ),
  addBrowserField: createPromptConfirmLoader(
    "typeof window or typeof document is used in this package. would you like build seperate browser builds for better browser bundle sizes?"
  )
};

export let inputs = {
  getUmdName: "what should the name used for UMD bundles be?"
};

export let infos = {
  validMainField: "main field is valid",
  validModuleField: "module field is valid",
  validUmdMainField: "umd:main field is valid",
  validEntrypoint: "a valid entry point exists.",
  validBrowserField: "browser field is valid",
  validReactNativeField: "react-native field is valid"
};

export let successes = {
  validPackage: "package is valid!",
  startedWatching: "started watching!"
};
