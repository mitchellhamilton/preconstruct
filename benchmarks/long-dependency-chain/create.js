const fs = require("fs-extra");

const content = `class Thing{
    
    something() {}
}


console.log(Thing)`;

const count = 1000;

fs.removeSync("src");

for (const [index] of Array.from({ length: count }).entries()) {
  fs.outputFileSync(
    `src/${index === 0 ? "index" : index}.js`,
    index === count - 1
      ? content
      : `import ${JSON.stringify(`./${index + 1}`)};\n${content}`
  );
}
