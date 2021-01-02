import { getWorker } from "../worker-client";
import { AcornNode, Plugin } from "rollup";
import QuickLRU from "quick-lru";
import resolveFrom from "resolve-from";

const lru = new QuickLRU<
  string,
  { code: string; promise: Promise<{ code: string; map: any; ast: AcornNode }> }
>({
  maxSize: 1000,
});

let extensionRegex = /\.[tj]sx?$/;

let externalHelpersCache = new Map<
  string,
  {
    ast: AcornNode;
    code: string;
  }
>();

const resolvedBabelCore = require.resolve("@babel/core");

const babelHelpers: typeof import("@babel/helpers") = require(resolveFrom(
  resolvedBabelCore,
  "@babel/helpers"
));

const babelGenerator: typeof import("@babel/generator") = require(resolveFrom(
  resolvedBabelCore,
  "@babel/generator"
));

let rollupPluginBabel = ({
  cwd,
  reportTransformedFile,
}: {
  cwd: string;
  reportTransformedFile: (filename: string) => void;
}): Plugin => {
  return {
    name: "babel",
    resolveId(id, parent) {
      const currentIsBabelHelper = id.startsWith("\0rollupPluginBabelHelpers/");
      if (!currentIsBabelHelper) {
        if (parent && parent.startsWith("\0rollupPluginBabelHelpers/")) {
          return `\0rollupPluginBabelHelpers/${id}`;
        }
        return null;
      }
      return id;
    },

    load(id) {
      let helperName = id.replace(/\0rollupPluginBabelHelpers\//, "");
      if (helperName === id) {
        return null;
      }
      let helpersSourceDescription = externalHelpersCache.get(helperName);
      if (helpersSourceDescription === undefined) {
        let helpers = babelGenerator.default(
          // @ts-ignore
          {
            type: "Program",
            body: babelHelpers.get(helperName).nodes,
          }
        ).code;

        helpersSourceDescription = {
          ast: this.parse(helpers, undefined),
          code: helpers,
        };
        externalHelpersCache.set(helperName, helpersSourceDescription);
      }
      return helpersSourceDescription;
    },
    transform(code, filename) {
      if (
        typeof filename !== "string" ||
        filename[0] === "\0" ||
        !extensionRegex.test(filename) ||
        filename.includes("node_modules")
      ) {
        return null;
      }
      if (lru.has(filename)) {
        let cachedResult = lru.get(filename)!;
        if (code === cachedResult.code) {
          return cachedResult.promise.then((result) => {
            const ast = JSON.parse(JSON.stringify(result.ast));
            return {
              code: result.code,
              map: result.map,
              ast,
              meta: {
                babel: { ast },
              },
            };
          });
        }
      }
      let promise = getWorker()
        .transformBabel(code, cwd, filename)
        .then((x) => {
          reportTransformedFile(filename);
          const ast = this.parse(x.code!, undefined);
          return {
            code: x.code,
            ast,
            map: x.map,
            meta: {
              babel: { ast },
            },
          };
        });
      lru.set(filename, { code, promise });
      return promise;
    },
  };
};

export default rollupPluginBabel;
