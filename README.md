# 🎁 preconstruct

> A smart bundler for libraries

> DISCLAIMER:
>
> While preconstruct is pretty stable in terms of bugs and is used in big projects but a lot of things are still in flux and will change so please be aware of that. We're in 0.0.x versions for a reason.

## Why?

Generating small, performant bundles and making consumer bundlers use the right bundles shouldn't have to be difficult.

## Getting Started

```bash
yarn add --dev preconstruct
yarn preconstruct init
yarn preconstruct build
```

## What does preconstruct do?

preconstruct generates bundles for NPM packages with different module formats and enforces that consumer bundlers like webpack and Node can import those packages.

### Performant Bundles

Performance and bundle size are common concerns when building libraries so preconstruct generates dev and prod CommonJS bundles so that you can have process.env.NODE_ENV checks to have helpful warnings and errors without slowing down production along with building browser specific bundles when you use `typeof window` so that you can have Node.js specific code which is dead code eliminated from browser bundles.

### package.json Validation & Autofixing

preconstruct strictly enforces that the relevant fields in your package.json that tell where Node and bundlers where to look for your bundles are correct so you don't have to worry about them. This means you'll always be publishing working versions of your packages. preconstruct can also fix most invalid

### Minimal Configuration

Rather than having to configure everything, preconstruct infers how your project should be built. For example, if you have a `module` field in your package.json, preconstruct will create an ESM bundle but if you don't have a `module` field in your package.json, preconstruct won't create an ESM bundle.

### Monorepos

preconstruct is built with monorepo's in mind, rather than having to manage and build packages on an individual level, preconstruct lets you manage and build all of your packages together as a single project.

### Custom Entrypoints

preconstruct lets you create entrypoints beyond the standard entrypoint of `package-name` so a single package can have other entrypoints like `package-name/some-cool-thing` and `my-package/another-cool-thing`. These entrypoints still have bundles in multiple module formats so consumer bundlers still get a great bundle for them.

## Aliases

TODO

## Install

```bash
yarn add --dev preconstruct
```

## Usage

### Commands

#### `init`

```bash
preconstruct init
```

`preconstruct init` asks questions about your project and how it should be built.

#### `build`

```bash
preconstruct build
```

`preconstruct build` creates the bundles for your project.

#### `watch`

```bash
preconstruct watch
```

`preconstruct watch` is similar to `preconstruct build` except instead of doing a single build, it will start a watcher and rebuild the project whenever there are changes.

#### `fix`

```bash
preconstruct fix
```

### preconstruct Configuration

Preconstruct accepts configuration at three different configuration points; Projects, Packages and Entrypoints. These configuration points can be represented by one package.json or by 20 package.jsons, it depends on the requirements of a specific project. For example, in a single package repo with one entrypoint, it would be represented by a single package.json.

#### Projects

Projects roughly map 1:1 with a version control repository. They specify global configuration that applies to all builds.

##### `packages`

`Array<string>`

`packages` is an array of globs which specify which packages should be built with preconstruct.

###### Default

> Note: this is the default value, if it's what you want, you don't need to specify it.

```json
{
  "preconstruct": {
    "packages": ["."]
  }
}
```

###### Example

```json
{
  "preconstruct": {
    "packages": ["packages/*"]
  }
}
```

##### `globals`

`{ [packageName: string]: (umdName: string) }`

`globals` specify the UMD names of `peerDependencies` since `peerDependencies` aren't bundled in UMD builds. You don't need to specify this option manually, preconstruct will prompt you for the UMD name when it's necessary.

###### Default

> Note: this is the default value, if it's what you want, you don't need to specify it.

```json
{
  "preconstruct": {
    "globals": {}
  }
}
```

###### Example

```json
{
  "preconstruct": {
    "globals": {
      "react": "React",
      "react-dom": "ReactDOM"
    }
  }
}
```

#### Package

TODO

#### Entrypoint

TODO

### preconstruct

## I want feature X!

Balancing between having minimal to no configuration and being able to support everyone's use case is a really hard problem. preconstruct tries to have good defaults to support lots of common use cases but it won't support everything. We want to make preconstruct work really well for most use cases rather than being okay for all use cases.

# Thanks/Inspiration

- [microbundle](https://github.com/developit/microbundle) was a huge inspiration for this! ❤️
- [rollup](https://rollupjs.org) - rollup has done the really hard stuff that makes preconstruct possible!
- [bolt](https://github.com/boltpkg/bolt) - lots of utils and things in this project were inspired by things in bolt
- all the people who wrote all the dependencies for this project!
