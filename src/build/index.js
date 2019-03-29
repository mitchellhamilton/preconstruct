// @flow
import { Package } from "../package";
import { Project } from "../project";
import { StrictEntrypoint } from "../entrypoint";
import path from "path";
import { rollup } from "./rollup";
import { type Aliases, getAliases } from "./aliases";
import * as logger from "../logger";
import * as fs from "fs-extra";
import { confirms, errors } from "../messages";
import { FatalError } from "../errors";
import { getRollupConfigs } from "./config";
import { writeOtherFiles, getDevPath } from "./utils";
import { createWorker, destroyWorker } from "../worker-client";
import type { OutputChunk } from "./types";

let browserPattern = /typeof\s+(window|document)/;

async function writeOtherFilesForEntrypoints(
  pkg: Package,
  output: Array<OutputChunk>
) {
  let outputByCjsDevPath = {};
  output.forEach(x => {
    outputByCjsDevPath[x.fileName] = x;
  });

  let outputsByEntrypoint: Array<[StrictEntrypoint, OutputChunk]> = [];

  pkg.entrypoints
    .map(x => x.strict())
    .forEach(entrypoint => {
      outputsByEntrypoint.push([
        entrypoint,
        outputByCjsDevPath[getDevPath(entrypoint.main)]
      ]);
    });

  await Promise.all(
    outputsByEntrypoint.map(async ([entrypoint, thing]) => {
      const source = await fs.readFile(pkg.entrypoints[0].source, "utf8");

      let flowMode = false;
      if (source.includes("@flow")) {
        flowMode = thing.exports.includes("default") ? "all" : "named";
      }
      return writeOtherFiles(entrypoint.strict(), flowMode);
    })
  );
}

async function buildPackage(pkg: Package, aliases: Aliases) {
  let configs = getRollupConfigs(pkg, aliases);
  await fs.remove(path.join(pkg.directory, "dist"));

  // TODO: Fix all this stuff to work with multiple entrypoints
  let hasCheckedBrowser = pkg.entrypoints[0].browser !== null;

  let [nodeDevOutput] = await Promise.all(
    configs.map(async ({ config, outputs }) => {
      let bundle = await rollup(config);
      let result = await Promise.all(
        outputs.map(outputConfig => {
          return bundle.write(outputConfig);
        })
      );

      const { output } = result[0];

      if (!hasCheckedBrowser) {
        let allCode = output.map(({ code }) => code).join("\n");
        hasCheckedBrowser = true;
        if (browserPattern.test(allCode)) {
          throw (async () => {
            let shouldAddBrowserField = await confirms.addBrowserField(pkg);
            if (shouldAddBrowserField) {
              pkg.setFieldOnEntrypoints("browser");
              await Promise.all(pkg.entrypoints.map(x => x.save()));
            } else {
              throw new FatalError(errors.deniedWriteBrowserField, pkg);
            }
          })();
        }
      }
      return output;
    })
  );
  await writeOtherFilesForEntrypoints(pkg, nodeDevOutput);
}

async function retryableBuild(pkg: Package, aliases: Aliases) {
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
  // do more stuff with checking whether the repo is using yarn workspaces or bolt
  try {
    createWorker();

    let project = await Project.create(directory);

    logger.info("building bundles!");

    let aliases = getAliases(project);
    await Promise.all(
      project.packages.map(pkg => retryableBuild(pkg, aliases))
    );

    logger.success("built bundles!");
  } finally {
    destroyWorker();
  }
}
