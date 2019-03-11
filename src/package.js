// @flow
// based on https://github.com/jamiebuilds/std-pkg but reading fewer things, adding setters and reading the file
import is from "sarcastic";
import nodePath from "path";
import * as fs from "fs-extra";
import { validatePackage } from "./validate";
import { promptInput } from "./prompt";
import pLimit from "p-limit";
import resolveFrom from "resolve-from";
import { Item } from "./item";
// move this to the flow-typed folder later
let globby: {
  (globs: string | Array<string>, options: Object): Promise<Array<string>>,
  sync: (globs: string | Array<string>, options: Object) => Array<string>
} = require("globby");

let unsafeRequire = require;

let objectOfString = is.objectOf(is.string);

let arrayOfString = is.arrayOf(is.string);

let askGlobalLimit = pLimit(1);

export class Package extends Item {
  parent: Package = this;

  async refresh() {
    let contents: string = await fs.readFile(this.path, "utf-8");
    this.json = is(JSON.parse(contents), is.object);
    this._contents = contents;
    if (this._strict) {
      validatePackage(this, false);
      this._strict.json = this.json;
      this._strict._contents = this._contents;
    }
  }
  get name(): string {
    return is(this.json.name, is.string);
  }
  set name(name: string) {
    this.json.name = name;
  }
  get main(): string | null {
    return is(this.json.main, is.maybe(is.string));
  }
  set main(path: string) {
    this.json.main = path;
  }
  get module(): string | null {
    return is(this.json.module, is.maybe(is.string));
  }
  set module(path: string) {
    this.json.module = path;
  }
  get browser(): null | string | { [key: string]: string } {
    return is(
      this.json.browser,
      is.maybe(is.either(is.string, objectOfString))
    );
  }
  set browser(option: string | { [key: string]: string }) {
    this.json.browser = option;
  }
  get reactNative(): null | string | { [key: string]: string } {
    return is(
      this.json["react-native"],
      is.maybe(is.either(is.string, objectOfString))
    );
  }
  set reactNative(option: string | { [key: string]: string }) {
    this.json["react-native"] = option;
  }
  get dependencies(): null | { [key: string]: string } {
    return is(this.json.dependencies, is.maybe(objectOfString));
  }
  get peerDependencies(): null | { [key: string]: string } {
    return is(this.json.peerDependencies, is.maybe(objectOfString));
  }

  global(pkg: string) {
    if (
      this.parent._config.globals !== undefined &&
      this.parent._config.globals[pkg]
    ) {
      return this.parent._config.globals[pkg];
    } else {
      try {
        let pkgJson = unsafeRequire(
          resolveFrom(this.directory, nodePath.join(pkg, "package.json"))
        );
        if (pkgJson && pkgJson.preconstruct && pkgJson.preconstruct.umdName) {
          return pkgJson.preconstruct.umdName;
        }
      } catch (err) {
        if (err.code !== "MODULE_NOT_FOUND") {
          throw err;
        }
      }
      throw askGlobalLimit(() =>
        (async () => {
          // if while we were waiting, that global was added, return
          if (
            this.parent._config.globals !== undefined &&
            this.parent._config.globals[pkg]
          ) {
            return;
          }
          let response = await promptInput(
            `What should the umdName of ${pkg} be?`,
            this
          );
          this.addGlobal(pkg, response);
          await this.save();
        })()
      );
    }
  }

  get configPackages(): Array<string> {
    return is(this.parent._config.packages, arrayOfString);
  }
  // probably gonna be irrelevant later but i want it for now
  get isBolt(): boolean {
    // we only want to return true when there is bolt config
    // AND no yarn workspaces config
    // because emotion has a bolt config and yarn workspaces
    // and if you have both, you probably want workspaces
    let hasBolt = !!this.parent.json.bolt;
    let hasYarnWorkspaces = !!this.parent.json.workspaces;
    return hasBolt && !hasYarnWorkspaces;
  }

  get umdMain(): string | null {
    return is(this.json["umd:main"], is.maybe(is.string));
  }
  set umdMain(path: string) {
    this.json["umd:main"] = path;
  }
  get source(): string {
    return nodePath.join(this.directory, "src", "index.js");
  }
  addGlobal(pkg: string, name: string) {
    if (!this.parent._config.globals) {
      this.parent._config.globals = {};
    }
    this.parent._config.globals[pkg] = name;
  }
  get undName(): null | string {
    return is(this._config.umdName, is.maybe(is.string));
  }
  set umdName(umdName: null | string) {
    if (umdName === null) {
      delete this.json.preconstruct.umdName;
      if (Object.keys(this.json.preconstruct).length === 0) {
        delete this.json.preconstruct;
      }
    }
    if (!this.json.preconstruct) {
      this.json.preconstruct = {};
    }
    this.json.preconstruct.umdName = umdName;
  }

  async packages(): Promise<null | Array<Package>> {
    // suport bolt later probably
    // maybe lerna too though probably not
    if (this.parent._config == null && this.json.workspaces) {
      let _workspaces;
      if (Array.isArray(this.json.workspaces)) {
        _workspaces = this.json.workspaces;
      } else if (Array.isArray(this.json.workspaces.packages)) {
        _workspaces = this.json.workspaces.packages;
      }

      let workspaces = is(_workspaces, is.arrayOf(is.string));

      let packages = await promptInput(
        "what packages should preconstruct build?",
        this,
        workspaces.join(",")
      );

      this.parent._config.packages = packages.split(",");

      await this.save();
    }

    try {
      let filenames = await globby(this.configPackages, {
        cwd: this.directory,
        onlyDirectories: true,
        absolute: true,
        expandDirectories: false
      });

      let packages = await Promise.all(
        filenames.map(async x => {
          let pkg = await Package.create(x);
          pkg.parent = this;
          return pkg;
        })
      );
      return packages;
    } catch (error) {
      if (error instanceof is.AssertionError) {
        return null;
      }
      throw error;
    }
  }
  packagesSync(): Array<Package> | null {
    try {
      let filenames = globby.sync(this.configPackages, {
        cwd: this.directory,
        onlyDirectories: true,
        absolute: true,
        expandDirectories: false
      });
      let packages = filenames.map(x => {
        let pkg = Package.createSync(x);
        pkg.parent = this;
        return pkg;
      });
      return packages;
    } catch (error) {
      if (error instanceof is.AssertionError) {
        return null;
      }
      throw error;
    }
  }
  _strict: StrictPackage;
  strict(): StrictPackage {
    validatePackage(this, false);
    if (!this._strict) {
      this._strict = new StrictPackage(this.path, this._contents);
      this._strict.parent = this.parent;
    }
    return this._strict;
  }
  async save() {
    if (Object.keys(this._config).length) {
      this.json.preconstruct = this._config;
    } else {
      delete this.json.preconstruct;
    }
    await fs.writeFile(this.path, JSON.stringify(this.json, null, 2) + "\n");
    if (this.parent !== this) {
      await this.parent.save();
    }

    this._config = this.json.preconstruct || {};
  }
}

export class StrictPackage extends Package {
  get main(): string {
    return is(this.json.main, is.string);
  }
  set main(path: string) {
    this.json.main = path;
  }
  updater(json: Object) {
    super.updater(json);
    validatePackage(this, false);
  }
}
