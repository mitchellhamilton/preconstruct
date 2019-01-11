// @flow
import { Package, StrictPackage } from "../package";
import * as logger from "../logger";
import path from "path";
import { rollup } from "./rollup";
import { type Aliases, getAliases } from "./aliases";
import * as fs from "fs-extra";
import { confirms, errors } from "../messages";
import { FatalError } from "../errors";
import { getValidBrowserField } from "../utils";
import { getRollupConfigs } from "./config";
import { writeOtherFiles } from "./utils";
import { createWorker, destroyWorker } from "../worker-client";
import ora from "ora";

let browserPattern = /typeof\s+(window|document)/;

async function buildPackage(pkg: StrictPackage, aliases: Aliases) {
  let configs = getRollupConfigs(pkg, aliases);
  await fs.remove(path.join(pkg.directory, "dist"));

  let hasCheckedBrowser = pkg.browser !== null;

  const [sampleOutput] = await Promise.all(
    configs.map(async ({ config, outputs }) => {
      // $FlowFixMe this is not a problem with flow, i did something wrong but it's not worth fixing right now
      const bundle = await rollup(config);

      let result = await Promise.all(
        outputs.map(outputConfig => {
          return bundle.write(outputConfig);
        })
      );

      const nodeDevOutput = result[0].output[0];

      if (!hasCheckedBrowser) {
        hasCheckedBrowser = true;
        if (browserPattern.test(nodeDevOutput.code)) {
          throw (async () => {
            let shouldAddBrowserField = await confirms.addBrowserField(pkg);
            if (shouldAddBrowserField) {
              pkg.browser = getValidBrowserField(pkg);
              await pkg.save();
            } else {
              throw new FatalError(errors.deniedWriteBrowserField, pkg);
            }
          })();
        }
      }

      return nodeDevOutput;
    })
  );

  const source = await fs.readFile(pkg.source, "utf8");

  let flowMode = false;
  if (source.includes("@flow")) {
    flowMode = sampleOutput.exports.includes("default") ? "all" : "named";
  }

  await writeOtherFiles(pkg, flowMode);
}

async function retryableBuild(pkg: StrictPackage, aliases: Aliases) {
  try {
    await buildPackage(pkg, aliases);
  } catch (err) {
    if (err instanceof Promise) {
      await err;
      await retryableBuild(pkg, aliases);
      return;
    }
    throw err;
  }
}

export default async function build(directory: string) {
  createWorker();
  let pkg = await Package.create(directory);
  // do more stuff with checking whether the repo is using yarn workspaces or bolt
  try {
    let packages = await pkg.packages();
    if (packages === null) {
      const spinner = ora("building bundles").start();
      let strictPackage = pkg.strict();
      await retryableBuild(strictPackage, {});
      spinner.succeed("built bundles!");
    } else {
      let strictPackages = packages.map(x => x.strict());
      let aliases = getAliases(strictPackages);
      let completedPackages = 0;
      let text = () =>
        `[${completedPackages}/${strictPackages.length}] building bundles`;
      const spinner = ora(text()).start();
      await Promise.all(
        strictPackages.map(pkg =>
          retryableBuild(pkg, aliases).then(() => {
            completedPackages++;
            spinner.text = text();
          })
        )
      );
      spinner.succeed("built bundles!");
    }
  } finally {
    destroyWorker();
  }
}
