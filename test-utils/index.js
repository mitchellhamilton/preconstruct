// @flow
import path from "path";
import * as fs from "fs-extra";
import globby from "globby";
import fixturez from "fixturez";

let f = fixturez(__dirname);

require("chalk").enabled = false;
// $FlowFixMe
console.error = jest.fn();
// $FlowFixMe
console.log = jest.fn();

export let logMock = {
  log: ((console.log: any): JestMockFn<any, void>),
  error: ((console.error: any): JestMockFn<any, void>)
};

afterEach(() => {
  logMock.log.mockReset();
  logMock.error.mockReset();
});

import init from "../src/init";
import { confirms } from "../src/messages";

export async function initBasic(directory: string) {
  confirms.writeMainField.mockReturnValue(true);
  confirms.writeModuleField.mockReturnValue(true);
  confirms.writeUmdBuilds.mockReturnValue(false);

  await init(directory);
  confirms.writeMainField.mockReset();
  confirms.writeModuleField.mockReset();
  confirms.writeUmdBuilds.mockReset();
}

function getPkgPath(tmpPath: string) {
  return path.join(tmpPath, "package.json");
}

export async function getPkg(filepath: string): Object {
  return JSON.parse(
    await fs.readFile(path.join(filepath, "package.json"), "utf-8")
  );
}

export async function modifyPkg(tmpPath: string, cb: Object => mixed) {
  let json = await getPkg(tmpPath);
  await cb(json);

  let pkgPath = getPkgPath(tmpPath);
  await fs.writeFile(pkgPath, JSON.stringify(json, null, 2));
}

export let createPackageCheckTestCreator = (
  doResult: string => Promise<void>
) => {
  let createTestCreator = testFn => async (
    testName: string,
    entrypoints: { [key: string]: Object },
    cb: (doThing: () => Promise<{ [key: string]: Object }>) => Promise<void>
  ) => {
    testFn(testName, async () => {
      let tmpPath = f.copy("template-simple-package");
      let things = Object.keys(entrypoints);
      await Promise.all(
        things.map(async entrypointPath => {
          let content = entrypoints[entrypointPath];
          let filepath = path.join(tmpPath, entrypointPath, "package.json");
          await fs.ensureFile(filepath);
          await fs.writeFile(filepath, JSON.stringify(content, null, 2));
        })
      );

      await cb(async () => {
        await doResult(tmpPath);

        let newThings = {};

        await Promise.all(
          things.map(async entrypointPath => {
            newThings[entrypointPath] = JSON.parse(
              await fs.readFile(
                path.join(tmpPath, entrypointPath, "package.json"),
                "utf8"
              )
            );
          })
        );
        return newThings;
      });
    });
  };
  let testFn = createTestCreator(test);
  testFn.only = createTestCreator(test.only);
  testFn.skip = createTestCreator(test.skip);
  return testFn;
};

export async function snapshotDistFiles(tmpPath: string) {
  let distPath = path.join(tmpPath, "dist");
  let distFiles;
  try {
    distFiles = await fs.readdir(distPath);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(distPath + " does not exist");
    }
    throw err;
  }

  await Promise.all(
    distFiles.map(async x => {
      expect(
        await fs.readFile(path.join(distPath, x), "utf-8")
      ).toMatchSnapshot(x);
    })
  );
}

export async function snapshotDirectory(
  tmpPath: string,
  files: "all" | "js" = "js"
) {
  let paths = await globby([`**/${files === "js" ? "*.js" : "*"}`], {
    cwd: tmpPath
  });

  await Promise.all(
    paths.map(async x => {
      expect(await fs.readFile(path.join(tmpPath, x), "utf-8")).toMatchSnapshot(
        x
      );
    })
  );
}
