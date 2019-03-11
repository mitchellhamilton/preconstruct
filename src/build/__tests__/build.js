// @flow
import build from "../";
import fixturez from "fixturez";
import path from "path";
import spawn from "spawndamnit";
import { initBasic, getPkg, snapshotDistFiles } from "../../../test-utils";
import { confirms } from "../../messages";
import { FatalError } from "../../errors";
import { promptInput } from "../../prompt";

const f = fixturez(__dirname);

jest.mock("../../prompt");

let unsafePromptInput: any = promptInput;

async function install(tmpPath) {
  await spawn("yarn", ["install"], { cwd: tmpPath });
}

jest.mock("install-packages");

let unsafeRequire = require;

test("basic", async () => {
  let tmpPath = f.copy("valid-package");

  await build(tmpPath);

  await snapshotDistFiles(tmpPath);

  expect(unsafeRequire(tmpPath).default).toBe("something");
});

test("monorepo", async () => {
  let tmpPath = f.copy("monorepo");
  await initBasic(tmpPath);
  await install(tmpPath);
  await build(tmpPath);
  let counter = 1;
  for (let pkg of ["package-one", "package-two"]) {
    let pkgPath = path.join(tmpPath, "packages", pkg);
    await snapshotDistFiles(pkgPath);

    expect(unsafeRequire(pkgPath).default).toBe(counter++);
  }
});

test("no module", async () => {
  let tmpPath = f.copy("no-module");

  await build(tmpPath);

  await snapshotDistFiles(tmpPath);

  expect(unsafeRequire(tmpPath).default).toBe(
    "this does not have a module build"
  );
});

test.skip("uses obj spread", async () => {
  let tmpPath = f.copy("use-obj-spread");
  confirms.shouldInstallObjectAssign.mockReturnValue(Promise.resolve(false));

  try {
    await build(tmpPath);
  } catch (err) {
    expect(err).toBeInstanceOf(FatalError);
    expect(err.message).toBe(
      "object-assign should be in dependencies of use-object-spread"
    );
  }
});

test("clears dist folder", async () => {
  let tmpPath = f.copy("already-has-things-in-dist");

  await build(tmpPath);

  await snapshotDistFiles(tmpPath);
});

test("flow", async () => {
  let tmpPath = f.copy("flow");

  await build(tmpPath);

  await snapshotDistFiles(tmpPath);
});

test("flow", async () => {
  let tmpPath = f.copy("flow-export-default");

  await build(tmpPath);

  await snapshotDistFiles(tmpPath);
});

test("prod checks", async () => {
  let tmpPath = f.copy("prod-checks");

  await build(tmpPath);

  await snapshotDistFiles(tmpPath);
});

// TODO: make it faster so this isn't required
jest.setTimeout(20000);

test("browser", async () => {
  let tmpPath = f.copy("browser");

  confirms.addBrowserField.mockReturnValue(Promise.resolve(true));

  await build(tmpPath);

  await snapshotDistFiles(tmpPath);
});

test("umd with dep on other module", async () => {
  let tmpPath = f.copy("umd-with-dep");

  await install(tmpPath);

  unsafePromptInput.mockImplementation(async question => {
    if (question === `What should the umdName of react be?`) {
      return "React";
    }
    throw new Error("unexpected question: " + question);
  });

  await build(tmpPath);

  await snapshotDistFiles(tmpPath);
  expect(await getPkg(tmpPath)).toMatchInlineSnapshot(`
Object {
  "devDependencies": Object {
    "react": "^16.6.3",
  },
  "license": "MIT",
  "main": "dist/umd-with-dep.cjs.js",
  "name": "umd-with-dep",
  "peerDependencies": Object {
    "react": "^16.6.3",
  },
  "preconstruct": Object {
    "globals": Object {
      "react": "React",
    },
    "umdName": "umdWithDep",
  },
  "private": true,
  "umd:main": "dist/umd-with-dep.umd.min.js",
  "version": "1.0.0",
}
`);
});

test("monorepo umd with dep on other module", async () => {
  let tmpPath = f.copy("monorepo-umd-with-dep");
  let asked = false;
  unsafePromptInput.mockImplementation(async question => {
    if (asked) {
      throw new Error("only one prompt should happen: " + question);
    }
    if (question === `What should the umdName of react be?`) {
      asked = true;
      return "React";
    }
    throw new Error("unexpected question: " + question);
  });
  await install(tmpPath);
  await build(tmpPath);

  await snapshotDistFiles(path.join(tmpPath, "packages", "package-one"));
  await snapshotDistFiles(path.join(tmpPath, "packages", "package-two"));
  await snapshotDistFiles(path.join(tmpPath, "packages", "package-three"));
  await snapshotDistFiles(path.join(tmpPath, "packages", "package-four"));

  expect(await getPkg(path.join(tmpPath, "packages", "package-one")))
    .toMatchInlineSnapshot(`
Object {
  "devDependencies": Object {
    "react": "^16.6.3",
  },
  "license": "MIT",
  "main": "dist/package-one-umd-with-dep.cjs.js",
  "name": "@some-scope/package-one-umd-with-dep",
  "peerDependencies": Object {
    "react": "^16.6.3",
  },
  "preconstruct": Object {
    "umdName": "packageOne",
  },
  "private": true,
  "umd:main": "dist/package-one-umd-with-dep.umd.min.js",
  "version": "1.0.0",
}
`);

  expect(await getPkg(path.join(tmpPath, "packages", "package-two")))
    .toMatchInlineSnapshot(`
Object {
  "devDependencies": Object {
    "react": "^16.6.3",
  },
  "license": "MIT",
  "main": "dist/package-two-umd-with-dep.cjs.js",
  "name": "@some-scope/package-two-umd-with-dep",
  "peerDependencies": Object {
    "react": "^16.6.3",
  },
  "preconstruct": Object {
    "umdName": "packageTwo",
  },
  "private": true,
  "umd:main": "dist/package-two-umd-with-dep.umd.min.js",
  "version": "1.0.0",
}
`);

  expect(await getPkg(tmpPath)).toMatchInlineSnapshot(`
Object {
  "license": "MIT",
  "main": "index.js",
  "name": "monorepo-umd-with-dep",
  "preconstruct": Object {
    "globals": Object {
      "react": "React",
    },
    "packages": Array [
      "packages/*",
    ],
  },
  "private": true,
  "version": "1.0.0",
  "workspaces": Array [
    "packages/*",
  ],
}
`);
});

test.skip("uses @babel/runtime", async () => {
  let tmpPath = f.copy("use-babel-runtime");

  confirms.shouldInstallBabelRuntime.mockReturnValue(Promise.resolve(false));

  try {
    await build(tmpPath);
  } catch (err) {
    expect(err).toBeInstanceOf(FatalError);
    expect(err.message).toMatchInlineSnapshot(
      `"@babel/runtime should be in dependencies of use-babel-runtime"`
    );
  }
});

test("@babel/runtime installed", async () => {
  let tmpPath = f.copy("babel-runtime-installed");

  await install(tmpPath);

  await build(tmpPath);

  await snapshotDistFiles(tmpPath);
});

test.skip("@babel/runtime", async () => {
  let tmpPath = f.copy("babel-runtime-custom-babel");

  await install(tmpPath);

  await build(tmpPath);

  await snapshotDistFiles(tmpPath);
});

test("monorepo single package", async () => {
  let tmpPath = f.copy("monorepo-single-package");
  await initBasic(tmpPath);
  await install(tmpPath);

  await build(tmpPath);
  let pkgPath = path.join(tmpPath, "packages", "package-two");
  await snapshotDistFiles(pkgPath);

  expect(unsafeRequire(pkgPath).default).toBe(2);
});
