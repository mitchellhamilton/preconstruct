import fixturez from "fixturez";
import fix from "../fix";
import path from "path";
import { confirms as _confirms, errors, inputs } from "../messages";
import {
  getPkg,
  modifyPkg,
  logMock,
  createPackageCheckTestCreator
} from "../../test-utils";
import { promptInput as _promptInput } from "../prompt";
import fs from "fs-extra";

const f = fixturez(__dirname);

jest.mock("../prompt");

let confirms = _confirms as jest.Mocked<typeof _confirms>;

let promptInput = _promptInput as jest.MockedFunction<typeof _promptInput>;

let testFix = createPackageCheckTestCreator(fix);

afterEach(() => {
  jest.resetAllMocks();
});

test("no entrypoint", async () => {
  let tmpPath = f.copy("no-entrypoint");
  try {
    await fix(tmpPath);
  } catch (error) {
    expect(error.message).toBe(errors.noSource("src/index"));
  }
});

test("only main", async () => {
  let tmpPath = f.copy("no-module");
  confirms.writeMainField.mockReturnValue(Promise.resolve(true));
  let origJson = await getPkg(tmpPath);
  await modifyPkg(tmpPath, json => {
    json.main = "bad";
  });

  await fix(tmpPath);

  expect(origJson).toEqual(await getPkg(tmpPath));
});

test("set main and module field", async () => {
  let tmpPath = f.copy("basic-package");

  await modifyPkg(tmpPath, json => {
    json.module = "bad.js";
  });

  await fix(tmpPath);

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

test("monorepo", async () => {
  let tmpPath = f.copy("monorepo");

  for (let name of ["package-one", "package-two"]) {
    await modifyPkg(path.join(tmpPath, "packages", name), pkg => {
      pkg.module = "bad.js";
    });
  }

  await fix(tmpPath);

  let pkg1 = await getPkg(path.join(tmpPath, "packages", "package-one"));
  let pkg2 = await getPkg(path.join(tmpPath, "packages", "package-two"));

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

test("does not modify if already valid", async () => {
  let tmpPath = f.copy("valid-package");
  let original = await getPkg(tmpPath);

  await fix(tmpPath);
  let current = await getPkg(tmpPath);
  expect(original).toEqual(current);
  expect(logMock.log.mock.calls).toMatchInlineSnapshot(`
    Array [
      Array [
        "🎁 success project already valid!",
      ],
    ]
  `);
});

test("invalid fields", async () => {
  let tmpPath = f.copy("invalid-fields");

  await fix(tmpPath);

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

  await modifyPkg(tmpPath, pkg => {
    pkg.browser = "bad.js";
  });

  await fix(tmpPath);

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

test("monorepo single package", async () => {
  let tmpPath = f.copy("monorepo-single-package");

  await fix(tmpPath);
  expect(logMock.log.mock.calls).toMatchInlineSnapshot(`
    Array [
      Array [
        "🎁 success project already valid!",
      ],
    ]
  `);
});

testFix(
  "umd:main but no umdName specified",
  {
    "": {
      name: "something",
      main: "dist/something.cjs.js",
      "umd:main": "will be fixed"
    }
  },
  async run => {
    promptInput.mockImplementation(async (message, item) => {
      expect(message).toBe(inputs.getUmdName);
      expect(item.name).toBe("something");
      return "somethingUmdName";
    });

    let contents = await run();

    expect(contents).toMatchInlineSnapshot(`
      Object {
        "": Object {
          "main": "dist/something.cjs.js",
          "name": "something",
          "preconstruct": Object {
            "umdName": "somethingUmdName",
          },
          "umd:main": "dist/something.umd.min.js",
        },
      }
    `);
    expect(contents[""].preconstruct.umdName).toBe("somethingUmdName");
    expect(contents[""]["umd:main"]).toBe("dist/something.umd.min.js");

    expect(promptInput).toBeCalledTimes(1);
  }
);

test("fix browser", async () => {
  let tmpPath = f.copy("valid-package");

  confirms.createEntrypoint.mockImplementation(async x => {
    if (x.name === "valid-package/another") {
      debugger;
      return true;
    } else {
      throw new Error("this should never happen: " + x.name);
    }
  });

  await modifyPkg(tmpPath, pkg => {
    pkg.preconstruct.entrypoints = [".", "another"];
  });
  try {
    await fix(tmpPath);
  } catch (err) {
    expect(err.message).toBe(errors.noSource("src/index"));
  }

  expect(confirms.createEntrypoint).toBeCalledTimes(1);

  expect(
    await fs.readFile(path.join(tmpPath, "another", "package.json"), "utf8")
  ).toMatchInlineSnapshot(`
    "{
      \\"main\\": \\"dist/valid-package.cjs.js\\",
      \\"module\\": \\"dist/valid-package.esm.js\\",
      \\"umd:main\\": \\"dist/valid-package.umd.min.js\\"
    }
    "
  `);

  expect(await getPkg(tmpPath)).toMatchInlineSnapshot(`
    Object {
      "license": "MIT",
      "main": "dist/valid-package.cjs.js",
      "module": "dist/valid-package.esm.js",
      "name": "valid-package",
      "preconstruct": Object {
        "entrypoints": Array [
          ".",
          "another",
        ],
        "umdName": "validPackage",
      },
      "private": true,
      "umd:main": "dist/valid-package.umd.min.js",
      "version": "1.0.0",
    }
  `);
});
