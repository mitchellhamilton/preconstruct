import fixturez from "fixturez";
import path from "path";
import init from "../init";
import { confirms as _confirms, errors } from "../messages";
import {
  logMock,
  modifyPkg,
  getPkg,
  createPackageCheckTestCreator
} from "../../test-utils";

const f = fixturez(__dirname);

jest.mock("../prompt");

let confirms = _confirms as jest.Mocked<typeof _confirms>;

let testInit = createPackageCheckTestCreator(init);

afterEach(() => {
  jest.resetAllMocks();
});

test("no entrypoint", async () => {
  let tmpPath = f.copy("no-entrypoint");
  try {
    await init(tmpPath);
  } catch (error) {
    expect(error.message).toBe(errors.noSource("src/index"));
  }
});

test("do not allow write", async () => {
  let tmpPath = f.copy("basic-package");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));

  try {
    await init(tmpPath);
  } catch (error) {
    expect(error.message).toBe(errors.deniedWriteMainField);
  }
  expect(confirms.writeMainField).toBeCalledTimes(1);
});

test("set only main field", async () => {
  let tmpPath = f.copy("basic-package");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(false));

  await init(tmpPath);
  expect(confirms.writeMainField).toBeCalledTimes(1);
  expect(confirms.writeModuleField).toBeCalledTimes(1);

  let pkg = await getPkg(tmpPath);
  expect(pkg).toMatchInlineSnapshot(`
    Object {
      "license": "MIT",
      "main": "dist/basic-package.cjs.js",
      "name": "basic-package",
      "private": true,
      "version": "1.0.0",
    }
  `);
});

test("set main and module field", async () => {
  let tmpPath = f.copy("basic-package");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(true));

  await init(tmpPath);
  expect(confirms.writeMainField).toBeCalledTimes(1);
  expect(confirms.writeModuleField).toBeCalledTimes(1);

  let pkg = await getPkg(tmpPath);

  expect(pkg).toMatchInlineSnapshot(`
    Object {
      "license": "MIT",
      "main": "dist/basic-package.cjs.js",
      "module": "dist/basic-package.esm.js",
      "name": "basic-package",
      "private": true,
      "version": "1.0.0",
    }
  `);
});

test("scoped package", async () => {
  let tmpPath = f.copy("scoped");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(true));

  await init(tmpPath);
  expect(confirms.writeMainField).toBeCalledTimes(1);
  expect(confirms.writeModuleField).toBeCalledTimes(1);
  let pkg = await getPkg(tmpPath);

  expect(pkg).toMatchInlineSnapshot(`
    Object {
      "license": "MIT",
      "main": "dist/some-package.cjs.js",
      "module": "dist/some-package.esm.js",
      "name": "@some-scope/some-package",
      "private": true,
      "version": "1.0.0",
    }
  `);
});

test("monorepo", async () => {
  let tmpPath = f.copy("monorepo");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(true));

  await init(tmpPath);
  expect(confirms.writeMainField).toBeCalledTimes(2);
  expect(confirms.writeModuleField).toBeCalledTimes(2);

  let pkg1 = await getPkg(path.join(tmpPath, "packages", "package-one"));
  let pkg2 = await getPkg(path.join(tmpPath, "packages", "package-two"));

  expect(Object.keys(pkg1)).toMatchInlineSnapshot(`
    Array [
      "name",
      "version",
      "main",
      "module",
      "license",
      "private",
    ]
  `);

  expect(pkg1).toMatchInlineSnapshot(`
    Object {
      "license": "MIT",
      "main": "dist/package-one.cjs.js",
      "module": "dist/package-one.esm.js",
      "name": "@some-scope/package-one",
      "private": true,
      "version": "1.0.0",
    }
  `);

  expect(pkg2).toMatchInlineSnapshot(`
    Object {
      "license": "MIT",
      "main": "dist/package-two.cjs.js",
      "module": "dist/package-two.esm.js",
      "name": "@some-scope/package-two",
      "private": true,
      "version": "1.0.0",
    }
  `);
});

test("does not prompt or modify if already valid", async () => {
  let tmpPath = f.copy("valid-package");
  let original = await getPkg(tmpPath);

  await init(tmpPath);
  let current = await getPkg(tmpPath);
  expect(original).toEqual(current);
  expect(logMock.log.mock.calls).toMatchInlineSnapshot(`
    Array [
      Array [
        "🎁 info valid-package main field is valid",
      ],
      Array [
        "🎁 info valid-package module field is valid",
      ],
      Array [
        "🎁 success initialised project!",
      ],
    ]
  `);
});

test("invalid fields", async () => {
  let tmpPath = f.copy("invalid-fields");

  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  confirms.writeModuleField.mockReturnValue(Promise.resolve(true));

  await init(tmpPath);

  expect(confirms.writeMainField).toBeCalledTimes(1);
  expect(confirms.writeModuleField).toBeCalledTimes(1);

  let pkg = await getPkg(tmpPath);

  expect(pkg).toMatchInlineSnapshot(`
    Object {
      "license": "MIT",
      "main": "dist/invalid-fields.cjs.js",
      "module": "dist/invalid-fields.esm.js",
      "name": "invalid-fields",
      "private": true,
      "version": "1.0.0",
    }
  `);
});

test("fix browser", async () => {
  let tmpPath = f.copy("valid-package");

  confirms.fixBrowserField.mockReturnValue(Promise.resolve(true));

  await modifyPkg(tmpPath, pkg => {
    pkg.browser = "invalid.js";
  });

  await init(tmpPath);

  expect(await getPkg(tmpPath)).toMatchInlineSnapshot(`
    Object {
      "browser": Object {
        "./dist/valid-package.cjs.js": "./dist/valid-package.browser.cjs.js",
        "./dist/valid-package.esm.js": "./dist/valid-package.browser.esm.js",
      },
      "license": "MIT",
      "main": "dist/valid-package.cjs.js",
      "module": "dist/valid-package.esm.js",
      "name": "valid-package",
      "preconstruct": Object {
        "umdName": "validPackage",
      },
      "private": true,
      "umd:main": "dist/valid-package.umd.min.js",
      "version": "1.0.0",
    }
  `);
});

let basicThreeEntrypoints = {
  "": {
    name: "something",
    preconstruct: {
      entrypoints: [".", "one", "two"]
    }
  },
  one: {
    preconstruct: {
      source: "../src"
    }
  },
  two: {
    preconstruct: {
      source: "../src"
    }
  }
};

testInit(
  "three entrypoints, no main, only add main",
  basicThreeEntrypoints,
  async run => {
    confirms.writeMainField.mockReturnValue(Promise.resolve(true));
    confirms.writeModuleField.mockReturnValue(Promise.resolve(false));

    let result = await run();

    expect(result).toMatchInlineSnapshot(`
      Object {
        "": Object {
          "main": "dist/something.cjs.js",
          "name": "something",
          "preconstruct": Object {
            "entrypoints": Array [
              ".",
              "one",
              "two",
            ],
          },
        },
        "one": Object {
          "main": "dist/something.cjs.js",
          "preconstruct": Object {
            "source": "../src",
          },
        },
        "two": Object {
          "main": "dist/something.cjs.js",
          "preconstruct": Object {
            "source": "../src",
          },
        },
      }
    `);
  }
);

testInit(
  "three entrypoints, no main, add main and module",
  basicThreeEntrypoints,
  async run => {
    confirms.writeMainField.mockReturnValue(Promise.resolve(true));
    confirms.writeModuleField.mockReturnValue(Promise.resolve(true));

    let result = await run();

    expect(result).toMatchInlineSnapshot(`
      Object {
        "": Object {
          "main": "dist/something.cjs.js",
          "module": "dist/something.esm.js",
          "name": "something",
          "preconstruct": Object {
            "entrypoints": Array [
              ".",
              "one",
              "two",
            ],
          },
        },
        "one": Object {
          "main": "dist/something.cjs.js",
          "module": "dist/something.esm.js",
          "preconstruct": Object {
            "source": "../src",
          },
        },
        "two": Object {
          "main": "dist/something.cjs.js",
          "module": "dist/something.esm.js",
          "preconstruct": Object {
            "source": "../src",
          },
        },
      }
    `);
  }
);

testInit(
  "three entrypoints, no main, add main and fix browser",
  {
    ...basicThreeEntrypoints,
    "": { ...basicThreeEntrypoints[""], browser: "" }
  },
  async run => {
    confirms.writeMainField.mockReturnValue(Promise.resolve(true));
    confirms.writeModuleField.mockReturnValue(Promise.resolve(false));
    confirms.fixBrowserField.mockReturnValue(Promise.resolve(true));

    let result = await run();

    expect(result).toMatchInlineSnapshot(`
      Object {
        "": Object {
          "browser": Object {
            "./dist/something.cjs.js": "./dist/something.browser.cjs.js",
          },
          "main": "dist/something.cjs.js",
          "name": "something",
          "preconstruct": Object {
            "entrypoints": Array [
              ".",
              "one",
              "two",
            ],
          },
        },
        "one": Object {
          "browser": Object {
            "./dist/something.cjs.js": "./dist/something.browser.cjs.js",
          },
          "main": "dist/something.cjs.js",
          "preconstruct": Object {
            "source": "../src",
          },
        },
        "two": Object {
          "browser": Object {
            "./dist/something.cjs.js": "./dist/something.browser.cjs.js",
          },
          "main": "dist/something.cjs.js",
          "preconstruct": Object {
            "source": "../src",
          },
        },
      }
    `);
  }
);
