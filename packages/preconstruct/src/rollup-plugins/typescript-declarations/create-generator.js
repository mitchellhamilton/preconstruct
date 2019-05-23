// @flow
import resolveFrom from "resolve-from";
import * as fs from "fs-extra";
import path from "path";
import { createLanguageServiceHostClass } from "./language-service-host";

let unsafeRequire = require;

export async function createDeclarationCreator(
  dirname: string
): Promise<(filename: string) => { name: string, content: string }> {
  let typescript;
  try {
    typescript = unsafeRequire(resolveFrom(dirname, "typescript"));
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "an entrypoint source file ends with the .ts or .tsx extension but the typescript module could not be resolved from the project directory, please install it."
      );
    }
    throw err;
  }
  let configFileName = typescript.findConfigFile(
    dirname,
    typescript.sys.fileExists
  );
  if (!configFileName) {
    throw new Error(
      "an entrypoint source file ends with the .ts extension but no TypeScript config exists, please create one."
    );
  }
  let configFileContents = await fs.readFile(configFileName, "utf8");
  const result = typescript.parseConfigFileTextToJson(
    configFileName,
    configFileContents
  );

  let thing = typescript.parseJsonConfigFileContent(
    result,
    typescript.sys,
    process.cwd(),
    undefined,
    configFileName
  );

  let LanguageServiceHostClass = createLanguageServiceHostClass(typescript);

  let servicesHost = new LanguageServiceHostClass(thing, []);

  let service = typescript.createLanguageService(
    servicesHost,
    typescript.createDocumentRegistry()
  );
  servicesHost.setLanguageService(service);

  return (filename: string) => {
    let output = service.getEmitOutput(filename, true);
    return {
      name: output.outputFiles[0].name.replace(
        dirname,
        path.join(dirname, "dist", "declarations")
      ),
      content: output.outputFiles[0].text
    };
  };
}
