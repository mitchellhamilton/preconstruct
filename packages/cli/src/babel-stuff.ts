import * as babel from "@babel/core";
import path from "path";
import crypto from "crypto";
import resolveFrom from "resolve-from";

function normalizeOptions(config: {
  options: any;
  passes: any;
}): babel.TransformOptions & {
  parserOpts: babel.ParserOptions;
  generatorOpts: babel.GeneratorOptions;
} {
  const {
    filename,
    cwd,
    filenameRelative = typeof filename === "string"
      ? path.relative(cwd, filename)
      : "unknown",
    sourceType = "module",
    inputSourceMap,
    sourceMaps = !!inputSourceMap,

    moduleRoot,
    sourceRoot = moduleRoot,

    sourceFileName = path.basename(filenameRelative),

    comments = true,
  } = config.options;

  const opts = config.options;

  const options = {
    ...opts,

    parserOpts: {
      sourceType:
        path.extname(filenameRelative) === ".mjs" ? "module" : sourceType,

      sourceFileName: filename,
      plugins: [],
      ...opts.parserOpts,
    },

    generatorOpts: {
      // General generator flags.
      filename,
      comments,
      shouldPrintComment: opts.shouldPrintComment,
      // Source-map generation flags.
      sourceMaps,

      sourceRoot,
      sourceFileName,
      ...opts.generatorOpts,
    },
  };

  for (const plugins of config.passes) {
    for (const plugin of plugins) {
      if (plugin.manipulateOptions) {
        plugin.manipulateOptions(options, options.parserOpts);
      }
    }
  }

  return options;
}

export function hashString(input: string) {
  let md5sum = crypto.createHash("md5");
  md5sum.update(input);
  return md5sum.digest("hex");
}

const babelParserVersion = require(resolveFrom(
  require.resolve("@babel/core"),
  "@babel/parser/package.json"
)).version;

const babelGeneratorVersion = require(resolveFrom(
  require.resolve("@babel/core"),
  "@babel/parser/package.json"
)).version;

export function resolveOptions(inputOptions: babel.TransformOptions) {
  let options = babel.loadOptions(inputOptions) as any;

  if (!options) return null;

  const normalized = normalizeOptions({
    options,
    passes: [options.plugins, ...options.presets],
  });

  const parseCacheKey = hashString(
    JSON.stringify({
      parserOpts: normalized.parserOpts,
      babelParserVersion,
    })
  );

  const generatorCacheKey = hashString(
    JSON.stringify({
      generatorOpts: normalized.generatorOpts,
      babelGeneratorVersion,
    })
  );
  return {
    parseCacheKey,
    generatorCacheKey,
    options: normalized,
  };
}
