file: ./content/docs/cli/index.mdx
# Fumadocs CLI (the CLI tool for automating Fumadocs apps): User Guide

The CLI tool that automates setups and installing components.
        
## Installation

Initialize a config for CLI:

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli
    ```
  </Tab>
</Tabs>

You can change the output paths of components in the config.

### Components

Select and install components.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli add
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli add
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli add
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli add
    ```
  </Tab>
</Tabs>

You can pass component names directly.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli add banner files
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli add banner files
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli add banner files
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli add banner files
    ```
  </Tab>
</Tabs>

#### How the magic works?

The CLI fetches the latest version of component from the GitHub repository of Fumadocs.
When you install the component, it is guaranteed to be up-to-date.

In addition, it also transforms import paths.
Make sure to use the latest version of CLI

> This is highly Inspired by Shadcn UI.

### Customise

A simple way to customise Fumadocs layouts.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli customise
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli customise
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli customise
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli customise
    ```
  </Tab>
</Tabs>

### Tree

Generate files tree for Fumadocs UI `Files` component, using the `tree` command from your terminal.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli tree ./my-dir ./output.tsx
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli tree ./my-dir ./output.tsx
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli tree ./my-dir ./output.tsx
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli tree ./my-dir ./output.tsx
    ```
  </Tab>
</Tabs>

You can output MDX file too:

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli tree ./my-dir ./output.mdx
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli tree ./my-dir ./output.mdx
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli tree ./my-dir ./output.mdx
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli tree ./my-dir ./output.mdx
    ```
  </Tab>
</Tabs>

See help for further details:

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli tree -h
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli tree -h
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli tree -h
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli tree -h
    ```
  </Tab>
</Tabs>

#### Example Output

```tsx title="output.tsx"
import { File, Folder, Files } from 'fumadocs-ui/components/files';

export default (
  <Files>
    <Folder name="app">
      <File name="layout.tsx" />
      <File name="page.tsx" />
      <File name="global.css" />
    </Folder>
    <Folder name="components">
      <File name="button.tsx" />
      <File name="tabs.tsx" />
      <File name="dialog.tsx" />
    </Folder>
    <File name="package.json" />
  </Files>
);
```

### Initialize Features

Some features of Fumadocs require copying code to get started, it is similar to `codemod` but for configuring features automatically.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli init
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli init
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli init
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli init
    ```
  </Tab>
</Tabs>

Please note that some features may change your existing code, make sure to commit your changes to Git before running it.


file: ./content/docs/headless/custom-source.mdx
# Fumadocs Core (core library of framework): Custom Source

Build your own content source
        
## Introduction

**Fumadocs is very flexible.** You can integrate with any content source, even without an official adapter.

> This guide assumes you are experienced with Next.js App Router.

### Examples

You can see examples to use Fumadocs with a CMS, which allows a nice experience on publishing content, and real-time update without re-building the app.

* [BaseHub](https://github.com/fuma-nama/fumadocs-basehub)
* [Sanity](https://github.com/fuma-nama/fumadocs-sanity)

For a custom content source implementation, you will need:

### Page Tree

You can either hardcode the page tree, or write some code to generate one.
See [Definitions of Page Tree](/docs/headless/page-tree).

Pass your Page Tree to `DocsLayout` (usually in a `layout.tsx`).

```tsx title="layout.tsx"
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      nav={{ title: 'Example Docs' }}
      tree={
        {
          /// your own tree
        }
      }
    >
      {children}
    </DocsLayout>
  );
}
```

The page tree is like a smarter "sidebar items", they will be referenced everywhere in the UI for navigation elements, such as the page footer.

### Docs Page

Same as a normal Next.js app, the code of your docs page is located in `[[...slug]]/page.tsx`.

#### SSG

Define the [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) function.
It should return a list of parameters (`params`) to populate the `[[...slug]]` catch-all route.

#### Body

In the main body of page, find the corresponding page according to the slug and render its content inside the `DocsPage` component.

You also need table of contents, which can be generated with your own implementation, or using the [`getTableOfContents`](/docs/headless/utils/get-toc) utility (Markdown/MDX only).

```tsx
import { DocsPage, DocsBody } from 'fumadocs-ui/page';
import { getPage } from './my-content-source';
import { notFound } from 'next/navigation';

export default function Page({ params }: { params: { slug?: string[] } }) {
  const page = getPage(params.slug);
  if (!page) notFound();

  return (
    <DocsPage toc={page.tableOfContents}>
      <DocsBody>{page.render()}</DocsBody>
    </DocsPage>
  );
}
```

#### Metadata

Next.js offers a Metadata API for SEO, you can configure it with `generateMetadata` (similar as the code above).

### Document Search

This can be difficult considering your content may not be necessarily Markdown/MDX.
For Markdown and MDX, the built-in [Search API](/docs/headless/search/orama) is adequate for most use cases.
Otherwise, you will have to bring your own implementation.

We recommend 3rd party solutions like Algolia Search. They are more flexible than the built-in Search API, and is easier to integrate with remote sources.
Fumadocs offers a simple [Algolia Search Adapter](/docs/headless/search/algolia), which includes a search client to integrate with Fumadocs UI.

## MDX Remote

Fumadocs offers the **MDX Remote** package, it is a helper to integrate Markdown-based content sources with Fumadocs.
You can think it as a `next-mdx-remote` with built-in plugins for Fumadocs.

### Setup

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install @fumadocs/mdx-remote
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add @fumadocs/mdx-remote
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add @fumadocs/mdx-remote
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add @fumadocs/mdx-remote
    ```
  </Tab>
</Tabs>

The main feature it offers is the MDX Compiler, it can compile MDX content to JSX nodes.
Since it doesn't use a bundler, there's some limitations:

* No imports and exports in MDX files.

It's compatible with Server Components. For example:

```tsx
import { compileMDX } from '@fumadocs/mdx-remote';
import { getPage } from './my-content-source';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import { getMDXComponents } from '@/mdx-components';

export default async function Page({
  params,
}: {
  params: { slug?: string[] };
}) {
  const page = getPage(params.slug);
  const compiled = await compileMDX({
    source: page.content,
  });

  const MdxContent = compiled.body;

  return (
    <DocsPage toc={compiled.toc}>
      <DocsBody>
        <MdxContent components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}
```

#### Images

On some platforms like Vercel, the original `public` folder (including static assets like images) will be removed after `next build`.
`compileMDX` might no longer be able to access local images in `public`.

When referencing images, make sure to use a URL.


file: ./content/docs/headless/index.mdx
# Fumadocs Core (core library of framework): Introduction

Getting started with core library
        
## What is this?

Fumadocs Core offers server-side functions and headless components to build docs on any React.js frameworks like Next.js.

* Search (built-in: Orama, Algolia Search)
* Breadcrumb, Sidebar, TOC Components
* Remark/Rehype Plugins
* Additional utilities

<Callout title="Tip">
  It can be used without Fumadocs UI, in other words, it's headless.

  For beginners and normal usages, use [Fumadocs UI](/docs/ui).
</Callout>

## Installation

No other dependencies required.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install fumadocs-core
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add fumadocs-core
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add fumadocs-core
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add fumadocs-core
    ```
  </Tab>
</Tabs>

For some components, a framework provider is needed:

```tsx tab="Next.js"
import type { ReactNode } from 'react';
import { NextProvider } from 'fumadocs-core/framework/next';

export function RootLayout({ children }: { children: ReactNode }) {
  // or if you're using Fumadocs UI, use `<RootProvider />`
  return <NextProvider>{children}</NextProvider>;
}
```

```tsx tab="React Router"
import type { ReactNode } from 'react';
import { ReactRouterProvider } from 'fumadocs-core/framework/react-router';

export function Root({ children }: { children: ReactNode }) {
  return <ReactRouterProvider>{children}</ReactRouterProvider>;
}
```

```tsx tab="Tanstack Start/Router"
import type { ReactNode } from 'react';
import { TanstackProvider } from 'fumadocs-core/framework/tanstack';

export function Root({ children }: { children: ReactNode }) {
  return <TanstackProvider>{children}</TanstackProvider>;
}
```

It offers simple document searching as well as components for building a
good docs.

<Cards>
  <Card title="Breadcrumb" href="/docs/headless/components/breadcrumb" description="The navigation component at the top of screen" />

  <Card title="TOC" href="/docs/headless/components/toc" description="A Table of Contents with active anchor observer" />

  <Card title="Sidebar" href="/docs/headless/components/sidebar" description="The navigation bar at aside of viewport" />

  <Card title="Search" href="/docs/headless/search" description="Implement document searching" />
</Cards>


file: ./content/docs/headless/internationalization.mdx
# Fumadocs Core (core library of framework): Internationalization

Support multiple languages in your documentation
        
## Introduction

Fumadocs core provides necessary middleware and options for i18n support.

You can define a config to share between utilities.

```ts title="lib/i18n.ts"
import type { I18nConfig } from 'fumadocs-core/i18n';

export const i18n: I18nConfig = {
  defaultLanguage: 'en',
  languages: ['en', 'cn'],
};
```

### Middleware

Redirects users to appropriate locale.

```ts title="middleware.ts"
import { createI18nMiddleware } from 'fumadocs-core/i18n';
import { i18n } from '@/lib/i18n';

export default createI18nMiddleware(i18n);

export const config = {
  // Matcher ignoring `/_next/` and `/api/`
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

You can also customise the i18n middleware from `i18n.ts`.

#### Hide Locale Prefix

To hide the locale prefix, for example, use `/` instead of `/en`, use the `hideLocale` option.

| Mode             | Description                                        |
| ---------------- | -------------------------------------------------- |
| `always`         | Always hide the prefix, detect locale from cookies |
| `default-locale` | Only hide the default locale                       |
| `never`          | Never hide the prefix (default)                    |

```ts
import type { I18nConfig } from 'fumadocs-core/i18n';

export const i18n: I18nConfig = {
  defaultLanguage: 'en',
  languages: ['en', 'cn'],
  hideLocale: 'default-locale',
};
```

> It uses `NextResponse.rewrite` to hide locale prefixes.

It's **not recommended** to use `always`.
On this mode, locale is stored as a cookie, read and set on the middleware.

This may cause undesired cache problems on your hosting platform, and need to pay extra attention on SEO to ensure search engines can index your pages correctly.


file: ./content/docs/headless/page-conventions.mdx
# Fumadocs Core (core library of framework): Organizing Pages

A shared convention for organizing your documents
        
## Overview

Page slugs and sidebar items (page tree) are generated from your file structure, similar to file-system based routing in Next.js.

> This only applies for file-system based content sources, such as Fumadocs MDX.

## File

A [MDX](https://mdxjs.com) or Markdown file.

### Frontmatter

By default, it includes:

| name          | description                                        |
| ------------- | -------------------------------------------------- |
| `title`       | The title of page                                  |
| `description` | The description of page                            |
| `icon`        | The name of icon, see [Icons](#icons)              |
| `full`        | Fill all available space on the page (Fumadocs UI) |

You may extend your content source to add additional properties.

```mdx
---
title: My Page
description: Best document ever
icon: HomeIcon
full: false
---

## Learn More
```

### Slugs

The generated slugs will be same as your file path.

| path (relative to content folder) | slugs             |
| --------------------------------- | ----------------- |
| `./dir/page.mdx`                  | `['dir', 'page']` |
| `./dir/index.mdx`                 | `['dir']`         |

## Folder

Organize multiple pages. When not specified, the display name will be generated from its folder name.

Pages are sorted alphabetically, except `index.mdx` which is always ordered at the top.

To customise folders, use [Meta file](#meta).

### Folder Group

By default, putting a file into folder will change its slugs and generated page URL.
You can use folder group to add a folder without impacting the slugs of child files.

To create a folder group, wrap the folder name in parentheses.

<Files>
  <Folder name="(group-name)" defaultOpen>
    <File name="file.mdx" />
  </Folder>
</Files>

## Meta

Customize a folder by creating a `meta.json` file in a folder under content folder.

### Display Name

```json title="meta.json"
{
  "title": "Name of Folder"
}
```

### Icon

Specify an icon name for folder with the `icon` property, see [Icons](#icons).

```json title="meta.json"
{
  "title": "My Folder",
  "icon": "MyIcon"
}
```

### Pages

Control the order of items.

When a meta file is present, items are not included unless you have explicitly added them to `pages`.

```json title="meta.json"
{
  "title": "Name of Folder",
  "pages": ["guide", "components"]
}
```

<Files>
  <File name="meta.json" />

  <File name="guide.mdx" />

  <File name="components.mdx" />
</Files>

### Path

The items of `pages` can also be a relative path to a page or folder, no file extensions needed.

```json title="meta.json"
{
  "title": "Name of Folder",
  "pages": ["../headless/page"]
}
```

### Open by Default

Force to open the folder by default.

```json title="meta.json"
{
  "title": "Name of Folder",
  "defaultOpen": true
}
```

### Separator

You can define a separator in meta by adding a item surrounded with `---`.

```json title="meta.json"
{
  "title": "Name of Folder",
  "pages": ["---Separator---"]
}
```

### Rest

Add a Rest (`...`) item to automatically add and sort remaining page items alphabetically.

<Callout title="Note">
  Index pages won't be included, you must specify the order of `index`.
</Callout>

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["guide", "..."]
}
```

You can also sort items reversely.

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["guide", "z...a"]
}
```

### Except

In conjunction with the Rest item (`...`), you can use `!name` to exclude an item from the rest.

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["...", "!hide-this-page"]
}
```

### Extract

You can extract the items from a folder with `...folder_name`.

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["guide", "...folder"]
}
```

### Link

Use the syntax `[Text](url)` to insert links.

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["index", "[Vercel](https://vercel.com)"]
}
```

You can add an icon too.

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["index", "[Triangle][Vercel](https://vercel.com)"]
}
```

## Icons

Since Fumadocs doesn't include an icon library, you have to convert the icon names to JSX elements in runtime, and render it as a component.

You can add an [`icon` handler](/docs/headless/source-api#icons) to `loader()`.

## Root Folder

Marks the folder as a root folder.

<Callout title="Fumadocs UI">
  Fumadocs UI renders root folders as [Sidebar Tabs](/docs/ui/navigation/sidebar#sidebar-tabs), which allows user to switch between them.
</Callout>

```json title="meta.json"
{
  "title": "Name of Folder",
  "description": "The description of root folder (optional)",
  "root": true
}
```

Only items in the current root folder will be considered.

For example, when you are in a root folder called `framework`, the other folders (e.g. `headless`) are not shown on the sidebar and other navigation elements.

<Files>
  <Folder name="framework" defaultOpen>
    <File name="Current Page" className="!text-fd-primary !bg-fd-primary/10" />

    <File name="Other Pages" />
  </Folder>

  <Folder name="headless" className="opacity-50" disabled defaultOpen>
    <File name="Invisible Page" />
  </Folder>
</Files>

### Index Pages

By default, index pages are not considered as the child item of a folder, you must specify them in the `pages` property.

## Internationalization

You can add Markdown/meta files for different languages by attending `.{locale}` to your file name, like `page.fr.md` and `meta.fr.json`.

Make sure to create a file for the default locale first, the locale code is optional (e.g. both `get-started.mdx` and `get-started.en.mdx` are accepted).

<Files>
  <Folder name="content/docs" defaultOpen>
    <File name="meta.json" />

    <File name="meta.cn.json" />

    <File name="get-started.mdx" />

    <File name="get-started.cn.mdx" />
  </Folder>
</Files>


file: ./content/docs/headless/page-tree.mdx
# Fumadocs Core (core library of framework): Page Tree

The structure of page tree.
        
Page tree is a tree structure that describes all navigation links, with other items like separator and folders.

It will be sent to the client and being referenced in navigation elements including the sidebar and breadcrumb.
Hence, you shouldn't store any sensitive or large data in page tree.

<Callout title="Note">
  By design, page tree only contains necessary information of all pages and folders.

  Unserializable data such as functions can't be passed to page tree.
</Callout>

## Conventions

This is the definitions of Page Tree, you may refer to Page Conventions to learn how to structure your folders/pages.

Certain nodes contain a `$ref` property to link to its original page/meta file, they are optional when hardcoding it.

### Root

The initial root of page trees.

<AutoTypeTable path="./content/docs/headless/props.ts" name="PageTreeRoot" />

### Page

```json
{
  "type": "page",
  "name": "Quick Start",
  "url": "/docs"
}
```

> External urls are also supported

<AutoTypeTable path="./content/docs/headless/props.ts" name="PageTreeItem" />

### Folder

```json
{
    "type": "folder",
    "name": "Guide",
    "index": {
        "type": "page",
        ...
    }
    "children": [
        ...
    ]
}
```

<AutoTypeTable path="./content/docs/headless/props.ts" name="PageTreeFolder" />

#### As Root

To implement multiple page trees, you can add a `root` property to the folder node.
This will mark the folder as a root folder, and the nearest root folder of current page will be used as the root of page tree.
Instead of showing the entire page tree, navigation elements will be restricted within the current root.

### Separator

A label between items.

```json
{
  "type": "separator",
  "name": "Components"
}
```

<AutoTypeTable path="./content/docs/headless/props.ts" name="PageTreeSeparator" />

## Icons

Icon is a `ReactElement`, supported by pages and folders.

## Type Bindings

You can import the type from server package.

```ts
import type { PageTree } from 'fumadocs-core/server';

const tree: PageTree.Root = {
  // props
};
```


file: ./content/docs/headless/source-api.mdx
# Fumadocs Core (core library of framework): loader()

Turn a content source into a unified interface
        
## Usage

`loader()` provides an interface for Fumadocs to integrate with file-system based content sources.

### What it does?

* Generate page trees based on file system.
* Assign URL and slugs to each page.
* Output useful utilities to interact with content.

It doesn't rely on the real file system (zero `node:fs` usage), a virtual storage is also allowed.

You can use it with built-in content sources like Fumadocs MDX.

```ts
import { loader } from 'fumadocs-core/source';
import { docs } from '@/.source';

export const source = loader({
  source: docs.toFumadocsSource(),
});
```

> The output page tree strictly follows [Page Conventions](/docs/headless/page-conventions).

### Base URL

The loader generates a URL for each page, you can override the default base URL.

```ts
import { loader } from 'fumadocs-core/source';

loader({
  baseUrl: '/docs',
});
```

### Icons

Load the [icon](/docs/headless/page-conventions#icons) property specified by pages and meta files.

```ts
import { loader } from 'fumadocs-core/source';
import { icons } from 'lucide-react';
import { createElement } from 'react';

loader({
  icon(icon) {
    if (!icon) {
      // You may set a default icon
      return;
    }

    if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
  },
});
```

### I18n

Pass the `i18n` config to loader.

```ts title="lib/source.ts"
import { i18n } from '@/lib/i18n';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  i18n, // [!code highlight]
});
```

With i18n enabled, loader will generate a page tree for every locale.

When looking for a page, it fallbacks to default locale if the page doesn't exist for specified locale.

## Output

The loader outputs a source object.

### Get Page

Get page with slugs.

```ts
import { source } from '@/lib/source';

source.getPage(['slug', 'of', 'page']);

// with i18n
source.getPage(['slug', 'of', 'page'], 'locale');
```

### Get Pages

Get a list of page available for locale.

```ts
import { source } from '@/lib/source';

// from default locale
source.getPages();

// for a specific locale
source.getPages('locale');
```

### Page Tree

```ts
import { source } from '@/lib/source';

// without i18n
source.pageTree;

// with i18n
source.pageTree['locale'];
```

### Get from Node

The page tree nodes contain references to their original file path.
You can find their original page or meta file from the tree nodes.

```ts
import { source } from '@/lib/source';

source.getNodePage(pageNode);
source.getNodeMeta(folderNode);
```

### Params

A function to generate output for Next.js `generateStaticParams`.
The generated parameter names will be `slug: string[]` and `lang: string` (i18n only).

```ts title="app/[[...slug]]/page.tsx"
import { source } from '@/lib/source';

export function generateStaticParams() {
  return source.generateParams();
}
```

### Language Entries

Get available languages and its pages.

```ts
import { source } from '@/lib/source';

// language -> pages
const entries = source.getLanguages();
```

## Deep Dive

As mentioned, Source API doesn't rely on real file systems.
During the process, your input source files will be parsed and form a virtual storage to avoid inconsistent behaviour between different OS.

### Transformer

To perform virtual file-system operations before processing, you can add a transformer.

```ts
import { loader } from 'fumadocs-core/source';

loader({
  transformers: [
    ({ storage }) => {
      storage.makeDir();
    },
  ],
});
```

### Page Tree

The page tree is generated from your file system, using the **Page Tree Builder**.
It also filters out some unnecessary information (e.g. unused frontmatter properties).

To customise the process, use the `pageTree` option.
You can attach custom properties to page tree nodes, like customising the display name of pages and folders.

```tsx
import React from 'react';
import { loader } from 'fumadocs-core/source';

loader({
  pageTree: {
    attachFile(node, file) {
      // you can access its file information
      console.log(file?.data);
      // JSX nodes are allowed
      node.name = <>Some JSX Nodes here</>;

      return node;
    },
  },
});
```

### Custom Source

To plug your own content source, create a `Source` object.

It includes a `files` property which is an array of virtual files.
Each virtual file must contain its file path and corresponding data.
You can check type definitions for more info.

Since Source API doesn't rely on file system, file paths cannot be absolute or relative (for example, `./file.mdx` and `D://content/file.mdx` are not allowed).
Instead, pass the file paths like `file.mdx` and `content/file.mdx`.

```ts
import { Source } from 'fumadocs-core/source';

export function createMySource(): Source<{
  metaData: { title: string; pages: string[] }; // Your custom type
  pageData: { title: string; description: string }; // Your custom type
}> {
  return {
    files: [],
  };
}
```


file: ./content/docs/mdx/async.mdx
# Fumadocs MDX (the built-in content source): Async Mode

Runtime compilation of content files.
        
## Introduction

By default, all Markdown and MDX files need to be pre-compiled first, the same constraint also applies on development server.

This may result in longer dev server start time for large docs sites, you can enable Async Mode on `doc` collections to improve this.

### Setup

Install required dependencies.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install @fumadocs/mdx-remote shiki
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add @fumadocs/mdx-remote shiki
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add @fumadocs/mdx-remote shiki
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add @fumadocs/mdx-remote shiki
    ```
  </Tab>
</Tabs>

Enable Async Mode.

```ts tab="Docs Collection"
import { defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
  },
});
```

```ts tab="Doc Collection"
import { defineCollections } from 'fumadocs-mdx/config';

export const doc = defineCollections({
  type: 'doc',
  dir: 'content/docs',
  async: true,
});
```

### Usage

Async Mode allows on-demand compilation of Markdown and MDX content, by moving the compilation process from build time to Next.js runtime.

However, you need to invoke the `load()` async function to load and compile content.

For example:

```tsx title="lib/source.ts"
import { loader } from 'fumadocs-core/source';
import { docs } from '@/.source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
```

```tsx title="page.tsx"
import { source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';

const page = source.getPage(['...']);

if (page) {
  // frontmatter properties are available
  console.log(page.data);

  // Markdown content requires await
  const { body: MdxContent, toc } = await page.data.load();

  console.log(toc);

  return <MdxContent components={getMDXComponents()} />;
}
```

When using Async Mode, we highly recommend to use 3rd party services to implement search, which usually has a better capability to handle massive amount of content to index.

### Constraints

It comes with some limitations on MDX features.

* No import/export allowed in MDX files, for MDX components, pass them from the `components` prop instead.
* Images must be referenced with URL (e.g. `/images/test.png`). Don't use **file paths** like `./image.png`, you should locate your images in `public` folder, and reference them with URLs.


file: ./content/docs/mdx/collections.mdx
# Fumadocs MDX (the built-in content source): Collections

Collection of content data for your app
        
## Define Collections

Define a collection to parse a certain set of files.

```ts
import { defineCollections } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const blog = defineCollections({
  type: 'doc',
  dir: './content/blog',
  schema: z.object({
    // schema
  }),
  // other options
});
```

### `type`

The accepted type of collection.

```ts
import { defineCollections } from 'fumadocs-mdx/config';

// only scan for json/yaml files
export const metaFiles = defineCollections({
  type: 'meta',
  // options
});
```

* `type: meta`

  Accept JSON/YAML Files, available options:

  <AutoTypeTable path="./content/docs/mdx/props.ts" name="MetaCollection" />

* `type: doc`

  Markdown/MDX Documents, available options:

  <AutoTypeTable path="./content/docs/mdx/props.ts" name="DocCollection" />

### `dir`

Directories to scan input files.

### `schema`

The schema to validate file data (frontmatter on `doc` type, content on `meta` type).

```ts
import { defineCollections } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const blog = defineCollections({
  type: 'doc',
  dir: './content/blog',
  schema: z.object({
    name: z.string(),
  }),
});
```

> [Standard Schema](https://standardschema.dev) compatible libraries, including Zod are supported.

Note that the validation is done by build time, hence the output must be serializable.
You can also pass a function and receives the transform context.

```ts
import { defineCollections } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const blog = defineCollections({
  type: 'doc',
  dir: './content/blog',
  schema: (ctx) => {
    return z.object({
      name: z.string(),
      testPath: z.string().default(
        // original file path
        ctx.path,
      ),
    });
  },
});
```

### `mdxOptions`

Customise MDX options on collection level.

```ts title="source.config.ts"
import { defineCollections, getDefaultMDXOptions } from 'fumadocs-mdx/config';

export const blog = defineCollections({
  type: 'doc',
  mdxOptions: {
    // mdx options
  },
});
```

By design, this will remove all default settings applied by your global config and Fumadocs MDX.
You have full control over MDX options.

You can use `getDefaultMDXOptions` to apply default configurations, it accepts the [extended MDX Options](/docs/mdx/mdx#extended).

```ts title="source.config.ts"
import { defineCollections, getDefaultMDXOptions } from 'fumadocs-mdx/config';

export const blog = defineCollections({
  type: 'doc',
  mdxOptions: getDefaultMDXOptions({
    // extended mdx options
  }),
});
```

> This API only available on `doc` type.

## Define Docs

Define a collection for Fumadocs.

```ts
import { defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: '/my/content/dir',
  docs: {
    // optional, options of `doc` collection
  },
  meta: {
    // optional, options of `meta` collection
  },
});
```

### `dir`

Instead of per collection, you should customise `dir` from `defineDocs`:

```ts
import { defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'my/content/dir',
});
```

### `schema`

You can extend the default Zod schema of `docs` and `meta`.

```ts
import { frontmatterSchema, metaSchema, defineDocs } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const docs = defineDocs({
  docs: {
    schema: frontmatterSchema.extend({
      index: z.boolean().default(false),
    }),
  },
  meta: {
    schema: metaSchema.extend({
      // other props
    }),
  },
});
```


file: ./content/docs/mdx/global.mdx
# Fumadocs MDX (the built-in content source): Global Options

Customise Fumadocs MDX
        
## Global Options

Shared options of Fumadocs MDX.

```ts title="source.config.ts"
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  // global options
});
```

<AutoTypeTable path="./content/docs/mdx/props.ts" name="GlobalConfig" />

### MDX Options

Customise the MDX processor options for MDX files.

```ts title="source.config.ts"
import { defineConfig } from 'fumadocs-mdx/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMath],
    // When order matters
    rehypePlugins: (v) => [rehypeKatex, ...v],
  },
});
```

Some default options are applied by Fumadocs MDX, see [Extended MDX Options](/docs/mdx/mdx#extended) for available options.


file: ./content/docs/mdx/include.mdx
# Fumadocs MDX (the built-in content source): Include

Reuse content from other files.
        
## Usage

### Markdown

Specify the target Markdown file path in `<include>` tag (relative to the Markdown file itself).

```mdx title="page.mdx"
<include>./another.mdx</include>
```

This will display the content from target file (e.g. `another.mdx`).

### CodeBlock

For other types of files, it will become a codeblock:

```mdx title="page.mdx"
<include>./script.ts</include>

<include lang="tsx" meta='title="lib.ts"'>
  ./script.ts
</include>
```

### `cwd`

Resolve relative paths from cwd instead of Markdown file:

```mdx
<include cwd lang="tsx" meta='title="lib.ts"'>
  ./script.ts
</include>
```


file: ./content/docs/mdx/index.mdx
# Fumadocs MDX (the built-in content source): Introduction

Learn how to use Fumadocs MDX in your documentation
        
## Introduction

Fumadocs MDX is the official content source of Fumadocs.

It provides the tool for Next.js to transform content into type-safe data, similar to Contentlayer and Content Collections.
This library isn't Fumadocs-only, you can use it to handle blog and other contents.

## Getting Started

Setup Fumadocs MDX for your Fumadocs application.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install fumadocs-mdx @types/mdx
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add fumadocs-mdx @types/mdx
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add fumadocs-mdx @types/mdx
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add fumadocs-mdx @types/mdx
    ```
  </Tab>
</Tabs>

Add the plugin to your `next.config.mjs` file.

```js
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withMDX(config);
```

<Callout title="ESM Only" type="warn" className="mt-4">
  The Next.js config must be a `.mjs` file since Fumadocs is ESM-only.
</Callout>

### Defining Collections

**Collection** refers to a collection containing a certain type of files, there's two types of collections:

* `doc`: Markdown/MDX documents
* `meta`: JSON files

For example, a `doc` collection will include only the `.md` and `.mdx` files:

<Files>
  <Folder name="folder" defaultOpen>
    <File name="ui.md" />
  </Folder>

  <File name="hello.md" />

  <File name="index.mdx" />

  <File name="meta.json" className="opacity-50 cursor-not-allowed" aria-disabled />
</Files>

Fumadocs MDX transforms collections into arrays of type-safe data, accessible in your Next.js app.

You can define collections by creating a `source.config.ts` file.

<Tabs items={["doc", "meta"]}>
  <Tab value="doc">
    Markdown & MDX content will be compiled into a React Server Component, with other useful properties like **Table of Contents**.

    ```ts title="source.config.ts"
    import { defineCollections } from 'fumadocs-mdx/config';

    export const test = defineCollections({
      type: 'doc',
      dir: 'content/docs',
    });
    ```
  </Tab>

  <Tab value="meta">
    JSON data will be transformed with `JSON.parse` into an array of objects.

    ```ts title="source.config.ts"
    import { defineCollections } from 'fumadocs-mdx/config';

    export const test = defineCollections({
      type: 'meta',
      dir: 'content/docs',
    });
    ```
  </Tab>
</Tabs>

For Fumadocs to work, you can define a `docs` collection:

```ts title="source.config.ts"
import { defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // options for `doc` collection
  },
  meta: {
    // options for `meta` collection
  },
});
```

The `docs` collection combines a `meta` and `doc` collection, which scans through all Markdown, MDX and JSON files under your `content/docs` directory.
They are needed for Fumadocs to work.

### Output Folder

Once you run `next dev` or `next build`, it generates a `.source` folder in root directory.

The folder contains all output data and its types, you should add it to `.gitignore`.

The `fumadocs-mdx` command generates types for `.source` folder without running Next.js, you can add it as a post install script to ensure types are always generated when initializing the project.

```json title="package.json"
{
  "scripts": {
    "postinstall": "fumadocs-mdx"
  }
}
```

### Accessing Collections

**Collection Output** is the generated data of a collection, it can have a different type/shape depending on the collection type and schema.

You can access the collection output from `.source` folder with its original name:

```ts
// source.config.ts
import { defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // options for `doc` collection
  },
  meta: {
    // options for `meta` collection
  },
});

// lib/source.ts
import { docs } from '@/.source';

console.log(docs);
```

In this guide, We will import the `.source` folder with `@/.source`, you can also change it to your own import alias.
Make sure you are importing from `.source` rather than `source.config.ts`.

To integrate with Fumadocs, you can use the `toFumadocsSource()` function of `docs` collection output.

```ts title="lib/source.ts"
import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
```

And for other types of collections, the output may different, you can also log them to see the differences.

### Start Server

```bash
next dev
```

A `.source` folder should be created. You can log and see if it is loaded correctly.

### Usage

Generally, you'll interact with Fumadocs MDX through the [Source](/docs/headless/source-api#output) object (output of `loader`).

```tsx
import { source } from '@/lib/source';

const page = source.getPage(['slugs']);

if (page) {
  // access page data [!code highlight]
  console.log(page.data);

  // frontmatter properties are also inside [!code highlight]
  console.log(page.data.title);
}
```

To render the page, use `page.data.body` as a component.

```tsx
import { getMDXComponents } from '@/mdx-components';

const MDX = page.data.body;

// set your MDX components with `components` prop
return <MDX components={getMDXComponents()} />;
```

## FAQ

### Built-in Properties

These properties are exported from MDX files by default.

| Property         | Description                                     |
| ---------------- | ----------------------------------------------- |
| `frontmatter`    | Frontmatter                                     |
| `toc`            | Table of Contents                               |
| `structuredData` | Structured Data, useful for implementing search |

### Customise Frontmatter

Use the [`schema`](/docs/mdx/collections#schema-1) option to pass a validation schema to validate frontmatter and define its output properties.

### Syntax Highlighting

Use [`rehypeCodeOptions`](/docs/mdx/mdx#rehype-plugins) on global or collection-level config.

### MDX Plugins

For other customisation needs, see [MDX Options](/docs/mdx/mdx).

### Multiple Collections

You can define more collections, see [Collections](/docs/mdx/collections) for available options.

```ts title="source.config.ts"
import { defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
});

export const blogPosts = defineDocs({
  dir: 'content/blog',
});
```

And use `loader` for a simple way to interact with collection output.

```ts title="lib/source.ts"
import { docs, blogPosts } from '@/.source';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

export const blog = loader({
  baseUrl: '/blog',
  source: blogPosts.toFumadocsSource(),
});
```


file: ./content/docs/mdx/last-modified.mdx
# Fumadocs MDX (the built-in content source): Last Modified Time

Output the last modified time of a document
        
## Usage

This feature is not enabled by default, you can enable this from config file. Notice that it only supports Git as version control.
Please ensure you have Git installed on your machine, and **the repository is not shallow cloned**, as it relies on your local Git history.

```ts title="source.config.ts"
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  lastModifiedTime: 'git', // [!code highlight]
});
```

### Access the Property

After doing this, a `lastModified` number will be exported for each document, you can convert it to a JavaScript Date object.

```ts
import { source } from '@/lib/source';

const page = source.getPage(['...']);

console.log(new Date(page.data.lastModified));
// or with async mode:
const { lastModified } = await page.data.load();
console.log(new Date(lastModified));
```


file: ./content/docs/mdx/mdx.mdx
# Fumadocs MDX (the built-in content source): MDX Options

Configure MDX processor for Fumadocs MDX
        
## Customising MDX Processor

Fumadocs MDX uses [MDX Compiler](https://mdxjs.com/packages/mdx) to compile MDX files into JavaScript files.

You can customise it on [Global Config](/docs/mdx/global#mdx-options) or [Collection Config](/docs/mdx/collections#mdxoptions).

## Extended MDX Options \[#extended]

Fumadocs MDX will apply some default MDX options, to make features like **syntax highlighting** work out of the box.

To allow overriding the defaults, Fumadocs MDX's `mdxOptions` option accepts **Extended MDX Options** on top of [`ProcessorOptions`](https://mdxjs.com/packages/mdx/#processoroptions).
You can see the additional options below:

### Remark Plugins

These plugins are applied by default:

* [Remark Image](/docs/headless/mdx/remark-image) - Handle images
* [Remark Heading](/docs/headless/mdx/headings) - Extract table of contents
* [Remark Structure](/docs/headless/mdx/structure) - Generate search indexes
* Remark Exports - Exports the output generated by remark plugins above

You can add other remark plugins with:

```ts tab="Global Config"
import { defineConfig } from 'fumadocs-mdx/config';
import { myPlugin } from './remark-plugin';

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [myPlugin],
    // You can also pass a function to control the order of remark plugins.
    remarkPlugins: (v) => [myPlugin, ...v],
  },
});
```

```ts tab="Collection Config"
import { defineCollections, getDefaultMDXOptions } from 'fumadocs-mdx/config';
import { myPlugin } from './remark-plugin';

export const blog = defineCollections({
  type: 'doc',
  mdxOptions: getDefaultMDXOptions({
    remarkPlugins: [myPlugin],
    // You can also pass a function to control the order of remark plugins.
    remarkPlugins: (v) => [myPlugin, ...v],
  }),
});
```

### Rehype Plugins

These plugins are applied by default:

* [Rehype Code](/docs/headless/mdx/rehype-code) - Syntax highlighting

Same as remark plugins, you can pass an array or a function to add other rehype plugins.

```ts tab="Global Config"
import { defineConfig } from 'fumadocs-mdx/config';
import { myPlugin } from './rehype-plugin';

export default defineConfig({
  mdxOptions: {
    rehypePlugins: (v) => [myPlugin, ...v],
  },
});
```

```ts tab="Collection Config"
import { defineCollections, getDefaultMDXOptions } from 'fumadocs-mdx/config';
import { myPlugin } from './rehype-plugin';

export const blog = defineCollections({
  type: 'doc',
  mdxOptions: getDefaultMDXOptions({
    rehypePlugins: (v) => [myPlugin, ...v],
  }),
});
```

### Customise Built-in Plugins

Customise the options of built-in plugins like:

```ts tab="Global Config"
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      // options
    },
    remarkImageOptions: {
      // options
    },
    remarkHeadingOptions: {
      // options
    },
  },
});
```

```ts tab="Collection Config"
import { defineCollections, getDefaultMDXOptions } from 'fumadocs-mdx/config';

export const blog = defineCollections({
  type: 'doc',
  mdxOptions: getDefaultMDXOptions({
    rehypeCodeOptions: {
      // options
    },
    remarkImageOptions: {
      // options
    },
    remarkHeadingOptions: {
      // options
    },
  }),
});
```

### Export Properties from `vfile.data`

Some remark plugins store their output in `vfile.data` (an compile-time memory) which cannot be accessed from your code.
Fumadocs MDX applies a remark plugin that turns `vfile.data` properties into ESM exports, so that you can access these properties when importing the MDX file.

You can define additional properties to be exported.

```ts tab="Global Config"
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    valueToExport: ['dataName'],
  },
});
```

```ts tab="Collection Config"
import { defineCollections, getDefaultMDXOptions } from 'fumadocs-mdx/config';

export const blog = defineCollections({
  type: 'doc',
  mdxOptions: getDefaultMDXOptions({
    valueToExport: ['dataName'],
  }),
});
```

By default, it includes:

* `toc` for the Remark Heading plugin
* `structuredData` for the Remark Structure Plugin
* `frontmatter` for the frontmatter of MDX (using `gray-matter`)


file: ./content/docs/mdx/performance.mdx
# Fumadocs MDX (the built-in content source): Performance

The performance of Fumadocs MDX
        
## Overview

Fumadocs MDX is a bundler plugin, in other words, it has a higher performance bottleneck.
With bundlers like Webpack and Turbopack, it is enough for large docs sites with nearly 500+ MDX files, which is sufficient for almost all use cases.

Since Fumadocs MDX works with your bundler, you can import any files including client components in your MDX files.
This allows a high flexibility and ensures everything is optimized by default.

### Image Optimization

Fumadocs MDX resolves images into static imports with [Remark Image](/docs/headless/mdx/remark-image).
Therefore, your images will be optimized automatically by the Next.js Image API.

```mdx
![Hello](./hello.png)

or in public folder

![Hello](/hello.png)
```

Yields:

```mdx
import HelloImage from './hello.png';

<img alt="Hello" src={HelloImage} />
```

![Banner](/banner.png)

## Caveats

Although Fumadocs MDX can handle nearly 500+ files, it could be slow and inefficient.
A huge amount of MDX files can cause an extremely high memory usage during build and development mode.

This is because of:

* Bundlers do a lot of work under the hood to bundle MDX and JavaScript files and optimize performance.
* Bundlers are not supposed to compile hundreds of MDX files.

### Solutions

The main solution is to make the compilation on-demand, such that content is only loaded when it's being requested.

#### Remote Source

Remote sources don't need to pre-compile MDX files, it can compile them on-demand with SSG which can **highly increase your build speed.**
However, you cannot use import in MDX files anymore.

See [Custom Source](/docs/headless/custom-source) for configuring remote sources.

#### Async Mode

See [Async Mode](/docs/mdx/async).


file: ./content/docs/mdx/plugin.mdx
# Fumadocs MDX (the built-in content source): Next.js Loader

Customise the Next.js loader
        
## Plugin Options

Fumadocs MDX offers loaders and a Fumadocs [Source API](/docs/headless/source-api) adapter to integrate with Fumadocs.
You can configure the plugin by passing options to `createMDX` in `next.config.mjs`.

### Config Path

Customise the path of config file.

```ts
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX({
  configPath: './my-config.ts',
});
```

### Development Server

When running in development mode (`next dev`), a file watcher will be started to watch for changes.
It automatically re-generates the index file in `.source` folder, ensuring Next.js hot reload is working properly.


file: ./content/docs/ui/comparisons.mdx
# Fumadocs Framework: Comparisons

How is Fumadocs different from other existing frameworks?
        
## Nextra

Fumadocs is highly inspired by Nextra. For example, the Routing Conventions. That is why
`meta.json` also exists in Fumadocs.

Nextra is more opinionated than Fumadocs. Fumadocs is accelerated by App Router. As a result, It provides many server-side functions, and you have to
configure things manually compared to simply editing a configuration file.

Fumadocs works great if you want more control over everything, such as
adding it to an existing codebase or implementing advanced routing.

### Feature Table

| Feature             | Fumadocs     | Nextra                    |
| ------------------- | ------------ | ------------------------- |
| Static Generation   | Yes          | Yes                       |
| Cached              | Yes          | Yes                       |
| Light/Dark Mode     | Yes          | Yes                       |
| Syntax Highlighting | Yes          | Yes                       |
| Table of Contents   | Yes          | Yes                       |
| Full-text Search    | Yes          | Yes                       |
| i18n                | Yes          | Yes                       |
| Last Git Edit Time  | Yes          | Yes                       |
| Page Icons          | Yes          | Yes, via `_meta.js` files |
| RSC                 | Yes          | Yes                       |
| Remote Source       | Yes          | Yes                       |
| SEO                 | Via Metadata | Yes                       |
| Built-in Components | Yes          | Yes                       |
| RTL Layout          | Yes          | Yes                       |

### Additional Features

Features supported via 3rd party libraries like [TypeDoc](https://typedoc.org) will not be listed here.

| Feature                    | Fumadocs | Nextra |
| -------------------------- | -------- | ------ |
| OpenAPI Integration        | Yes      | No     |
| TypeScript Docs Generation | Yes      | No     |
| TypeScript Twoslash        | Yes      | Yes    |

## Mintlify

Mintlify is a documentation service, as compared to Fumadocs, it offers a free tier but isn't completely free and open source.

Fumadocs is not as powerful as Mintlify, for example, the OpenAPI integration of Mintlify.
As the creator of Fumadocs, I wouldn't recommend switching to Fumadocs from Mintlify if you're satisfied with the current way you build docs.
However, I believe Fumadocs is a suitable tool for all Next.js developers who want to have elegant docs.

## Docusaurus

Docusaurus is a powerful framework based on React.js. It offers many cool
features with plugins and custom themes.

### Better DX

Since Fumadocs is built on the top of Next.js, you'll have to start the Next.js dev
server every time to review changes, and initial boilerplate code is relatively more
compared to Docusaurus.

For a simple docs, Docusaurus might be a better choice if you don't need any Next.js specific functionality.

However, when you want to use Next.js, or seek extra customizability like tuning default UI components, Fumadocs could be a better choice.

### Plugins

You can easily achieve many things with plugins, their ecosystem is indeed larger and maintained by many contributors.

In comparison, the flexibility of Fumadocs allows you to implement them on your own, it may take longer to tune it to your satisfaction.


file: ./content/docs/ui/customisation.mdx
# Fumadocs Framework: Overview

An overview of Fumadocs UI
        
## Architecture

<UiOverview />

|               |                                                         |
| ------------- | ------------------------------------------------------- |
| **Sidebar**   | Display site title and navigation elements.             |
| **Page Tree** | Passed by you, mainly rendered as the items of sidebar. |
| **Docs Page** | All content of the page.                                |
| **TOC**       | Navigation within the article.                          |

## Customisation

### Layouts

You can use the exposed options of different layouts:

<Cards>
  <Card title="Docs Layout" href="/docs/ui/layouts/docs">
    Layout for docs
  </Card>

  <Card title="Docs Page" href="/docs/ui/layouts/page">
    Layout for docs content
  </Card>

  <Card title="Notebook Layout" href="/docs/ui/layouts/notebook">
    A more compact version of Docs Layout
  </Card>

  <Card title="Home Layout" href="/docs/ui/layouts/home-layout">
    Layout for other pages
  </Card>
</Cards>

### Components

Fumadocs UI also offers styled components for interactive examples to enhance your docs, you can customise them with exposed props like `style` and `className`.

See [Components](/docs/ui/components).

### Design System

Since the design system is built on Tailwind CSS, you can customise it [with CSS Variables](/docs/ui/theme#colors).

### CLI

Fumadocs CLI is a tool that installs components to your codebase, similar to Shadcn UI.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli
    ```
  </Tab>
</Tabs>

Use it to install Fumadocs UI components:

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli add
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli add
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli add
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli add
    ```
  </Tab>
</Tabs>

Or customise layouts:

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npx @fumadocs/cli customise
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm dlx @fumadocs/cli customise
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dlx @fumadocs/cli customise
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun x @fumadocs/cli customise
    ```
  </Tab>
</Tabs>


file: ./content/docs/ui/index.mdx
# Fumadocs Framework: Quick Start

Getting Started with Fumadocs
        
## Introduction

Fumadocs <span className="text-fd-muted-foreground text-sm">(Foo-ma docs)</span> is a **documentation framework** based on Next.js, designed to be fast, flexible,
and composes seamlessly into Next.js App Router.

Fumadocs has different parts:

<Cards>
  <Card icon={<CpuIcon className="text-purple-300" />} title="Fumadocs Core">
    Handles most of the logic, including document search, content source adapters, and Markdown extensions.
  </Card>

  <Card icon={<PanelsTopLeft className="text-blue-300" />} title="Fumadocs UI">
    The default theme of Fumadocs offers a beautiful look for documentation sites and interactive components.
  </Card>

  <Card icon={<Database />} title="Content Source">
    The source of your content, can be a CMS or local data layers like [Fumadocs MDX](/docs/mdx) (the official content source).
  </Card>

  <Card icon={<Terminal />} title="Fumadocs CLI">
    A command line tool to install UI components and automate things, useful for customizing layouts.
  </Card>
</Cards>

<Callout title="Want to learn more?">
  Read our in-depth [What is Fumadocs](/docs/ui/what-is-fumadocs) introduction.
</Callout>

### Terminology

**Markdown/MDX:** Markdown is a markup language for creating formatted text. Fumadocs supports Markdown and MDX (superset of Markdown) out-of-the-box.

Although not required, some basic knowledge of Next.js App Router would be useful for further customisations.

## Automatic Installation

A minimum version of Node.js 18 required, note that Node.js 23.1 might have problems with Next.js production build.

<Tabs groupId="package-manager" persist items={['npm', 'pnpm', 'yarn', 'bun']}>
  ```bash tab="npm"
  npm create fumadocs-app
  ```

  ```bash tab="pnpm"
  pnpm create fumadocs-app
  ```

  ```bash tab="yarn"
  yarn create fumadocs-app
  ```

  ```bash tab="bun"
  bun create fumadocs-app
  ```
</Tabs>

It will ask you:

* the React.js framework to use (the docs is only written for Next.js).
* the content source to use.

A new fumadocs app should be initialized. Now you can start hacking!

<Callout title="From Existing Codebase?">
  You can follow the [Manual Installation](/docs/ui/manual-installation) guide to get started.
</Callout>

### Enjoy!

Create your first MDX file in the docs folder.

```mdx title="content/docs/index.mdx"
---
title: Hello World
---

## Yo what's up
```

Run the app in development mode and see [http://localhost:3000/docs](http://localhost:3000/docs).

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm run dev
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm run dev
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn dev
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun run dev
    ```
  </Tab>
</Tabs>

## Explore

In the project, you can see:

* `lib/source.ts`: Code for content source adapter, [`loader()`](/docs/headless/source-api) provides an interface to interact with your content source, and assigns URL to your pages.
* `app/layout.config.tsx`: Shared options for layouts, optional but preferred to keep.
* `mdx-components.tsx`: MDX components.

| Route                     | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `app/(home)`              | The route group for your landing page and other pages. |
| `app/docs`                | The documentation layout and pages.                    |
| `app/api/search/route.ts` | The Route Handler for search.                          |

### Writing Content

For authoring docs, make sure to read:

<Cards>
  <Card href="/docs/ui/markdown" title="Markdown">
    Fumadocs has some additional features for authoring content.
  </Card>

  <Card href="/docs/ui/navigation" title="Navigation">
    Learn how to customise navigation links and sidebar items.
  </Card>
</Cards>

### Content Source

Content source handles all your content, like compiling Markdown files and validating frontmatter.

<Tabs items={['Fumadocs MDX', 'Custom Source']}>
  <Tab value="Fumadocs MDX">
    A `source.config.ts` config file has been included, you can customise different options like frontmatter schema.

    Read the [Introduction](/docs/mdx) for further details.
  </Tab>

  <Tab value="Custom Source">
    Fumadocs is not Markdown-exclusive. For other sources like Sanity, you can build a [custom content source](/docs/headless/custom-source).
  </Tab>
</Tabs>

### Customise UI

See [Customisation Guide](/docs/ui/customisation).

## FAQ

Some common questions you may encounter.

<Accordions>
  <Accordion id="fix-monorepo-styling" title="How to fix stylings not being applied in Monorepo?">
    Sometimes, `fumadocs-ui` is not installed in the workspace of your Tailwind CSS configuration file. (e.g. a monorepo setup).

    You have to ensure the `fumadocs-ui` package is scanned by Tailwind CSS, and give a correct relative path to `@source`.

    For example, add `../../` to point to the `node_modules` folder in root workspace.

    ```css
    @import 'tailwindcss';
    @import 'fumadocs-ui/css/neutral.css';
    @import 'fumadocs-ui/css/preset.css';

    /* [!code --] */
    @source '../node_modules/fumadocs-ui/dist/**/*.js';
    /* [!code ++] */
    @source '../../../node_modules/fumadocs-ui/dist/**/*.js';
    ```
  </Accordion>

  <Accordion id="change-base-url" title="How to change the base route of /docs?">
    You can change the base route of docs (e.g. from `/docs/page` to `/info/page`).
    Since Fumadocs uses Next.js App Router, you can simply rename the route:

    <Files>
      <Folder name="app/docs" defaultOpen className="opacity-50" disabled>
        <File name="layout.tsx" />
      </Folder>

      <Folder name="app/info" defaultOpen>
        <File name="layout.tsx" />
      </Folder>
    </Files>

    And tell Fumadocs to use the new route in `source.ts`:

    ```ts title="lib/source.ts"
    import { loader } from 'fumadocs-core/source';

    export const source = loader({
      baseUrl: '/info',
      // other options
    });
    ```
  </Accordion>

  <Accordion id="dynamic-route" title="It uses Dynamic Route, will it be poor in performance?">
    Next.js turns dynamic route into static routes when `generateStaticParams` is configured.
    Hence, it is as fast as static pages.

    You can enable Static Exports on Next.js to get a static build output. (Notice that Route Handler doesn't work with static export, you have to configure static search)
  </Accordion>

  <Accordion id="custom-layout-docs-page" title="How to create a page in /docs without docs layout?">
    Same as managing layouts in Next.js App Router, remove the original MDX file from content directory (`/content/docs`).
    This ensures duplicated pages will not cause errors.

    Now, You can add the page to another route group, which isn't a descendant of docs layout.

    For example, under your `app` folder:

    <Files>
      <File name="(home)/docs/page.tsx" />

      <Folder name="docs">
        <File name="layout.tsx" />

        <File name="[[...slug]]/page.tsx" />
      </Folder>
    </Files>

    will replace the `/docs` page with your `page.tsx`.
  </Accordion>

  <Accordion id="multi-versions" title="How to implement docs with multi-version?">
    Use a separate deployment for each version.

    On Vercel, this can be done by creating another branch for a specific version on your GitHub repository.
    To link to the sites of other versions, use the Links API or a custom navigation component.
  </Accordion>

  <Accordion id="multi-docs" title="How to implement multi-docs?">
    We recommend to use [Sidebar Tabs](/docs/ui/navigation/sidebar#sidebar-tabs).
  </Accordion>
</Accordions>

## Learn More

New to here? Don't worry, we are welcome for your questions.

If you find anything confusing, please give your feedback on [Github Discussion](https://github.com/fuma-nama/fumadocs/discussions)!

<Cards>
  <Card href="/docs/ui/static-export" title="Configure Static Export" description="Learn how to enable static export on your docs" />

  <Card href="/docs/ui/search" title="Customise Search" description="Learn how to customise document search" />

  <Card href="/docs/ui/theme" title="Theming" description="Add themes to Fumadocs UI" />

  <Card href="/docs/ui/components" title="Components" description="See all available components to enhance your docs" />
</Cards>


file: ./content/docs/ui/internationalization.mdx
# Fumadocs Framework: Internationalization

Support multiple languages in your documentation
        
<Callout title="Before you get started">
  Fumadocs is not a full-powered i18n library, it manages only its own components and utilities.

  You can use other libraries like [next-intl](https://github.com/amannn/next-intl) for the rest of your app.
  Read the [Next.js Docs](https://nextjs.org/docs/app/building-your-application/routing/internationalization) to learn more about implementing I18n in Next.js.
</Callout>

## Manual Setup

Define the i18n configurations in a file, we will import it with `@/ilb/i18n` in this guide.

```ts title="lib/i18n.ts"
import type { I18nConfig } from 'fumadocs-core/i18n';

export const i18n: I18nConfig = {
  defaultLanguage: 'en',
  languages: ['en', 'cn'],
};

```

Pass it to the source loader.

```ts title="lib/source.ts"
import { i18n } from '@/lib/i18n';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  i18n, // [!code highlight]
  // other options
});
```

And update Fumadocs UI layout options.

```tsx title="app/layout.config.tsx"
import { i18n } from '@/lib/i18n';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    i18n,
    // different props based on `locale`
  };
}
```

### Middleware

Create a middleware that redirects users to appropriate locale.

```ts title="middleware.ts"
import { createI18nMiddleware } from 'fumadocs-core/i18n';
import { i18n } from '@/lib/i18n';

export default createI18nMiddleware(i18n);

export const config = {
  // Matcher ignoring `/_next/` and `/api/`
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

See [Middleware](/docs/headless/internationalization#middleware) for customisable options.

> Note that this is optional, you can also use your own middleware or the one provided by i18n libraries.

### Routing

Create a `/app/[lang]` folder, and move all files (e.g. `page.tsx`, `layout.tsx`) from `/app` to the folder.

Provide UI translations and other config to `<RootProvider />`.
Note that only English translations are provided by default.

```tsx title="app/[lang]/layout.tsx"
import { RootProvider } from 'fumadocs-ui/provider';
import type { Translations } from 'fumadocs-ui/i18n';

const cn: Partial<Translations> = {
  search: 'Translated Content',
  // other translations
};

// available languages that will be displayed on UI
// make sure `locale` is consistent with your i18n config
const locales = [
  {
    name: 'English',
    locale: 'en',
  },
  {
    name: 'Chinese',
    locale: 'cn',
  },
];

export default async function RootLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}) {
  const lang = (await params).lang;

  return (
    <html lang={lang}>
      <body>
        <RootProvider
          i18n={{
            locale: lang,
            // available languages
            locales,
            // translations for UI
            translations: { cn }[lang],
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
```

### Pass Locale

Pass the locale to Fumadocs in your pages and layouts.

```tsx title="/app/[lang]/(home)/layout.tsx" tab="Home Layout"
import type { ReactNode } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/app/layout.config';

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  return <HomeLayout {...baseOptions(lang)}>{children}</HomeLayout>;
}
```

```tsx title="/app/[lang]/docs/layout.tsx" tab="Docs Layout"
import type { ReactNode } from 'react';
import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/app/layout.config';

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  return (
    <DocsLayout {...baseOptions(lang)} tree={source.pageTree[lang]}>
      {children}
    </DocsLayout>
  );
}
```

```ts title="page.tsx" tab="Docs Page"
import { source } from '@/lib/source';

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>;
}) {
  const { slug, lang } = await params;
  // get page
  source.getPage(slug); // [!code --]
  source.getPage(slug, lang); // [!code ++]

  // get pages
  source.getPages(); // [!code --]
  source.getPages(lang); // [!code ++]
}
```

### Search

Configure i18n on your search solution.

* **Built-in Search (Orama):**
  For [Supported Languages](https://docs.orama.com/open-source/supported-languages#officially-supported-languages), no further changes are needed.

  Otherwise, additional config is required (e.g. Chinese & Japanese). See [Special Languages](/docs/headless/search/orama#special-languages).

* **Cloud Solutions (e.g. Algolia):**
  They usually have official support for multilingual.

## Writing Documents

You can add Markdown/meta files for different languages by attending `.{locale}` to your file name, like `page.fr.md` and `meta.fr.json`.

Make sure to create a file for the default locale first, the locale code is optional (e.g. both `get-started.mdx` and `get-started.en.mdx` are accepted).

<Files>
  <Folder name="content/docs" defaultOpen>
    <File name="meta.json" />

    <File name="meta.cn.json" />

    <File name="get-started.mdx" />

    <File name="get-started.cn.mdx" />
  </Folder>
</Files>

## Navigation

Fumadocs only handles navigation for its own layouts (e.g. sidebar).
For other places, you can use the `useParams` hook to get the locale from url, and attend it to `href`.

```tsx
import Link from 'next/link';
import { useParams } from 'next/navigation';

const { lang } = useParams();

return <Link href={`/${lang}/another-page`}>This is a link</Link>;
```

In addition, the [`fumadocs-core/dynamic-link`](/docs/headless/components/link#dynamic-hrefs) component supports dynamic hrefs, you can use it to attend the locale prefix.
It is useful for Markdown/MDX content.

```mdx title="content.mdx"
import { DynamicLink } from 'fumadocs-core/dynamic-link';

<DynamicLink href="/[lang]/another-page">This is a link</DynamicLink>
```


file: ./content/docs/ui/manual-installation.mdx
# Fumadocs Framework: Manual Installation

Create a new fumadocs project from scratch.
        
> Read the [Quick Start](/docs/ui) guide first for basic concept.

## Getting Started

Create a new Next.js application with `create-next-app`, and install required packages.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install fumadocs-ui fumadocs-core
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add fumadocs-ui fumadocs-core
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add fumadocs-ui fumadocs-core
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add fumadocs-ui fumadocs-core
    ```
  </Tab>
</Tabs>

### MDX Components

```tsx title="mdx-components.tsx"
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}

```

### Content Source

Fumadocs supports different content sources, you can choose one you prefer.

There is a list of officially supported sources:

* [Setup Fumadocs MDX](/docs/mdx)
* [Setup Content Collections](/docs/headless/content-collections)

Make sure to configure the library correctly following their setup guide before continuing, we will import the source adapter using `@/lib/source.ts` in this guide.

### Root Layout

Wrap the entire application inside [Root Provider](/docs/ui/layouts/root-provider), and add required styles to `body`.

```tsx
import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        // you can use Tailwind CSS too
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
```

### Styles

Setup Tailwind CSS v4 on your Next.js app, add the following to `global.css`.

```css title="Tailwind CSS"
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';

/* path of `fumadocs-ui` relative to the CSS file */
@source '../node_modules/fumadocs-ui/dist/**/*.js';
```

> It doesn't come with a default font, you may choose one from `next/font`.

### Layout

Create a `app/layout.config.tsx` file to put the shared options for our layouts.

```tsx title="app/layout.config.tsx"
import { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: 'My App',
  },
};
```

Create a folder `/app/docs` for our docs, and give it a proper layout.

```tsx title="app/docs/layout.tsx"
import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}
```

> `pageTree` refers to Page Tree, it should be provided by your content source.

### Page

Create a catch-all route `/app/docs/[[...slug]]` for docs pages.

In the page, wrap your content in the [Page](/docs/ui/layouts/page) component.
It may vary depending on your content source. You should configure static rendering with `generateStaticParams` and metadata with `generateMetadata`.

<Tabs groupId="content-source" items={['Fumadocs MDX', 'Content Collections']}>
  ```tsx title="app/docs/\[\[...slug]]/page.tsx" tab="Fumadocs MDX"
  import { source } from '@/lib/source';
  import {
    DocsPage,
    DocsBody,
    DocsTitle,
    DocsDescription,
  } from 'fumadocs-ui/page';
  import { notFound } from 'next/navigation';
  import { metadataImage } from '@/lib/metadata';
  import { getMDXComponents } from '@/mdx-components';

  export default async function Page(props: {
    params: Promise<{ slug?: string[] }>;
  }) {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();

    const MDX = page.data.body;

    return (
      <DocsPage toc={page.data.toc} full={page.data.full}>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDX components={getMDXComponents()} />
        </DocsBody>
      </DocsPage>
    );
  }

  export async function generateStaticParams() {
    return source.generateParams();
  }

  export async function generateMetadata(props: {
    params: Promise<{ slug?: string[] }>;
  }) {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();

    return metadataImage.withImage(page.slugs, {
      title: page.data.title,
      description: page.data.description,
    });
  }

  ```

  ```tsx title="app/docs/\[\[...slug]]/page.tsx" tab="Content Collections"
  import { source } from '@/lib/source';
  import type { Metadata } from 'next';
  import {
    DocsPage,
    DocsBody,
    DocsTitle,
    DocsDescription,
  } from 'fumadocs-ui/page';
  import { notFound } from 'next/navigation';
  import { MDXContent } from '@content-collections/mdx/react';
  import { getMDXComponents } from '@/mdx-components';

  export default async function Page(props: {
    params: Promise<{ slug?: string[] }>;
  }) {
    const params = await props.params;
    const page = source.getPage(params.slug);

    if (!page) {
      notFound();
    }

    return (
      <DocsPage toc={page.data.toc} full={page.data.full}>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDXContent code={page.data.body} components={getMDXComponents()} />
        </DocsBody>
      </DocsPage>
    );
  }

  export async function generateStaticParams() {
    return source.generateParams();
  }

  export async function generateMetadata(props: {
    params: Promise<{ slug?: string[] }>;
  }) {
    const params = await props.params;
    const page = source.getPage(params.slug);

    if (!page) notFound();

    return {
      title: page.data.title,
      description: page.data.description,
    } satisfies Metadata;
  }

  ```
</Tabs>

### Search

Use the default document search based on Orama.

```ts title="app/api/search/route.ts"
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source);

```

Learn more about [Document Search](/docs/headless/search).

### Done

You can start the dev server and create MDX files.

```mdx title="content/docs/index.mdx"
---
title: Hello World
---

## Introduction

I love Anime.
```

## Deploying

It should work out-of-the-box with Vercel & Netlify.

### Docker Deployment

If you want to deploy your Fumadocs app using Docker with **Fumadocs MDX configured**, make sure to add the `source.config.ts` file to the `WORKDIR` in the Dockerfile.
The following snippet is taken from the official [Next.js Dockerfile Example](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile):

```zsh title="Dockerfile"
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* source.config.ts ./
```

This ensures Fumadocs MDX can access your configuration file during builds.


file: ./content/docs/ui/markdown.mdx
# Fumadocs Framework: Markdown

How to write documents
        
## Introduction

Fumadocs provides many useful extensions to MDX, a markup language. Here is a brief introduction to the default MDX syntax of Fumadocs UI.

> MDX is not the only supported format of Fumadocs. In fact, you can use any renderers such as `next-mdx-remote` or CMS.

## Markdown

We use GFM (GitHub Flavored Markdown), a superset of Markdown (CommonMark).
See [GFM Specification](https://github.github.com/gfm).

````md
# Heading

## Heading

### Heading

#### Heading

Hello World, **Bold**, _Italic_, ~~Hidden~~

```js
console.log('Hello World');
```

1. First
2. Second
3. Third

- Item 1
- Item 2

> Quote here

![alt](/image.png)

| Table | Description |
| ----- | ----------- |
| Hello | World       |
````

### Images

Images are automatically optimized for `next/image`.

```mdx
![Image](/image.png)
```

### Auto Links

Internal links use the `next/link` component to allow prefetching and avoid hard-reload.

External links will get the default `rel="noreferrer noopener" target="_blank"` attributes for security.

```mdx
[My Link](https://github.github.com/gfm)

This also works: https://github.github.com/gfm.
```

## MDX

MDX is a superset of Markdown, with support of JSX syntax.
It allows you to import components, and use them right in the document, or even export values.

```mdx
import { Component } from './component';

<Component name="Hello" />
```

see [MDX Syntax](https://mdxjs.com/docs/what-is-mdx/#mdx-syntax) to learn more.

### Cards

Useful for adding links, it is included by default.

```mdx
<Cards>
  <Card
    href="https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating"
    title="Fetching, Caching, and Revalidating"
  >
    Learn more about caching in Next.js
  </Card>
  <Card title="href is optional">Learn more about `fetch` in Next.js.</Card>
</Cards>
```

<Cards>
  <Card href="https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating" title="Fetching, Caching, and Revalidating">
    Learn more about caching in Next.js
  </Card>

  <Card title="href is optional">Learn more about `fetch` in Next.js.</Card>
</Cards>

#### Icon

You can specify an icon to cards.

```mdx
import { HomeIcon } from 'lucide-react';

<Cards>
  <Card icon={<HomeIcon />} href="/" title="Home">
    Go back to home
  </Card>
</Cards>
```

<Cards>
  <Card icon={<HomeIcon />} href="/" title="Go back to home">
    The home page of Fumadocs.
  </Card>
</Cards>

#### "Further Reading" Section

You can do something like:

```tsx title="page.tsx"
import { getPageTreePeers } from 'fumadocs-core/server';
import { source } from '@/lib/source';

<Cards>
  {getPageTreePeers(source.pageTree, '/docs/my-page').map((peer) => (
    <Card key={peer.url} title={peer.name} href={peer.url}>
      {peer.description}
    </Card>
  ))}
</Cards>;
```

This will show the other pages in the same folder as cards.

<DocsCategory url="/docs/ui/navigation" />

### Callouts

Useful for adding tips/warnings, it is included by default.

```mdx
<Callout>Hello World</Callout>

<Callout title="Title">Hello World</Callout>
```

<Callout>Hello World</Callout>

<Callout title="Title">Hello World</Callout>

#### Types

You can specify the type of callout.

* `info` (default)
* `warn`
* `error`

```mdx
<Callout title="Title" type="error">
  Hello World
</Callout>
```

<Callout title="Title" type="error">
  Hello World
</Callout>

## Headings

An anchor is automatically applied to each heading, it sanitizes invalid characters like spaces. (e.g. `Hello World` to `hello-world`)

```md
# Hello `World`
```

### TOC Settings

The table of contents (TOC) will be generated based on headings, you can also customise the effects of headings:

```md
# Heading [!toc]

This heading will be hidden from TOC.

# Another Heading [toc]

This heading will **only** be visible in TOC, you can use it to add additional TOC items.
Like headings rendered in a React component:

<MyComp />
```

### Custom Anchor

You can add `[#slug]` to customise heading anchors.

```md
# heading [#my-heading-id]
```

You can also chain it with TOC settings like:

```md
# heading [toc] [#my-heading-id]
```

To link people to a specific heading, add the heading id to hash fragment: `/page#my-heading-id`.

## Frontmatter

We support YAML frontmatter. It is a way to specify common information of the document (e.g. title).
Place it at the top of document.

```mdx
---
title: Hello World
---

## Title
```

See [Page Conventions](/docs/ui/page-conventions#frontmatter) for a list of properties available for frontmatter.

## Codeblock

Syntax Highlighting is supported by default using [Rehype Code](/docs/headless/mdx/rehype-code).

````mdx
```js
console.log('Hello World');
```
````

You can add a title to the codeblock.

````mdx
```js title="My Title"
console.log('Hello World');
```
````

### Highlight Lines

You can highlight specific lines by adding `[!code highlight]`.

````md
```tsx
<div>Hello World</div>  // [\!code highlight]
<div>Hello World</div>
<div>Goodbye</div>
<div>Hello World</div>
```
````

### Highlight Words

You can highlight a specific word by adding `[!code word:<match>]`.

````md
```js
// [\!code word:config]
const config = {
  reactStrictMode: true,
};
```
````

### Diffs

````mdx
```ts
console.log('hewwo'); // [\!code --]
console.log('hello'); // [\!code ++]
```
````

```ts
console.log('hewwo'); // [!code --]
console.log('hello'); // [!code ++]
```

### Tab Groups

You can use code blocks with the `<Tab />` component.

````mdx
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';

```ts tab="Tab 1"
console.log('A');
```

```ts tab="Tab 2"
console.log('B');
```
````

> Note that you can add MDX components instead of importing them in MDX files.

```ts tab="Tab 1"
console.log('A');
```

```ts tab="Tab 2"
console.log('B');
```

### Using Typescript Twoslash

Write Typescript codeblocks with hover type information and detected types errors.

Not enabled by default. See [Twoslash](/docs/ui/twoslash).

## Optional

Some optional plugins you can enable.

### Math Equations

Write math equations with TeX.

````md
```math
f(x) = x * e^{2 pi i \xi x}
```
````

```math
f(x) = x * e^{2 pi i \xi x}
```

To enable, see [Math Integration](/docs/ui/math).

### Package Install

Generate code blocks for installing packages via package managers (JS/Node.js).

````md
```package-install
npm i next -D
```
````

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm i next -D
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add next -D
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add next --dev
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add next --dev
    ```
  </Tab>
</Tabs>

To enable, see [Remark Install](/docs/headless/mdx/install).

### More

You can see [a list of plugins](/docs/headless/mdx) provided by Fumadocs.


file: ./content/docs/ui/page-conventions.mdx
# Fumadocs Framework: Organizing Pages

A shared convention for organizing your documents
        
## Overview

Page slugs and sidebar items (page tree) are generated from your file structure, similar to file-system based routing in Next.js.

> This only applies for file-system based content sources, such as Fumadocs MDX.

## File

A [MDX](https://mdxjs.com) or Markdown file.

### Frontmatter

By default, it includes:

| name          | description                                        |
| ------------- | -------------------------------------------------- |
| `title`       | The title of page                                  |
| `description` | The description of page                            |
| `icon`        | The name of icon, see [Icons](#icons)              |
| `full`        | Fill all available space on the page (Fumadocs UI) |

You may extend your content source to add additional properties.

```mdx
---
title: My Page
description: Best document ever
icon: HomeIcon
full: false
---

## Learn More
```

### Slugs

The generated slugs will be same as your file path.

| path (relative to content folder) | slugs             |
| --------------------------------- | ----------------- |
| `./dir/page.mdx`                  | `['dir', 'page']` |
| `./dir/index.mdx`                 | `['dir']`         |

## Folder

Organize multiple pages. When not specified, the display name will be generated from its folder name.

Pages are sorted alphabetically, except `index.mdx` which is always ordered at the top.

To customise folders, use [Meta file](#meta).

### Folder Group

By default, putting a file into folder will change its slugs and generated page URL.
You can use folder group to add a folder without impacting the slugs of child files.

To create a folder group, wrap the folder name in parentheses.

<Files>
  <Folder name="(group-name)" defaultOpen>
    <File name="file.mdx" />
  </Folder>
</Files>

## Meta

Customize a folder by creating a `meta.json` file in a folder under content folder.

### Display Name

```json title="meta.json"
{
  "title": "Name of Folder"
}
```

### Icon

Specify an icon name for folder with the `icon` property, see [Icons](#icons).

```json title="meta.json"
{
  "title": "My Folder",
  "icon": "MyIcon"
}
```

### Pages

Control the order of items.

When a meta file is present, items are not included unless you have explicitly added them to `pages`.

```json title="meta.json"
{
  "title": "Name of Folder",
  "pages": ["guide", "components"]
}
```

<Files>
  <File name="meta.json" />

  <File name="guide.mdx" />

  <File name="components.mdx" />
</Files>

### Path

The items of `pages` can also be a relative path to a page or folder, no file extensions needed.

```json title="meta.json"
{
  "title": "Name of Folder",
  "pages": ["../headless/page"]
}
```

### Open by Default

Force to open the folder by default.

```json title="meta.json"
{
  "title": "Name of Folder",
  "defaultOpen": true
}
```

### Separator

You can define a separator in meta by adding a item surrounded with `---`.

```json title="meta.json"
{
  "title": "Name of Folder",
  "pages": ["---Separator---"]
}
```

### Rest

Add a Rest (`...`) item to automatically add and sort remaining page items alphabetically.

<Callout title="Note">
  Index pages won't be included, you must specify the order of `index`.
</Callout>

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["guide", "..."]
}
```

You can also sort items reversely.

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["guide", "z...a"]
}
```

### Except

In conjunction with the Rest item (`...`), you can use `!name` to exclude an item from the rest.

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["...", "!hide-this-page"]
}
```

### Extract

You can extract the items from a folder with `...folder_name`.

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["guide", "...folder"]
}
```

### Link

Use the syntax `[Text](url)` to insert links.

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["index", "[Vercel](https://vercel.com)"]
}
```

You can add an icon too.

```json title="meta.json"
{
  "title": "Folder",
  "pages": ["index", "[Triangle][Vercel](https://vercel.com)"]
}
```

## Icons

Since Fumadocs doesn't include an icon library, you have to convert the icon names to JSX elements in runtime, and render it as a component.

You can add an [`icon` handler](/docs/headless/source-api#icons) to `loader()`.

## Root Folder

Marks the folder as a root folder.

<Callout title="Fumadocs UI">
  Fumadocs UI renders root folders as [Sidebar Tabs](/docs/ui/navigation/sidebar#sidebar-tabs), which allows user to switch between them.
</Callout>

```json title="meta.json"
{
  "title": "Name of Folder",
  "description": "The description of root folder (optional)",
  "root": true
}
```

Only items in the current root folder will be considered.

For example, when you are in a root folder called `framework`, the other folders (e.g. `headless`) are not shown on the sidebar and other navigation elements.

<Files>
  <Folder name="framework" defaultOpen>
    <File name="Current Page" className="!text-fd-primary !bg-fd-primary/10" />

    <File name="Other Pages" />
  </Folder>

  <Folder name="headless" className="opacity-50" disabled defaultOpen>
    <File name="Invisible Page" />
  </Folder>
</Files>

### Index Pages

By default, index pages are not considered as the child item of a folder, you must specify them in the `pages` property.

## Internationalization

You can add Markdown/meta files for different languages by attending `.{locale}` to your file name, like `page.fr.md` and `meta.fr.json`.

Make sure to create a file for the default locale first, the locale code is optional (e.g. both `get-started.mdx` and `get-started.en.mdx` are accepted).

<Files>
  <Folder name="content/docs" defaultOpen>
    <File name="meta.json" />

    <File name="meta.cn.json" />

    <File name="get-started.mdx" />

    <File name="get-started.cn.mdx" />
  </Folder>
</Files>


file: ./content/docs/ui/search.mdx
# Fumadocs Framework: Search

Implement document search in your docs
        
Fumadocs UI provides a good-looking search UI for your docs, the search functionality is instead provided and documented on Fumadocs Core.

See [Document Search](/docs/headless/search).

## Search UI

Open with <kbd>⌘</kbd> <kbd>K</kbd> or <kbd>Ctrl</kbd> <kbd>K</kbd>.

### Configurations

You can customize search UI from the [Root Provider](/docs/ui/layouts/root-provider) component in root layout.

When not specified, it uses the Default [`fetch` Search Client](/docs/headless/search/orama) powered by Orama.

### Custom Links

Add custom link items to search dialog.
They are shown as fallbacks when the query is empty.

```tsx title="app/layout.tsx"
import { RootProvider } from 'fumadocs-ui/root-provider';

<RootProvider
  search={{
    links: [
      ['Home', '/'],
      ['Docs', '/docs'],
    ],
  }}
>
  {children}
</RootProvider>;
```

### Disable Search

To opt-out of document search, disable it from root provider.

```tsx
import { RootProvider } from 'fumadocs-ui/root-provider';

<RootProvider
  search={{
    enabled: false,
  }}
>
  {children}
</RootProvider>;
```

### Hot Keys

Customise the hot keys to trigger search dialog.

```tsx
import { RootProvider } from 'fumadocs-ui/root-provider';

<RootProvider
  search={{
    hotKey: [
      {
        display: 'K',
        key: 'k', // key code, or a function determining whether the key is pressed
      },
    ],
  }}
>
  {children}
</RootProvider>;
```

### Tag Filter

Add UI to change filters.
Make sure to configure [Tag Filter](/docs/headless/search/orama#tag-filter) on search server first.

```tsx
import { RootProvider } from 'fumadocs-ui/root-provider';

<RootProvider
  search={{
    options: {
      defaultTag: 'value',
      tags: [
        {
          name: 'Tag Name',
          value: 'value',
        },
      ],
    },
  }}
>
  {children}
</RootProvider>;
```

### Search Options

Pass options to the search client, like changing the API endpoint for Orama search server:

```tsx
import { RootProvider } from 'fumadocs-ui/root-provider';

<RootProvider
  search={{
    options: {
      api: '/api/search/docs',
    },
  }}
>
  {children}
</RootProvider>;
```

### Replace Search Dialog

You can replace the default Search Dialog with:

```tsx title="components/search.tsx"
'use client';
import SearchDialog from 'fumadocs-ui/components/dialog/search-default';
import type { SharedProps } from 'fumadocs-ui/components/dialog/search';

export default function CustomDialog(props: SharedProps) {
  // your own logic here
  return <SearchDialog {...props} />;
}
```

To pass it to the Root Provider, you need a wrapper with `use client` directive.

```tsx title="provider.tsx"
'use client';
import { RootProvider } from 'fumadocs-ui/provider';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const SearchDialog = dynamic(() => import('@/components/search')); // lazy load

export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{
        SearchDialog,
      }}
    >
      {children}
    </RootProvider>
  );
}
```

Use it instead of your previous Root Provider

```tsx title="layout.tsx"
import { Provider } from './provider';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
```

## Other Solutions

### Algolia

For the setup guide, see [Integrate Algolia Search](/docs/headless/search/algolia).

While generally we recommend building your own search with their client-side
SDK, you can also plug the built-in dialog interface.

```tsx title="components/search.tsx"
'use client';
import algo from 'algoliasearch/lite';
import type { SharedProps } from 'fumadocs-ui/components/dialog/search';
import SearchDialog from 'fumadocs-ui/components/dialog/search-algolia';

const client = algo('appId', 'apiKey');
const index = client.initIndex('indexName');

export default function CustomSearchDialog(props: SharedProps) {
  return <SearchDialog index={index} {...props} />;
}
```

1. Replace `appId`, `apiKey` and `indexName` with your desired values.

2. [Replace the default search dialog](#replace-search-dialog) with your new component.

<Callout title="Note" className="mt-4">
  The built-in implementation doesn't use instant search (their official
  javascript client).
</Callout>

#### Tag Filter

Same as default search client, you can configure [Tag Filter](/docs/headless/search/algolia#tag-filter) on the dialog.

```tsx title="components/search.tsx"
import SearchDialog from 'fumadocs-ui/components/dialog/search-algolia';

<SearchDialog
  defaultTag="value"
  tags={[
    {
      name: 'Tag Name',
      value: 'value',
    },
  ]}
/>;
```

### Orama Cloud

For the setup guide, see [Integrate Orama Cloud](/docs/headless/search/orama-cloud).

```tsx title="components/search.tsx"
'use client';

import { OramaClient } from '@oramacloud/client';
import type { SharedProps } from 'fumadocs-ui/components/dialog/search';
import SearchDialog from 'fumadocs-ui/components/dialog/search-orama';

const client = new OramaClient({
  endpoint: 'endpoint',
  api_key: 'apiKey',
});

export default function CustomSearchDialog(props: SharedProps) {
  return <SearchDialog {...props} client={client} showOrama />;
}
```

1. Replace `endpoint`, `apiKey` with your desired values.
2. [Replace the default search dialog](#replace-search-dialog) with your new component.

### Community Integrations

A list of integrations maintained by community.

* [Trieve Search](/docs/headless/search/trieve)

## Built-in UI

If you want to use the built-in search dialog UI instead of building your own,
you may use the `SearchDialog` component.

```tsx
import {
  SearchDialog,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';

export default function CustomSearchDialog(props: SharedProps) {
  return <SearchDialog {...props} />;
}
```

<Callout type="warn" title="Unstable">
  It is an internal API, might break during iterations
</Callout>


file: ./content/docs/ui/static-export.mdx
# Fumadocs Framework: Static Export

Enable static export with Fumadocs
        
## Overview

Fumadocs is fully compatible with Next.js static export, allowing you to export the app as a static HTML site without a Node.js server.

```js title="next.config.mjs"
/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: 'export',
};
```

## Search

### Cloud Solutions

Since the search functionality is powered by remote servers, static export works without configuration.

### Built-in Search

The default search config of Orama Search uses route handlers, which is not supported by static export.

Instead, you can build the search indexes statically following the [Orama Search](/docs/headless/search/orama#static-export) guide.
And enable static mode on search client from Root Provider:

```tsx title="app/layout.tsx"
import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider
          search={{
            options: {
              type: 'static', // [!code highlight]
            },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
```

This allows the route handler to be statically cached into a single file, and search will be computed on browser instead.


file: ./content/docs/ui/theme.mdx
# Fumadocs Framework: Themes

Add Theme to Fumadocs UI
        
## Usage

Note only Tailwind CSS v4 is supported:

```css title="Tailwind CSS"
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';

/* path of `fumadocs-ui` relative to the CSS file */
@source '../node_modules/fumadocs-ui/dist/**/*.js';
```

### Preflight Changes

By using the Tailwind CSS plugin, or the pre-built stylesheet, your default border, text and background
colors will be changed.

### Light/Dark Modes

Fumadocs supports light/dark modes with [`next-themes`](https://github.com/pacocoursey/next-themes), it is included in Root Provider.

See [Root Provider](/docs/ui/layouts/root-provider#theme-provider) to learn more.

### RTL Layout

RTL (Right-to-left) layout is supported.

To enable RTL, set the `dir` prop to `rtl` in body and root provider (required for Radix UI).

```tsx
import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body dir="rtl">
        <RootProvider dir="rtl">{children}</RootProvider>
      </body>
    </html>
  );
}
```

### Prefix

Fumadocs UI has its own colors, animations, and utilities.
By default, it adds a `fd-` prefix to avoid conflicts with Shadcn UI or your own CSS variables.

You can use them without the prefix by adding some aliases:

```css title="Tailwind CSS"
@theme {
  --color-primary: var(--color-fd-primary);
}
```

> You can use it with CSS media queries for responsive design.

### Layout Width

Customise the max width of docs layout with CSS Variables.

```css
:root {
  --fd-layout-width: 1400px;
}
```

<WidthTrigger />

## Tailwind CSS Preset

The Tailwind CSS preset introduces new colors and extra utilities including `fd-steps`.

### Themes

It comes with many themes out-of-the-box, you can pick one you prefer.

```css
@import 'fumadocs-ui/css/<theme>.css';

/* Example */
@import 'fumadocs-ui/css/black.css';
```

<Tabs items={['neutral', 'black', 'vitepress', 'dusk', 'catppuccin', 'ocean', 'purple']}>
  <Tab value="neutral">
    ![Neutral](/themes/neutral.png)
  </Tab>

  <Tab value="black">
    ![Black](/themes/black.png)
  </Tab>

  <Tab value="vitepress">
    ![Vitepress](/themes/vitepress.png)
  </Tab>

  <Tab value="dusk">
    ![Dusk](/themes/dusk.png)
  </Tab>

  <Tab value="Catppuccin">
    ![Catppuccin](/themes/catppuccin.png)
  </Tab>

  <Tab value="ocean">
    ![Ocean](/themes/ocean.png)
  </Tab>

  <Tab value="purple">
    ![Purple](/themes/purple.png)
  </Tab>
</Tabs>

### Colors

The design system was inspired by [Shadcn UI](https://ui.shadcn.com), you can easily customize the colors using CSS variables.

```css title="global.css"
:root {
  --color-fd-background: hsl(0, 0%, 100%);
}

.dark {
  --color-fd-background: hsl(0, 0%, 0%);
}
```

### Typography

We have a built-in plugin forked from [Tailwind CSS Typography](https://tailwindcss.com/docs/typography-plugin).

The plugin adds a `prose` class and variants to customise it.

```tsx
<div className="prose">
  <h1>Good Heading</h1>
</div>
```

> The plugin works with and only with Fumadocs UI's MDX components, it may conflict with `@tailwindcss/typography`.
> If you need to use `@tailwindcss/typography` over the default plugin, [set a class name option](https://github.com/tailwindlabs/tailwindcss-typography/blob/main/README.md#changing-the-default-class-name) to avoid conflicts.


file: ./content/docs/ui/what-is-fumadocs.mdx
# Fumadocs Framework: What is Fumadocs

Introducing Fumadocs, a docs framework that you can break.
        
Fumadocs was created because I wanted a more customisable experience for building docs, to be a docs framework that is not opinionated, **a "framework" that you can break**.

## Philosophy

**Less Abstraction:** Fumadocs expects you to write code and cooperate with the rest of your software.
While most frameworks are configured with a configuration file, they usually lack flexibility when you hope to tune its details.
You can’t control how they render the page nor the internal logic. Fumadocs shows you how the app works, instead of a single configuration file.

**Next.js Fundamentals:** It gives you the utilities and a good-looking UI.
You are still using features of Next.js App Router, like **Static Site Generation**. There is nothing new for Next.js developers, so you can use it with confidence.

**Opinionated on UI:** The only thing Fumadocs UI (the default theme) offers is **User Interface**. The UI is opinionated for bringing better mobile responsiveness and user experience.
Instead, we use a much more flexible approach inspired by Shadcn UI — [Fumadocs CLI](/docs/cli), so we can iterate our design quick, and welcome for more feedback about the UI.

## Why Fumadocs

Fumadocs is designed with flexibility in mind.

You can use `fumadocs-core` as a headless UI library and bring your own styles.
Fumadocs MDX is also a useful library to handle MDX content in Next.js. It also includes:

* Many built-in components.
* Typescript Twoslash, OpenAPI, and Math (KaTeX) integrations.
* Fast and optimized by default, natively built on App Router.
* Tight integration with Next.js, you can add it to an existing Next.js project easily.

You can read [Comparisons](/docs/ui/comparisons) if you're interested.

### Documentation

Fumadocs focuses on **authoring experience**, it provides a beautiful theme and many docs automation tools.

It helps you to iterate your codebase faster while never leaving your docs behind.
You can take this site as an example of docs site built with Fumadocs.

### Blog sites

Since Next.js is already a powerful framework, most features can be implemented with **just Next.js**.

Fumadocs provides additional tooling for Next.js, including syntax highlighting, document search, and a default theme (Fumadocs UI).
It helps you to avoid reinventing the wheels.

## When to use Fumadocs

For most of the web applications, vanilla React.js is no longer enough.
Nowadays, we also wish to have a blog, a showcase page, a FAQ page, etc. With a
fancy UI that's breathtaking, in these cases, Fumadocs can help you build the
docs easier, with less boilerplate.

Fumadocs is maintained by Fuma and many contributors, with care on the maintainability of codebase.
While we don't aim to offer every functionality people wanted, we're more focused on making basic features perfect and well-maintained.
You can also help Fumadocs to be more useful by contributing!


file: ./content/docs/headless/components/breadcrumb.mdx
# Fumadocs Core (core library of framework): Breadcrumb

The navigation component at the top of screen
        
A hook for implementing Breadcrumb in your documentation, it returns the path to
a page based on the given page tree.

> If present, the index page of a folder will be used as the item

## Usage

it exports a `useBreadcrumb` hook:

```ts twoslash
declare const tree: any;
// ---cut---
import { usePathname } from 'next/navigation';
import { useBreadcrumb } from 'fumadocs-core/breadcrumb';

const pathname = usePathname();
const items = useBreadcrumb(pathname, tree);
//    ^?
```

### Example

A styled example.

```tsx
'use client';
import { usePathname } from 'next/navigation';
import { useBreadcrumb } from 'fumadocs-core/breadcrumb';
import type { PageTree } from 'fumadocs-core/server';
import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function Breadcrumb({ tree }: { tree: PageTree.Root }) {
  const pathname = usePathname();
  const items = useBreadcrumb(pathname, tree);

  if (items.length === 0) return null;

  return (
    <div className="-mb-3 flex flex-row items-center gap-1 text-sm font-medium text-fd-muted-foreground">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i !== 0 && (
            <ChevronRight className="size-4 shrink-0 rtl:rotate-180" />
          )}
          {item.url ? (
            <Link
              href={item.url}
              className="truncate hover:text-fd-accent-foreground"
            >
              {item.name}
            </Link>
          ) : (
            <span className="truncate">{item.name}</span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
```

You can use it by passing the page tree via `tree` in a server component.

### Breadcrumb Item

<AutoTypeTable path="./content/docs/headless/props.ts" name="BreadcrumbItem" />


file: ./content/docs/headless/components/index.mdx
# Fumadocs Core (core library of framework): Components

Blocks for your docs
        


file: ./content/docs/headless/components/link.mdx
# Fumadocs Core (core library of framework): Link

A Link component that handles external links
        
A component that wraps `next/link` and handles external links in the document.
When an external URL is detected, it uses `<a>` instead of the Next.js Link
Component. `rel` property is automatically generated.

## Usage

Same as using `<a>`.

```mdx
import Link from 'fumadocs-core/link';

<Link href="/docs/components">Click Me</Link>
```

### External

You can force an URL to be external by passing an `external` prop.

### Dynamic hrefs

Dynamic hrefs are no longer supported in Next.js App Router. You can enable
dynamic hrefs by importing `dynamic-link` instead.

```mdx
import { DynamicLink } from 'fumadocs-core/dynamic-link';

<DynamicLink href="/[lang]/components">Click Me</DynamicLink>
```


file: ./content/docs/headless/components/sidebar.mdx
# Fumadocs Core (core library of framework): Sidebar

The navigation bar at aside of viewport
        
A sidebar component which handles device resizing and remove scroll bar
automatically.

## Usage

```tsx
import * as Base from 'fumadocs-core/sidebar';

return (
  <Base.SidebarProvider>
    <Base.SidebarTrigger />
    <Base.SidebarList />
  </Base.SidebarProvider>
);
```

### Sidebar Provider

<AutoTypeTable path="./content/docs/headless/props.ts" name="SidebarProviderProps" />

### Sidebar Trigger

Opens the sidebar on click.

<AutoTypeTable path="./content/docs/headless/props.ts" name="SidebarTriggerProps" />

### Sidebar List

| Data Attribute | Values        | Description        |
| -------------- | ------------- | ------------------ |
| `data-open`    | `true, false` | Is sidebar opening |


file: ./content/docs/headless/components/toc.mdx
# Fumadocs Core (core library of framework): TOC

Table of Content
        
A Table of Contents with active anchor observer and auto scroll.

## Usage

```tsx
import * as Base from 'fumadocs-core/toc';

return (
  <Base.AnchorProvider>
    <Base.ScrollProvider>
      <Base.TOCItem />
      <Base.TOCItem />
    </Base.ScrollProvider>
  </Base.AnchorProvider>
);
```

### Anchor Provider

Watch for the active anchor using the Intersection API.

<AutoTypeTable path="./content/docs/headless/props.ts" name="AnchorProviderProps" />

### Scroll Provider

Contains all TOC items. It automatically scrolls to the active anchor.

<AutoTypeTable path="./content/docs/headless/props.ts" name="ScrollProviderProps" />

### TOC Item

The item to jump to the anchor.

| Data Attribute | Values        | Description      |
| -------------- | ------------- | ---------------- |
| `data-active`  | `true, false` | Is anchor active |


file: ./content/docs/headless/content-collections/index.mdx
# Fumadocs Core (core library of framework): Content Collections

Use Content Collections for Fumadocs
        
[Content Collections](https://www.content-collections.dev) is a library that transforms your content into type-safe data collections.

## Setup

Install the required packages.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install @fumadocs/content-collections @content-collections/core @content-collections/mdx @content-collections/next
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add @fumadocs/content-collections @content-collections/core @content-collections/mdx @content-collections/next
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add @fumadocs/content-collections @content-collections/core @content-collections/mdx @content-collections/next
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add @fumadocs/content-collections @content-collections/core @content-collections/mdx @content-collections/next
    ```
  </Tab>
</Tabs>

After the installation, add a path alias for the generated collections to the `tsconfig.json`.

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "content-collections": ["./.content-collections/generated"]
    }
  }
}
```

In the Next.js configuration file, apply the plugin.

```js title="next.config.mjs"
import { withContentCollections } from '@content-collections/next';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withContentCollections(config);
```

To integrate with Fumadocs, add the following to your `content-collections.ts`.

```ts title="content-collections.ts"
import { defineCollection, defineConfig } from '@content-collections/core';
import {
  createMetaSchema,
  createDocSchema,
  transformMDX,
} from '@fumadocs/content-collections/configuration';

const docs = defineCollection({
  name: 'docs',
  directory: 'content/docs',
  include: '**/*.mdx',
  schema: createDocSchema,
  transform: transformMDX,
});

const metas = defineCollection({
  name: 'meta',
  directory: 'content/docs',
  include: '**/meta.json',
  parser: 'json',
  schema: createMetaSchema,
});

export default defineConfig({
  collections: [docs, metas],
});
```

And pass it to Source API.

```ts title="lib/source.ts"
import { allDocs, allMetas } from 'content-collections';
import { loader } from 'fumadocs-core/source';
import { createMDXSource } from '@fumadocs/content-collections';

export const source = loader({
  baseUrl: '/docs',
  source: createMDXSource(allDocs, allMetas),
});
```

Done! You can access the pages and generated page tree from Source API.

```ts
import { getPage } from '@/lib/source';

const page = getPage(slugs);

// MDX output
page?.data.body;

// Table of contents
page?.data.toc;

// Structured Data, for Search API
page?.data.structuredData;
```

### MDX Options

You can customise MDX options in the `transformMDX` function.

```ts
import { defineCollection } from '@content-collections/core';
import { transformMDX } from '@fumadocs/content-collections/configuration';

const docs = defineCollection({
  transform: (document, context) =>
    transformMDX(document, context, {
      // options here
    }),
});
```

### Import Components

To use components from other packages like Fumadocs UI, pass them to your `<MDXContent />` component.

```tsx
import { MDXContent } from '@content-collections/mdx/react';
import { getMDXComponents } from '@/mdx-components';

<MDXContent code="..." components={getMDXComponents()} />;
```

You can also import them in MDX Files, but it is not recommended.

<Callout title="Deep Dive: Why?">
  Content Collections uses `mdx-bundler` to bundle MDX files.

  To support importing a package from node modules, Fumadocs added a default value to the `cwd` option of MDX Bundler.
  It works good, but we still **do not** recommend to import components in MDX files.

  Reasons:

  * It requires esbuild to bundle these components, while it should be done by the Next.js bundler (for features of Server Components)
  * You can refactor the import path of components without changing your MDX files.
  * With Remote Sources, it doesn't make sense to add an import in MDX files.
</Callout>


file: ./content/docs/headless/mdx/headings.mdx
# Fumadocs Core (core library of framework): Headings

Process headings from your document
        
## Remark Heading

Apply ids to headings.

```ts title="MDX Compiler"
import { compile } from '@mdx-js/mdx';
import { remarkHeading } from 'fumadocs-core/mdx-plugins';

await compile('...', {
  remarkPlugins: [remarkHeading],
});
```

> This plugin is included by default on Fumadocs MDX.

### Extract TOC

By default, it extracts the headings (table of contents) of a document to `vfile.data.toc`.
You can disable it with:

```ts
import { remarkHeading } from 'fumadocs-core/mdx-plugins';

export default {
  remarkPlugins: [[remarkHeading, { generateToc: false }]],
};
```

### Custom Ids \[#custom-heading-id]

You can customise the heading id with `[#slug]`.

```md
# heading [#slug]
```

### Output

An array of `TOCItemType`.

<AutoTypeTable path="./content/docs/headless/props.ts" name="TOCItemType" />

## Rehype TOC

Export table of contents (an array of `TOCItemType`), it allows JSX nodes which is not possible with a Remark plugin.

> It requires MDX.js.

### Usage

```ts
import { rehypeToc } from 'fumadocs-core/mdx-plugins';

export default {
  rehypePlugins: [rehypeToc],
};
```

### Output

For a Markdown document:

```md
## Hello `code`
```

An export will be created:

```jsx
export const toc = [
  {
    title: (
      <>
        Hello <code>code</code>
      </>
    ),
    depth: 2,
    url: '#hello-code',
  },
];
```


file: ./content/docs/headless/mdx/index.mdx
# Fumadocs Core (core library of framework): MDX Plugins

Useful remark & rehype plugins for your docs.
        


file: ./content/docs/headless/mdx/install.mdx
# Fumadocs Core (core library of framework): Package Install

Generate code blocks for installing packages
        
## Usage

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install fumadocs-docgen
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add fumadocs-docgen
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add fumadocs-docgen
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add fumadocs-docgen
    ```
  </Tab>
</Tabs>

Add the remark plugin.

```ts title="source.config.ts" tab="Fumadocs MDX"
import { remarkInstall } from 'fumadocs-docgen';
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkInstall],
  },
});
```

```ts tab="MDX Compiler"
import { compile } from '@mdx-js/mdx';
import { remarkInstall } from 'fumadocs-docgen';

await compile('...', {
  remarkPlugins: [remarkInstall],
});
```

Define the required components.

```tsx title="mdx-components.tsx (Fumadocs UI)"
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    Tab,
    Tabs,
    ...components,
  };
}
```

| Component |                                   |
| --------- | --------------------------------- |
| Tabs      | Accept an array of item (`items`) |
| Tab       | Accept the name of item (`value`) |

Create code blocks with `package-install` as language.

````mdx
```package-install
my-package
```

```package-install
npm i my-package -D
```
````

### Output

The following structure should be generated by the plugin.

```mdx
<Tabs items={['npm', 'pnpm', 'yarn', 'bun']}>
  <Tab value="npm">...</Tab>
  <Tab value="pnpm">...</Tab>
  <Tab value="yarn">...</Tab>
  <Tab value="bun">...</Tab>
<Tabs>
```

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install my-package
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add my-package
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add my-package
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add my-package
    ```
  </Tab>
</Tabs>

## Options

### Persistent

When using with Fumadocs UI, you can enable persistent with the `persist` option.

```ts
import { remarkInstall } from 'fumadocs-docgen';

const config = {
  remarkPlugins: [
    [
      remarkInstall,
      {
        persist: {
          id: 'some-id',
        },
      },
    ],
  ],
};
```

This will instead generate:

```mdx
<Tabs groupId="some-id" persist items={[...]}>
  ...
<Tabs>
```


file: ./content/docs/headless/mdx/rehype-code.mdx
# Fumadocs Core (core library of framework): Rehype Code

Code syntax highlighter
        
A wrapper of [Shiki](https://shiki.style), the built-in syntax highlighter.

## Usage

Add the rehype plugin.

```ts title="MDX Compiler"
import { compile } from '@mdx-js/mdx';
import { remarkInstall } from 'fumadocs-docgen';

await compile('...', {
  remarkPlugins: [remarkInstall],
});
```

> This plugin is included by default on Fumadocs MDX.

### Output

A codeblock wrapped in `<pre />`.

```html
<pre>
<code>...</code>
</pre>
```

### Meta

It parses the `title` meta string, and add it to the `pre` element via attribute.

````mdx
```js title="Title"
console.log('Hello');
```
````

You may filter the meta string before processing it with the `filterMetaString` option.

### Inline Code

`console.log("hello world"){:js}` works.

See [https://shiki.style/packages/rehype#inline-code](https://shiki.style/packages/rehype#inline-code).

### Icon

Add an icon according to the language of codeblock.
It outputs HTML, you might need to render it with React `dangerouslySetInnerHTML`.

```jsx
<pre icon="<svg />">...</pre>
```

Disable or customise icons with the `icon` option.

### More Options

see [Shiki](https://shiki.style).


file: ./content/docs/headless/mdx/remark-admonition.mdx
# Fumadocs Core (core library of framework): Remark Admonition

Use Admonition in Fumadocs
        
In Docusaurus, there's an [Admonition syntax](https://docusaurus.io/docs/markdown-features/admonitions).

For people migrating from Docusaurus, you can enable this remark plugin to support the Admonition syntax.

## Usage

```ts title="source.config.ts" tab="Fumadocs MDX"
import { remarkAdmonition } from 'fumadocs-core/mdx-plugins';
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkAdmonition],
  },
});
```

```ts tab="MDX Compiler"
import { compile } from '@mdx-js/mdx';
import { remarkAdmonition } from 'fumadocs-core/mdx-plugins';

await compile('...', {
  remarkPlugins: [remarkAdmonition],
});
```

### Input

```md
:::warning
Hello World
:::
```

### Output

```mdx
<Callout type='warn'>

Hello World

</Callout>
```

### When to use

We highly recommend to use the JSX syntax of MDX instead.
It's more flexible, some editors support intellisense in MDX files.

```mdx
<Callout type='warn'>

Hello World

</Callout>
```


file: ./content/docs/headless/mdx/remark-docgen.mdx
# Fumadocs Core (core library of framework): Remark Docs Generation

Useful remark plugins to generate docs automatically
        
## Usage

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install fumadocs-docgen
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add fumadocs-docgen
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add fumadocs-docgen
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add fumadocs-docgen
    ```
  </Tab>
</Tabs>

Add the remark plugin.

```ts title="source.config.ts" tab="Fumadocs MDX"
import { remarkDocGen, fileGenerator } from 'fumadocs-docgen';
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [[remarkDocGen, { generators: [fileGenerator()] }]],
  },
});
```

```ts tab="MDX Compiler"
import { remarkDocGen, fileGenerator } from 'fumadocs-docgen';
import { compile } from '@mdx-js/mdx';

await compile('...', {
  remarkPlugins: [[remarkDocGen, { generators: [fileGenerator()] }]],
});
```

## File Generator

It copies the content from a file to the document (mdast tree) and forms a paragraph.

````mdx
```json doc-gen:file
{
  "file": "./my/file.txt"
}
```
````

### As Code Block

Copy the content into a code block.

````mdx
```json doc-gen:file
{
  "file": "./my/file.txt",
  "codeblock": true
}
```
````

Or to specify the programming language and meta string:

````mdx
```json doc-gen:file
{
  "file": "./my/file.txt",
  "codeblock": {
    "lang": "ts",
    "meta": "title=\"Hello\""
  }
}
```
````


file: ./content/docs/headless/mdx/remark-image.mdx
# Fumadocs Core (core library of framework): Remark Image

Make images compatible with Next.js Image Optimization
        
## Usage

Add it to your Remark plugins.

```ts title="MDX Compiler"
import { compile } from '@mdx-js/mdx';
import { remarkImage } from 'fumadocs-core/mdx-plugins';

await compile('...', {
  remarkPlugins: [remarkImage],
});
```

> This plugin is included by default on Fumadocs MDX.

Supported:

* Local Images
* External URLs
* Next.js static imports

### How It Works

It transforms your `![image](/test.png)` into Next.js Image usage, and add required props like `width` and `height`.

By default, it uses **static imports** to import local images, which supports the `placeholder` option of Next.js Image.
Next.js can handle image imports with its built-in image loader.

Otherwise, it uses the file system or an HTTP request to download the image and obtain its size.

### Options

<AutoTypeTable path="./content/docs/headless/props.ts" name="RemarkImageOptions" />

### Example: With Imports

```mdx
![Hello](/hello.png)
![Test](https://example.com/image.png)
```

Yields:

```mdx
import HelloImage from './public/hello.png';

<img alt="Hello" src={HelloImage} />
<img
  alt="Test"
  src="https://example.com/image.png"
  width="1980"
  height="1080"
/>
```

Where `./public/hello.png` points to the image in public directory.

### Example: Without Imports

You can disable Next.js static imports on local images.

```ts
import { remarkImage } from 'fumadocs-core/mdx-plugins';

export default {
  remarkPlugins: [[remarkImage, { useImport: false }]],
};
```

```mdx
![Hello](/hello.png)
![Test](https://example.com/image.png)
```

Yields:

```mdx
<img alt="Hello" src="/hello.png" width="1980" height="1080" />
<img
  alt="Test"
  src="https://example.com/image.png"
  width="1980"
  height="1080"
/>
```

### Example: Relative Paths

When `useImport` is enabled, you can reference local images using relative paths.

```mdx
![Hello](./hello.png)
```

Be careful that using it with `useImport` disabled **doesn't work**.
Next.js will not add the image to public assets unless you have imported it in code.
For images in public directory, you can just reference them without relative paths.

### Example: Public Directory

Customise the path of public directory

```ts
import { remarkImage } from 'fumadocs-core/mdx-plugins';
import path from 'node:path';

export default {
  remarkPlugins: [
    remarkImage,
    {
      publicDir: path.join(process.cwd(), 'dir'),
    },
  ],
};
```

You can pass a URL too.

```ts
import { remarkImage } from 'fumadocs-core/mdx-plugins';

export default {
  remarkPlugins: [
    remarkImage,
    {
      publicDir: 'http://localhost:3000/images',
    },
  ],
};
```


file: ./content/docs/headless/mdx/remark-ts2js.mdx
# Fumadocs Core (core library of framework): Remark TS to JS

A remark plugin to transform TypeScript codeblocks into two tabs of codeblock with its JavaScript variant.
        
## Usage

Install dependencies:

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install fumadocs-docgen oxc-transform
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add fumadocs-docgen oxc-transform
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add fumadocs-docgen oxc-transform
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add fumadocs-docgen oxc-transform
    ```
  </Tab>
</Tabs>

Add `oxc-transform` to `serverExternalPackages` in `next.config.mjs`:

```js title="next.config.mjs"
import { createMDX } from 'fumadocs-mdx/next';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  serverExternalPackages: ['oxc-transform'],
};

const withMDX = createMDX();

export default withMDX(config);
```

Add the remark plugin:

```ts title="source.config.ts" tab="Fumadocs MDX"
import { remarkTypeScriptToJavaScript } from 'fumadocs-docgen/remark-ts2js';
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkTypeScriptToJavaScript],
  },
});
```

```ts tab="MDX Compiler"
import { remarkTypeScriptToJavaScript } from 'fumadocs-docgen/remark-ts2js';
import { compile } from '@mdx-js/mdx';

await compile('...', {
  remarkPlugins: [remarkTypeScriptToJavaScript],
});
```

Finally, make sure to define the required MDX components: `Tabs` and `Tab`.

```tsx title="mdx-components.tsx (Fumadocs UI)"
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    Tab,
    Tabs,
    ...components,
  };
}
```

You can now enable it on TypeScript/TSX codeblocks, like:

````md
```tsx ts2js
import { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
```
````

```tsx ts2js
import { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
```


file: ./content/docs/headless/mdx/structure.mdx
# Fumadocs Core (core library of framework): Remark Structure

Extract information from your documents, useful for implementing document search
        
## Usage

Add it as a remark plugin.

```ts title="MDX Compiler"
import { compile } from '@mdx-js/mdx';
import { remarkStructure } from 'fumadocs-core/mdx-plugins';

const vfile = await compile('...', {
  remarkPlugins: [remarkStructure],
});
```

> This plugin is included by default on Fumadocs MDX.

Extracted information could be found in `vfile.data.structuredData`, you may
write your own plugin to convert it into a MDX export.

### Options

<AutoTypeTable path="./content/docs/headless/props.ts" name="StructureOptions" />

### Output

A list of headings and contents. Paragraphs will be extracted to the `contents`
array, each item contains a `heading` prop indicating the heading of paragraph.

<Callout title="Note">A heading can have multiple paragraphs.</Callout>

#### Heading

| Prop      |                                      |
| --------- | ------------------------------------ |
| `id`      | unique identifier or slug of heading |
| `content` | Text content                         |

#### Content

| Prop      |                                 |
| --------- | ------------------------------- |
| `heading` | Heading of paragraph (nullable) |
| `content` | Text content                    |

## As a Function

Accepts MDX/markdown content and return structurized data.

```ts
import { structure } from 'fumadocs-core/mdx-plugins';

structure(page.body.raw);
```

<Callout title="Tip" className="mt-4">
  If you have custom remark plugins enabled, such as
  `remark-math`, you have to pass these plugins to the function. This avoids unreadable content on paragraphs.

  ```ts
  import { structure } from 'fumadocs-core/mdx-plugins';
  import remarkMath from 'remark-math';

  structure(page.body.raw, [remarkMath]);
  ```
</Callout>

### Parameters

| Parameter       |                        |
| --------------- | ---------------------- |
| `content`       | MDX/markdown content   |
| `remarkPlugins` | List of remark plugins |
| `options`       | Custom options         |


file: ./content/docs/headless/search/algolia.mdx
# Fumadocs Core (core library of framework): Algolia Search

Integrate Algolia Search with Fumadocs
        
<Callout title="Notice">
  If you're using Algolia's free tier, you have to [display their logo on your
  search dialog](https://algolia.com/policies/free-services-terms).
</Callout>

## Introduction

The Algolia Integration automatically configures Algolia Search for document search.

It creates a record for **each paragraph** in your document, it is also recommended by Algolia.

Each record contains searchable attributes:

| Attribute | Description           |
| --------- | --------------------- |
| `title`   | Page Title            |
| `section` | Heading ID (nullable) |
| `content` | Paragraph content     |

The `section` field only exists in paragraphs under a heading. Headings and
paragraphs are indexed as an individual record, grouped by their page ID.

Notice that it expects the `url` property of a page to be unique, you shouldn't have two pages with the same
url.

## Setup

### Install Dependencies

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install algoliasearch
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add algoliasearch
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add algoliasearch
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add algoliasearch
    ```
  </Tab>
</Tabs>

### Sign up on Algolia

Sign up and obtain the app id and API keys for your search. Store these
credentials in environment variables.

### Sync Search Indexes

Export the search indexes from Next.js using a route handler, this way we can access the search indexes after production build:

```ts title="app/static.json/route.ts"
import { NextResponse } from 'next/server';
import { type DocumentRecord } from 'fumadocs-core/search/algolia';
import { source } from '@/lib/source';

export const revalidate = false;

export function GET() {
  const results: DocumentRecord[] = [];

  for (const page of source.getPages()) {
    results.push({
      _id: page.url,
      structured: page.data.structuredData,
      url: page.url,
      title: page.data.title,
      description: page.data.description,
    });
  }

  return NextResponse.json(results);
}
```

Make a script to sync search indexes:

```js title="update-index.mjs"
import algosearch from 'algoliasearch';
import { sync } from 'fumadocs-core/search/algolia';
import * as fs from 'node:fs';

const content = fs.readFileSync('.next/server/app/static.json.body');

/** @type {import('fumadocs-core/search/algolia').DocumentRecord[]} **/
const indexes = JSON.parse(content.toString());

const client = algosearch('id', 'key');

sync(client, {
  documents: indexes, // search indexes, can be provided by your content source too [!code highlight]
});
```

The `sync` function will update the index settings and sync search indexes.

Now run the script after build:

```json title="package.json"
{
  "scripts": {
    "build": "next build && node ./update-index.mjs"
  }
}
```

### Workflow

You may make it a script and manually sync with `node ./update-index.mjs`, or
integrate it with your CI/CD pipeline.

<Callout type="warn" title="Typescript Usage">
  If you are running the script with [TSX](https://github.com/privatenumber/tsx)
  or other similar Typescript executors, ensure to name it `.mts` for best ESM
  compatibility.
</Callout>

### Search UI

You can consider different options for implementing the UI:

* [Fumadocs UI Usage](/docs/ui/search#algolia)
* Build your own using the built-in search client hook:

  ```ts
  import algosearch from 'algoliasearch';
  import { useDocsSearch } from 'fumadocs-core/search/client';

  const index = algosearch('id', 'key').initIndex('document');

  const { search, setSearch, query } = useDocsSearch({
    type: 'algolia',
    index,
    distinct: 5,
    hitsPerPage: 10,
  });
  ```

## Options

### Tag Filter

To configure tag filtering, add a `tag` value to indexes.

```js
import algosearch from 'algoliasearch';
import { sync } from 'fumadocs-core/search/algolia';

const client = algosearch('id', 'key');

sync(client, {
  documents: indexes.map((index) => ({
    ...index,
    tag: 'value', // [!code highlight]
  })),
});
```

And update your search client:

* **Fumadocs UI**: Enable [Tag Filter](/docs/ui/search#tag-filter-1) on Search Dialog.
* **Search Client**: You can add the tag filter like:

  ```ts
  import algosearch from 'algoliasearch';
  import { useDocsSearch } from 'fumadocs-core/search/client';

  const index = algosearch('id', 'key').initIndex('document');

  const { search, setSearch, query } = useDocsSearch(
    {
      type: 'algolia',
      index,
    },
    undefined,
    '<your tag value>',
  );
  ```

The `tag` field is an attribute for faceting. You can also use the filter `tag:value` on Algolia search clients.

### Customise Attributes & Settings

While the default attributes might not suit your case, you can pass `extra_data`
to index options for adding extra fields to each record.

```js
import { sync } from 'fumadocs-core/search/algolia';

sync(client, {
  documents: indexes.map((docs) => ({
    ...docs,
    extra_data: {
      value: 'hello world',
    },
  })),
});
```

To customize the default index settings, set index settings, and update
documents with `updateDocuments(...)` separately.


file: ./content/docs/headless/search/index.mdx
# Fumadocs Core (core library of framework): Search

Configure Search in Fumadocs
        


file: ./content/docs/headless/search/orama-cloud.mdx
# Fumadocs Core (core library of framework): Orama Cloud

Integrate with Orama Cloud
        
To begin, create an account on Orama Cloud.

## REST API

REST API integration requires your docs to upload the indexes.

1. Create a new REST API index from Dashboard.

2. Use the following schema:

   ```json
   {
     "id": "string",
     "title": "string",
     "url": "string",
     "tag": "string",
     "page_id": "string",
     "section": "string",
     "section_id": "string",
     "content": "string"
   }
   ```

3. Then, using the private API key and index ID from dashboard, create a script to sync search indexes.

   ```js title="sync-index.mjs"
   import { sync } from 'fumadocs-core/search/orama-cloud';
   import * as fs from 'node:fs/promises';
   import { CloudManager } from '@oramacloud/client';

   export async function updateSearchIndexes() {
     const apiKey = process.env.ORAMA_PRIVATE_API_KEY; // private API key [!code highlight]

     if (!apiKey) {
       console.log('no api key for Orama found, skipping');
       return;
     }

     const content = await fs.readFile('.next/server/app/static.json.body');
     const records = JSON.parse(content.toString());

     const manager = new CloudManager({ api_key: apiKey });

     await sync(manager, {
       index: '<index>',
       documents: records,
     });

     console.log(`search updated: ${records.length} records`);
   }

   void updateSearchIndexes();
   ```

4. Create a route handler in your Next.js app to export search indexes.

   ```ts title="app/static.json/route.ts"
   import { NextResponse } from 'next/server';
   import { type OramaDocument } from 'fumadocs-core/search/orama-cloud';
   import { source } from '@/lib/source';

   export const revalidate = false;

   export function GET() {
     const results: OramaDocument[] = [];

     for (const page of source.getPages()) {
       results.push({
         id: page.url,
         structured: page.data.structuredData,
         url: page.url,
         title: page.data.title,
         description: page.data.description,
       });
     }

     return NextResponse.json(results);
   }
   ```

5. Run the script after `next build`.

### Search Client

To search documents on the client side, use [Fumadocs UI Search Dialog](/docs/ui/search#orama-cloud), or make your own implementation.

In addition, the headless search client of Fumadocs can handle state management for React.

```ts
import { useDocsSearch } from 'fumadocs-core/search/client';
import { OramaClient } from '@oramacloud/client';

const client = new OramaClient();

const { search, setSearch, query } = useDocsSearch({
  type: 'orama-cloud',
  client,
  params: {
    // search params
  },
});
```

## Web Crawler

1. Create a Crawler index from dashboard, and configure it correctly with the "Documentation" preset.
2. Copy the public API key and index ID from dashboard

### Search Client

Same as REST API integration, but make sure to set `index` to `crawler`.

```ts
import { useDocsSearch } from 'fumadocs-core/search/client';
import { OramaClient } from '@oramacloud/client';

const client = new OramaClient({
  endpoint: '<endpoint_url>',
  api_key: '<api_key>',
});

const { search, setSearch, query } = useDocsSearch({
  type: 'orama-cloud',
  index: 'crawler',
  client,
  params: {
    // optional search params
  },
});
```

It's same for Fumadocs UI:

```tsx
'use client';

import { OramaClient } from '@oramacloud/client';
import type { SharedProps } from 'fumadocs-ui/components/dialog/search';
import SearchDialog from 'fumadocs-ui/components/dialog/search-orama';

const client = new OramaClient({
  endpoint: '<endpoint_url>',
  api_key: '<api_key>',
});

export default function CustomSearchDialog(props: SharedProps) {
  return <SearchDialog {...props} index="crawler" client={client} />;
}
```


file: ./content/docs/headless/search/orama.mdx
# Fumadocs Core (core library of framework): Built-in Search

Built-in document search of Fumadocs
        
Fumadocs supports searching document based on Orama.

As the built-in search of Fumadocs, It is the default but also recommended
option since it's easier to setup and totally free.

## Setup

You can create the search route handler from the source object, or search indexes.

### From Source

Create a route handler from Source object.

```ts title="app/api/search/route.ts"
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source);
```

### From Search Indexes

Pass search indexes to the function.

Each index needs a `structuredData` field.
Usually, it has been provided by your content source (e.g. Fumadocs MDX).

```ts title="app/api/search/route.ts"
import { source } from '@/lib/source';
import { createSearchAPI } from 'fumadocs-core/search/server';

export const { GET } = createSearchAPI('advanced', {
  indexes: source.getPages().map((page) => ({
    title: page.data.title,
    description: page.data.description,
    url: page.url,
    id: page.url,
    structuredData: page.data.structuredData,
  })),
});
```

It can also be processed from Markdown/MDX document using the [Structure](/docs/headless/mdx/structure) remark plugin.

### Client

You can query it using:

* **Fumadocs UI**: The built-in [Search UI](/docs/ui/search) supports it out-of-the-box.
* **Search Client**:

  ```ts twoslash
  import { useDocsSearch } from 'fumadocs-core/search/client';

  const client = useDocsSearch({
    type: 'fetch',
  });
  ```

  <AutoTypeTable type="Extract<import(&#x22;fumadocs-core/search/client&#x22;).Client, { type: &#x22;fetch&#x22; }>" />

### Tag Filter

Support filtering by tag, it's useful for implementing multi-docs similar to this documentation.

```ts title="app/api/search/route.ts"
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source, (page) => ({
  title: page.data.title,
  description: page.data.description,
  url: page.url,
  id: page.url,
  structuredData: page.data.structuredData,
  // use your desired value, like page.slugs[0]
  tag: '<value>',
}));
```

and update your search client:

* **Fumadocs UI**:
  Configure [Tag Filter](/docs/ui/search#tag-filter) on Search UI.
* **Search Client**:
  pass a tag to the hook.

  ```ts
  import { useDocsSearch } from 'fumadocs-core/search/client';

  // Pass `tag` in your custom search dialog
  const client = useDocsSearch(
    {
      type: 'fetch',
    },
    undefined, // locale code, can be `undefined`
    'tag',
  );
  ```

### Index by Content

Index with the raw content of document (unrecommended).

```ts title="app/api/search/route.ts"
import { allDocs } from 'content-collections';
import { createSearchAPI } from 'fumadocs-core/search/server';

export const { GET } = createSearchAPI('simple', {
  indexes: allDocs.map((docs) => ({
    title: docs.title,
    content: docs.content, // Raw Content
    url: docs.url,
  })),
});
```

## Internationalization

* `createFromSource()`:

  Configure i18n on source object (in `loader` function).

  ```ts title="lib/source.ts"
  import { i18n } from '@/lib/i18n';
  import { loader } from 'fumadocs-core/source';

  export const source = loader({
    i18n, // [!code highlight]
  });
  ```

* `createSearchAPI()`:

  Use `createI18nSearchAPI` for i18n functionality.

  ```ts title="app/api/search/route.ts"
  import { source } from '@/lib/source';
  import { createI18nSearchAPI } from 'fumadocs-core/search/server';
  import { i18n } from '@/lib/i18n';

  export const { GET } = createI18nSearchAPI('advanced', {
    i18n,
    indexes: source.getLanguages().flatMap(({ language, pages }) =>
      pages.map((page) => ({
        title: page.data.title,
        description: page.data.description,
        structuredData: page.data.structuredData,
        id: page.url,
        url: page.url,
        locale: language,
      })),
    ),
  });
  ```

### Update Search Client

<Callout type="info" title="For Fumadocs UI">
  You can ignore this, Fumadocs UI handles this when you have i18n configured
  correctly.
</Callout>

Add `locale` to the search client, this will only allow pages with specified locale to be searchable by the user.

```ts
const { search, setSearch, query } = useDocsSearch(
  {
    type: 'fetch',
  },
  locale,
);
```

### Special Languages

If your language is not on the Orama [Supported Languages](https://docs.orama.com/open-source/supported-languages#officially-supported-languages) list, you have to configure them manually:

```ts title="app/api/search/route.ts"
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { createTokenizer } from '@orama/tokenizers/mandarin';

export const { GET } = createFromSource(source, undefined, {
  localeMap: {
    // you can customise search configs for specific locales, like:
    // [locale]: Orama options

    cn: {
      components: {
        tokenizer: createTokenizer(),
      },
      search: {
        threshold: 0,
        tolerance: 0,
      },
    },

    // use the English tokenizer
    'custom-locale': 'english',
  },
});
```

See [Orama Docs](https://docs.orama.com/open-source/supported-languages/using-chinese-with-orama) for more details.

## Static Export

To work with Next.js static export, use `staticGET` from search server.

```ts title="app/api/search/route.ts"
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

// it should be cached forever
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source);
```

> `staticGET` is also available on `createSearchAPI`.

and update your search clients:

* **Fumadocs UI**: See [Static Export](/docs/ui/static-export#built-in-search) guide.

* **Search Client**:

  On your search client, use `static` instead of `fetch`.

  ```ts
  import { useDocsSearch } from 'fumadocs-core/search/client';

  const client = useDocsSearch({
    type: 'static',
  });
  ```

  <AutoTypeTable type="Extract<import(&#x22;fumadocs-core/search/client&#x22;).Client, { type: &#x22;static&#x22; }>" />

<Callout type="warn" title="Be Careful">
  Static Search requires clients to download the exported search indexes.
  For large docs sites, its size can be really big.

  Especially with i18n (e.g. Chinese tokenizers), the bundle size of tokenizers can exceed \~500MB.
  You should use 3rd party solutions like Algolia for these cases.
</Callout>

## Custom Algorithm

You can port your own search algorithm by returning a list of `SortedResult`
from your custom `/api/search/route.ts` route handler (API Endpoint). You can also integrate it
with Fumadocs UI.

<AutoTypeTable path="./content/docs/headless/props.ts" name="SortedResult" />

## Headless

You can host the search server on Express or Elysia, without Next.js.

```ts
import { initAdvancedSearch } from 'fumadocs-core/search/server';

const server = initAdvancedSearch({
  // options
});

server.search('query', {
  // you can specify `locale` and `tag` here
});
```


file: ./content/docs/headless/search/trieve.mdx
# Fumadocs Core (core library of framework): Trieve Search

Integrate Trieve Search with Fumadocs
        
> This is a community maintained integration.

## Introduction

The Trieve Integration automatically configures Trieve Search for site search.

By default, it creates a chunk for **each paragraph** in your document, it is
officially recommended by Trieve.

## Setup

### Install Dependencies

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install trieve-ts-sdk trieve-fumadocs-adapter
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add trieve-ts-sdk trieve-fumadocs-adapter
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add trieve-ts-sdk trieve-fumadocs-adapter
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add trieve-ts-sdk trieve-fumadocs-adapter
    ```
  </Tab>
</Tabs>

### Sign up on Trieve

Sign up and create a dataset. Then obtain 2 API keys where one has only read access and the other has admin access to create and delete chunks.
Store these credentials in environment variables.

<Callout title="Notice">
  One API Key should have only read access for the public facing search and the
  other should have admin access to create and delete chunks.
</Callout>

### Sync Dataset

You can export the search indexes from Next.js using a route handler:

```ts title="app/static.json/route.ts"
import { NextResponse } from 'next/server';
import { source } from '@/lib/source';
import { type TrieveDocument } from 'trieve-fumadocs-adapter/search/sync';

export const revalidate = false;

export function GET() {
  const results: TrieveDocument[] = [];

  for (const page of source.getPages()) {
    results.push({
      _id: page.url,
      structured: page.data.structuredData,
      url: page.url,
      title: page.data.title,
      description: page.data.description,
    });
  }

  return NextResponse.json(results);
}
```

Create a script, the `sync` function will sync search indexes.

```js title="update-index.mjs"
import * as fs from 'node:fs';
import { sync } from 'trieve-fumadocs-adapter/search/sync';
import { TrieveSDK } from 'trieve-ts-sdk';

const content = fs.readFileSync('.next/server/app/static.json.body');

// now you can pass it to `sync`
/** @type {import('trieve-fumadocs-adapter/search/sync').TrieveDocument[]} **/
const records = JSON.parse(content.toString());

const client = new TrieveSDK({
  apiKey: 'adminApiKey',
  datasetId: 'datasetId',
});

sync(client, records);
```

Make sure to run the script after build:

```json title="package.json"
{
  "scripts": {
    "build": "next build && node ./update-index.mjs"
  }
}
```

### Workflow

You may manually sync with `node ./update-index.mjs`, or
integrate it with your CI/CD pipeline.

<Callout type="info" title="Typescript Usage">
  You can use Bun or other JavaScript runtimes that supports TypeScript and ESM.
</Callout>

### Search UI

On Fumadocs UI, you can use the `SearchDialog` component:

```tsx title="components/search.tsx"
'use client';
import type { SharedProps } from 'fumadocs-ui/components/dialog/search';
import SearchDialog from 'trieve-fumadocs-adapter/components/dialog/search';
import { TrieveSDK } from 'trieve-ts-sdk';

const trieveClient = new TrieveSDK({
  apiKey: 'readOnlyApiKey',
  datasetId: 'datasetId',
});

export default function CustomSearchDialog(props: SharedProps) {
  return <SearchDialog trieveClient={trieveClient} {...props} />;
}
```

1. Replace `apiKey` and `datasetId` with your desired values.

2. [Replace the default search dialog](/docs/ui/search#replace-search-dialog) with your new component.

### Search Client

Add the `useTrieveSearch` hook:

```ts
import { TrieveSDK } from 'trieve-ts-sdk';
import { useTrieveSearch } from 'trieve-fumadocs-adapter/search/trieve';

const client = new TrieveSDK({
  apiKey: 'readOnlyApiKey',
  datasetId: 'datasetId',
});

const { search, setSearch, query } = useTrieveSearch(client);
```

## Options

### Tag Filter

To configure tag filtering, add a `tag` value to indexes.

```js
import { sync } from 'trieve-fumadocs-adapter/search/sync';
import { TrieveSDK } from 'trieve-ts-sdk';

const client = new TrieveSDK({
  apiKey: 'adminApiKey',
  datasetId: 'datasetId',
});

const documents = records.map((index) => ({
  ...index,
  tag: 'value', // [!code highlight]
}));

sync(client, documents);
```

#### Search UI

Enable Tag Filter.

```tsx title="components/search.tsx"
import SearchDialog from 'trieve-fumadocs-adapter/components/dialog/search';

<SearchDialog
  defaultTag="value"
  tags={[
    {
      name: 'Tag Name',
      value: 'value',
    },
  ]}
/>;
```

#### Search Client

The `tag_set` field is an attribute for filtering. To filter indexes by tag, use the filter on Trieve search clients.

```json
{
  "must": [
    {
      "field": "tag_set",
      "match": ["value"]
    }
  ]
}
```

Or with `useTrieveSearch` hook:

```ts
import { TrieveSDK } from 'trieve-ts-sdk';
import { useTrieveSearch } from 'trieve-fumadocs-adapter/search/trieve';

const client = new TrieveSDK({
  apiKey: 'readOnlyApiKey',
  datasetId: 'datasetId',
});

const { search, setSearch, query } = useTrieveSearch(
  client,
  undefined,
  '<your tag value>',
);
```


file: ./content/docs/headless/utils/find-neighbour.mdx
# Fumadocs Core (core library of framework): Find Neighbours

Find the neighbours of a page from the page tree
        
Find the neighbours of a page from the page tree, it returns the next and
previous page of a given page. It is useful for implementing a footer.

## Usage

It requires a page tree and the url of page.

```ts
import { findNeighbour } from 'fumadocs-core/server';
import { pageTree } from '@/lib/source';

const neighbours = findNeighbour(pageTree, '/url/to/page');
```

| Parameter | Type       | Description     |
| --------- | ---------- | --------------- |
| tree      | `PageTree` | The page tree   |
| url       | `string`   | The url of page |


file: ./content/docs/headless/utils/get-toc.mdx
# Fumadocs Core (core library of framework): Get TOC

Parse Table of contents from markdown/mdx content
        
Parse Table of contents from markdown/mdx content.

> [You can use the remark plugin directly](/docs/headless/mdx/headings)

## Usage

Note: If you're using a CMS, you should use the API provided by the CMS instead.

```ts
import { getTableOfContents } from 'fumadocs-core/server';

const toc = getTableOfContents('## markdown content');
```

### Output

An array of [`TOCItemType`](/docs/headless/mdx/headings#output) is returned.


file: ./content/docs/headless/utils/git-last-edit.mdx
# Fumadocs Core (core library of framework): Last Modified Time

Get the last edit time of a file in Github repository
        
## Usage

Pass your repository name, and the path to file.

```ts
import { getGithubLastEdit } from 'fumadocs-core/server';

const time = await getGithubLastEdit({
  owner: 'fuma-nama',
  repo: 'fumadocs',
  // example: "content/docs/index.mdx"
  path: `content/docs/${page.file.path}`,
});
```

### Github Token

Notice that you may easily reach the rate limit in development mode. Hence, you
should pass a Github token for a higher rate limit.

Learn more about
[Authenticating to the REST API](https://docs.github.com/en/rest/overview/authenticating-to-the-rest-api).

```ts
import { getGithubLastEdit } from 'fumadocs-core/server'

 const time = await getGithubLastEdit({
    ...,
    token: `Bearer ${process.env.GIT_TOKEN}`
  })
```

Also, you can skip this in development mode if you don't need that
functionality.

```ts
process.env.NODE_ENV === 'development'? null : getGithubLastEdit(...)
```


file: ./content/docs/headless/utils/index.mdx
# Fumadocs Core (core library of framework): Utilities

Utilities to provide extra functionality to your docs
        


file: ./content/docs/ui/(integrations)/feedback.mdx
# Fumadocs Framework: Feedback

Receive feedback from your users
        
## Overview

Feedback is crucial for knowing what your reader thinks, and help you to further improve documentation content.

## Installation

Add dependencies:

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install class-variance-authority lucide-react
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add class-variance-authority lucide-react
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add class-variance-authority lucide-react
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add class-variance-authority lucide-react
    ```
  </Tab>
</Tabs>

Copy the component:

```tsx title="components/rate.tsx"
'use client';
import { cn } from '@/lib/cn';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { type SyntheticEvent, useEffect, useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
} from 'fumadocs-ui/components/ui/collapsible';
import { cva } from 'class-variance-authority';
import { usePathname } from 'next/navigation';

const rateButtonVariants = cva(
  'inline-flex items-center gap-2 px-3 py-2 rounded-full font-medium border text-sm [&_svg]:size-4 disabled:cursor-not-allowed',
  {
    variants: {
      active: {
        true: 'bg-fd-accent text-fd-accent-foreground [&_svg]:fill-current',
        false: 'text-fd-muted-foreground',
      },
    },
  },
);

export interface Feedback {
  opinion: 'good' | 'bad';
  message: string;
}

function get(url: string): Feedback | null {
  const item = localStorage.getItem(`docs-feedback-${url}`);

  if (item === null) return null;
  return JSON.parse(item) as Feedback;
}

function set(url: string, feedback: Feedback | null) {
  const key = `docs-feedback-${url}`;

  if (feedback) localStorage.setItem(key, JSON.stringify(feedback));
  else localStorage.removeItem(key);
}

export function Rate({
  onRateAction,
}: {
  onRateAction: (url: string, feedback: Feedback) => Promise<void>;
}) {
  const url = usePathname();
  const [previous, setPrevious] = useState<Feedback | null>(null);
  const [opinion, setOpinion] = useState<'good' | 'bad' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPrevious(get(url));
  }, [url]);

  function submit(e?: SyntheticEvent) {
    e?.preventDefault();
    if (opinion == null) return;

    const feedback: Feedback = {
      opinion,
      message,
    };

    void onRateAction(url, feedback);

    set(url, feedback);
    setPrevious(feedback);
    setMessage('');
    setOpinion(null);
  }

  return (
    <Collapsible
      open={opinion !== null || previous !== null}
      onOpenChange={(v) => {
        if (!v) setOpinion(null);
      }}
      className="border-y py-3"
    >
      <div className="flex flex-row items-center gap-2">
        <p className="text-sm font-medium pe-2">How is this guide?</p>
        <button
          disabled={previous !== null}
          className={cn(
            rateButtonVariants({
              active: (previous?.opinion ?? opinion) === 'good',
            }),
          )}
          onClick={() => {
            setOpinion('good');
          }}
        >
          <ThumbsUp />
          Good
        </button>
        <button
          disabled={previous !== null}
          className={cn(
            rateButtonVariants({
              active: (previous?.opinion ?? opinion) === 'bad',
            }),
          )}
          onClick={() => {
            setOpinion('bad');
          }}
        >
          <ThumbsDown />
          Bad
        </button>
      </div>
      <CollapsibleContent className="mt-3">
        {previous ? (
          <div className="px-3 py-6 flex flex-col items-center gap-3 bg-fd-card text-fd-card-foreground text-sm text-center rounded-xl text-fd-muted-foreground">
            <p>Thank you for your feedback!</p>
            <button
              className={cn(
                buttonVariants({
                  color: 'secondary',
                }),
                'text-xs',
              )}
              onClick={() => {
                setOpinion(previous?.opinion);
                set(url, null);
                setPrevious(null);
              }}
            >
              Submit Again?
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="border rounded-lg bg-fd-secondary text-fd-secondary-foreground p-3 resize-none focus-visible:outline-none placeholder:text-fd-muted-foreground"
              placeholder="Leave your feedback..."
              onKeyDown={(e) => {
                if (!e.shiftKey && e.key === 'Enter') {
                  submit(e);
                }
              }}
            />
            <button
              type="submit"
              className={cn(buttonVariants({ color: 'outline' }), 'w-fit px-3')}
            >
              Submit
            </button>
          </form>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

The `@/lib/cn` import specifier may be different for your project, change it to import your `cn()` function if needed. (e.g. like `@/lib/utils`)

### How to Use

Now add the `<Rate />` component to your docs page:

```tsx
import { DocsPage } from 'fumadocs-ui/page';
import { Rate } from '@/components/rate';
import posthog from 'posthog-js';

export default async function Page() {
  return (
    <DocsPage toc={toc} full={page.data.full}>
      {/* at the bottom of page */}
      <Rate
        onRateAction={async (url, feedback) => {
          'use server';

          await posthog.capture('on_rate_docs', feedback);
        }}
      />
    </DocsPage>
  );
}
```

On above example, it reports user feedback by capturing a `on_rate_docs` event on PostHog.

You can specify your own server action to `onRateAction`, and report the feedback to different destinations like database, or GitHub Discussions via their API.

### Linking to GitHub Discussion

To report your feedback to GitHub Discussion, make a custom `onRateAction`.

You can copy this example as a starting point:

```ts title="lib/github.ts"
import { App, Octokit } from 'octokit';
import type { Feedback } from '@/components/rate';

export const repo = 'fumadocs';
export const owner = 'fuma-nama';
export const DocsCategory = 'Docs Feedback';

let instance: Octokit | undefined;

async function getOctokit(): Promise<Octokit> {
  if (instance) return instance;
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error(
      'No GitHub keys provided for Github app, docs feedback feature will not work.',
    );
  }

  const app = new App({
    appId,
    privateKey,
  });

  const { data } = await app.octokit.request(
    'GET /repos/{owner}/{repo}/installation',
    {
      owner,
      repo,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  instance = await app.getInstallationOctokit(data.id);
  return instance;
}

interface RepositoryInfo {
  id: string;
  discussionCategories: {
    nodes: {
      id: string;
      name: string;
    }[];
  };
}

let cachedDestination: RepositoryInfo | undefined;
async function getFeedbackDestination() {
  if (cachedDestination) return cachedDestination;
  const octokit = await getOctokit();

  const {
    repository,
  }: {
    repository: RepositoryInfo;
  } = await octokit.graphql(`
  query {
    repository(owner: "${owner}", name: "${repo}") {
      id
      discussionCategories(first: 25) {
        nodes { id name }
      }
    }
  }
`);

  return (cachedDestination = repository);
}

export async function onRateAction(url: string, feedback: Feedback) {
  'use server';
  const octokit = await getOctokit();
  const destination = await getFeedbackDestination();
  if (!octokit || !destination) return;

  const category = destination.discussionCategories.nodes.find(
    (category) => category.name === DocsCategory,
  );

  if (!category)
    throw new Error(
      `Please create a "${DocsCategory}" category in GitHub Discussion`,
    );

  const title = `Feedback for ${url}`;
  const body = `[${feedback.opinion}] ${feedback.message}\n\n> Forwarded from user feedback.`;

  const {
    search: { nodes: discussions },
  }: {
    search: {
      nodes: { id: string }[];
    };
  } = await octokit.graphql(`
          query {
            search(type: DISCUSSION, query: ${JSON.stringify(`${title} in:title repo:fuma-nama/fumadocs author:@me`)}, first: 1) {
              nodes {
                ... on Discussion { id }
              }
            }
          }`);

  if (discussions.length > 0) {
    await octokit.graphql(`
            mutation {
              addDiscussionComment(input: { body: ${JSON.stringify(body)}, discussionId: "${discussions[0].id}" }) {
                comment { id }
              }
            }`);
  } else {
    await octokit.graphql(`
            mutation {
              createDiscussion(input: { repositoryId: "${destination.id}", categoryId: "${category!.id}", body: ${JSON.stringify(body)}, title: ${JSON.stringify(title)} }) {
                discussion { id }
              }
            }`);
  }
}
```

* Create your own GitHub App and obtain its app ID and private key.
* Fill required environment variables.
* Replace constants like `owner`, `repo`, and `DocsCategory`.


file: ./content/docs/ui/(integrations)/llms.mdx
# Fumadocs Framework: llms.txt

Output docs content for large language models
        
Create a route handler, modify it to include other remark plugins.

```ts title="app/llms.txt/route.ts"
import * as fs from 'node:fs/promises';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import remarkMdx from 'remark-mdx';
import { remarkInclude } from 'fumadocs-mdx/config';

export const revalidate = false;

const processor = remark()
  .use(remarkMdx)
  // https://fumadocs.vercel.app/docs/mdx/include
  .use(remarkInclude)
  // gfm styles
  .use(remarkGfm)
  // .use(your remark plugins)
  .use(remarkStringify); // to string

export async function GET() {
  // all scanned content
  const files = await fg(['./content/docs/**/*.mdx']);

  const scan = files.map(async (file) => {
    const fileContent = await fs.readFile(file);
    const { content, data } = matter(fileContent.toString());

    const processed = await processor.process({
      path: file,
      value: content,
    });

    return `file: ${file}
meta: ${JSON.stringify(data, null, 2)}
        
${processed}`;
  });

  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'));
}
```


file: ./content/docs/ui/(integrations)/math.mdx
# Fumadocs Framework: Math

Writing math equations in Markdown/MDX documents
        
## Getting Started

Fumadocs doesn't bundle with other plugins, you have to manually install
those plugins.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install remark-math rehype-katex katex
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add remark-math rehype-katex katex
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add remark-math rehype-katex katex
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add remark-math rehype-katex katex
    ```
  </Tab>
</Tabs>

### Add Plugins

Add the remark/rehype plugins you have installed above.

The code might be vary depending on your content source, here is an example for Fumadocs MDX:

```ts
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { defineConfig } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMath],
    // Place it at first so that it won't be changed by syntax highlighter
    rehypePlugins: (v) => [rehypeKatex, ...v],
  },
});
```

### Add Stylesheet

In order to make it looks great on the client, add the following to root layout:

```tsx title="layout.tsx"
import 'katex/dist/katex.css';
```

### Done

Type some TeX expression in your documents

````mdx
```math
c = \pm\sqrt{a^2 + b^2}
```
````

```math
c = \pm\sqrt{a^2 + b^2}
```

***

**Long equations example**

```math
\displaystyle {\begin{aligned}T_{f}(z)&=\sum _{k=0}^{\infty }{\frac {(z-c)^{k}}{2\pi i}}\int _{\gamma }{\frac {f(w)}{(w-c)^{k+1}}}\,dw\\&={\frac {1}{2\pi i}}\int _{\gamma }{\frac {f(w)}{w-c}}\sum _{k=0}^{\infty }\left({\frac {z-c}{w-c}}\right)^{k}\,dw\\&={\frac {1}{2\pi i}}\int _{\gamma }{\frac {f(w)}{w-c}}\left({\frac {1}{1-{\frac {z-c}{w-c}}}}\right)\,dw\\&={\frac {1}{2\pi i}}\int _{\gamma }{\frac {f(w)}{w-z}}\,dw=f(z),\end{aligned}}
```


file: ./content/docs/ui/(integrations)/mermaid.mdx
# Fumadocs Framework: Mermaid

Rendering diagrams in your docs
        
Fumadocs doesn't have a built-in Mermaid wrapper provided, we recommend using `mermaid` directly.

## Setup

Install the required dependencies, `next-themes` is used with Fumadocs to manage the light/dark mode.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install mermaid next-themes
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add mermaid next-themes
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add mermaid next-themes
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add mermaid next-themes
    ```
  </Tab>
</Tabs>

Create the Mermaid component:

```tsx title="components/mdx/mermaid.tsx"
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { MermaidConfig } from 'mermaid';
import { useTheme } from 'next-themes';

export function Mermaid({ chart }: { chart: string }) {
  const id = useId();
  const [svg, setSvg] = useState('');
  const containerRef = useRef<HTMLDivElement>(null!);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    void renderChart();

    async function renderChart() {
      const mermaidConfig: MermaidConfig = {
        startOnLoad: false,
        securityLevel: 'loose',
        fontFamily: 'inherit',
        themeCSS: 'margin: 1.5rem auto 0;',
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      };

      const { default: mermaid } = await import('mermaid');

      try {
        mermaid.initialize(mermaidConfig);
        const { svg } = await mermaid.render(
          // strip invalid characters for `id` attribute
          id.replaceAll(':', ''),
          chart.replaceAll('\\n', '\n'),
          containerRef.current,
        );
        setSvg(svg);
      } catch (error) {
        console.error('Error while rendering mermaid', error);
      }
    }
  }, [chart, id, resolvedTheme]);

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />;
}

```

> This is originally inspired by [remark-mermaid](https://github.com/the-guild-org/docs/blob/main/packages/remark-mermaid/src/mermaid.tsx).

Add the component as a MDX component:

```tsx title="mdx-components.tsx"
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Mermaid } from '@/components/mdx/mermaid';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Mermaid,
    ...components,
  };
}
```

## Usage

Use it in MDX files.

```mdx
<Mermaid
  chart="
graph TD;
subgraph AA [Consumers]
A[Mobile app];
B[Web app];
C[Node.js client];
end
subgraph BB [Services]
E[REST API];
F[GraphQL API];
G[SOAP API];
end
Z[GraphQL API];
A --> Z;
B --> Z;
C --> Z;
Z --> E;
Z --> F;
Z --> G;"
/>
```

<Mermaid
  chart="
graph TD;
subgraph AA [Consumers]
A[Mobile app];
B[Web app];
C[Node.js client];
end
subgraph BB [Services]
E[REST API];
F[GraphQL API];
G[SOAP API];
end
Z[GraphQL API];
A --> Z;
B --> Z;
C --> Z;
Z --> E;
Z --> F;
Z --> G;"
/>


file: ./content/docs/ui/(integrations)/open-graph.mdx
# Fumadocs Framework: Open Graph

Open Graph with Next.js Metadata API
        
## Introduction

Next.js provides an useful set of utilities, allowing a flexible experience with Fumadocs.
Fumadocs uses the Next.js Metadata API for SEO.

Make sure to read their [Metadata section](https://nextjs.org/docs/app/building-your-application/optimizing/metadata) for the fundamentals of Metadata API.

## Open Graph Image

For docs pages, Fumadocs has a built-in metadata image generator.

### Auto Setup

<Tabs groupId="package-manager" persist items={['npm', 'pnpm', 'yarn', 'bun']}>
  ```bash tab="npm"
  npx fumadocs init og-image
  ```

  ```bash tab="pnpm"
  pnpm dlx fumadocs init og-image
  ```

  ```bash tab="yarn"
  yarn fumadocs init og-image
  ```

  ```bash tab="bun"
  bun fumadocs init og-image
  ```
</Tabs>

### Manual Setup

```ts title="lib/metadata.ts"
import { createMetadataImage } from 'fumadocs-core/server';
import { source } from '@/lib/source';

export const metadataImage = createMetadataImage({
  imageRoute: '/docs-og',
  source,
});
```

You will need a route handler to get started.

```tsx title="app/docs-og/[...slug]/route.tsx"
import { generateOGImage } from 'fumadocs-ui/og';
import { metadataImage } from '@/lib/metadata';

export const GET = metadataImage.createAPI((page) => {
  return generateOGImage({
    title: page.data.title,
    description: page.data.description,
    site: 'My App',
  });
});

export function generateStaticParams() {
  return metadataImage.generateParams();
}
```

> We need to append `og.png` to the end of slugs so that we can access it via `/docs-og/my-page/og.png`.

In your docs page, add the image to metadata.

```tsx title="app/docs/[[...slug]]/page.tsx"
import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { metadataImage } from '@/lib/metadata';
import { getMDXComponents } from '@/mdx-components';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return metadataImage.withImage(page.slugs, {
    title: page.data.title,
    description: page.data.description,
  });
}
```

### Font

You can also customise the font, options for Satori are also available on the built-in generator.

```ts
import { generateOGImage } from 'fumadocs-ui/og';

generateOGImage({
  fonts: [
    {
      name: 'Roboto',
      // Use `fs` (Node.js only) or `fetch` to read the font as Buffer/ArrayBuffer and provide `data` here.
      data: robotoArrayBuffer,
      weight: 400,
      style: 'normal',
    },
  ],
});
```


file: ./content/docs/ui/(integrations)/twoslash.mdx
# Fumadocs Framework: Twoslash

Use Typescript Twoslash in your docs
        
## Usage

Thanks to the Twoslash integration of [Shiki](https://github.com/shikijs/shiki), the default code syntax highlighter, it is as simple as adding a transformer.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install fumadocs-twoslash twoslash
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add fumadocs-twoslash twoslash
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add fumadocs-twoslash twoslash
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add fumadocs-twoslash twoslash
    ```
  </Tab>
</Tabs>

Update your `serverExternalPackages` in Next.js config:

```js
import { createMDX } from 'fumadocs-mdx/next';

const config = {
  reactStrictMode: true,
  serverExternalPackages: ['typescript', 'twoslash'],
};

const withMDX = createMDX();

export default withMDX(config);
```

Add to your Shiki transformers.

```ts twoslash title="source.config.ts (Fumadocs MDX)"
import { defineConfig } from 'fumadocs-mdx/config';
import { transformerTwoslash } from 'fumadocs-twoslash';
import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins';

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        transformerTwoslash(),
      ],
    },
  },
});
```

Add required styles, Tailwind CSS is recommended.

```css title="Tailwind CSS"
@import 'fumadocs-twoslash/twoslash.css';
```

Add MDX components.

```tsx title="mdx-components.tsx"
import { Popup, PopupContent, PopupTrigger } from 'fumadocs-twoslash/ui';
import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    Popup,
    PopupContent,
    PopupTrigger,
    ...components,
  };
}
```

Now you can add `twoslash` meta string to codeblocks.

````md
```ts twoslash
console.log('Hello World');
```
````

### Example

Learn more about [Twoslash notations](https://twoslash.netlify.app/refs/notations).

```ts twoslash title="Test"
type Player = {
  /**
   * The player name
   * @default 'user'
   */
  name: string;
};

// ---cut---
// @noErrors
console.g;
//       ^|

// ---cut-start---
// ---cut-end---

// ---cut-start---
// ---cut-end---

// ---cut-start---
// ---cut-end---

// ---cut-start---
// ---cut-end---

const player: Player = { name: 'Hello World' };
//    ^?
```

```ts twoslash
const a = '123';

console.log(a);
//      ^^^
```

```ts twoslash
import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  input: ['./museum.yaml'],
  output: './content/docs/ui',
});
```

```ts twoslash
// @errors: 2588
const a = '123';

a = 132;
```

## Cache

You can enable filesystem cache with `typesCache` option:

```ts twoslash title="source.config.ts"
import { transformerTwoslash } from 'fumadocs-twoslash';
import { createFileSystemTypesCache } from 'fumadocs-twoslash/cache-fs';

transformerTwoslash({
  typesCache: createFileSystemTypesCache(),
});
```


file: ./content/docs/ui/(integrations)/typescript.mdx
# Fumadocs Framework: Typescript

Generate docs from Typescript definitions
        
## Usage

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install fumadocs-typescript
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add fumadocs-typescript
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add fumadocs-typescript
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add fumadocs-typescript
    ```
  </Tab>
</Tabs>

### UI Integration

It comes with the `AutoTypeTable` component. Learn more about [Auto Type Table](/docs/ui/components/auto-type-table).

### MDX Integration

You can use it as a remark plugin:

```ts title="source.config.ts" tab="Fumadocs MDX"
import { remarkAutoTypeTable, createGenerator } from 'fumadocs-typescript';
import { defineConfig } from 'fumadocs-mdx/config';

const generator = createGenerator();

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [[remarkAutoTypeTable, { generator }]],
  },
});
```

```ts tab="MDX Compiler"
import { remarkAutoTypeTable, createGenerator } from 'fumadocs-typescript';
import { compile } from '@mdx-js/mdx';

const generator = createGenerator();

await compile('...', {
  remarkPlugins: [[remarkAutoTypeTable, { generator }]],
});
```

It gives you a `auto-type-table` component.

You can use it like [Auto Type Table](/docs/ui/components/auto-type-table), but with additional rules:

* The value of attributes must be string.
* `path` accepts a path relative to the MDX file itself.
* You also need to add [`TypeTable`](/docs/ui/components/type-table) to MDX components.

```ts title="path/to/file.ts"
export interface MyInterface {
  name: string;
}
```

```mdx title="page.mdx"
<auto-type-table path="./path/to/file.ts" name="MyInterface" />
```

## Annotations

### Hide

Hide a field by adding `@internal` tsdoc tag.

```ts
interface MyInterface {
  /**
   * @internal
   */
  cache: number;
}
```

### Specify Type Name

You can specify the name of a type with the `@remarks` tsdoc tag.

```ts
interface MyInterface {
  /**
   * @remarks `timestamp` Returned by API. // [!code highlight]
   */
  time: number;
}
```

This will make the type of `time` property to be shown as `timestamp`.


file: ./content/docs/ui/components/accordion.mdx
# Fumadocs Framework: Accordion

Add Accordions to your documentation
        
## Usage

Based on
[Radix UI Accordion](https://www.radix-ui.com/primitives/docs/components/accordion), useful for FAQ sections.

```tsx
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';

<Accordions type="single">
  <Accordion title="My Title">My Content</Accordion>
</Accordions>;
```

### Accordions

<AutoTypeTable path="./content/docs/ui/props.ts" name="AccordionsProps" />

### Accordion

<AutoTypeTable path="./content/docs/ui/props.ts" name="AccordionProps" />

### Linking to Accordion

You can specify an `id` for accordion. The accordion will automatically open when the user is navigating to the page with the specified `id` in hash parameter.

```mdx
<Accordions>
<Accordion title="My Title" id="my-title">

My Content

</Accordion>
</Accordions>
```

> The value of accordion is same as title by default. When an id presents, it will be used as the value instead.


file: ./content/docs/ui/components/auto-type-table.mdx
# Fumadocs Framework: Auto Type Table

Auto-generated type table
        
<Wrapper>
  <div className="bg-fd-background p-4 rounded-xl">
    <AutoTypeTable
      name="AutoTypeTableExample"
      type={`export interface AutoTypeTableExample {
  /**
   * Markdown syntax like links, \`code\` are supported.
   *
   * See https://fumadocs.vercel.app/docs/ui/components/type-table
   */
  name: string;

  /**
  * We love Shiki.
  *
  * \`\`\`ts
  * console.log("Hello World, powered by Shiki");
  * \`\`\`
  */
  options: Partial<{ a: unknown }>;

}`}
    />
  </div>
</Wrapper>

It generates a table for your docs based on TypeScript definitions.

## Usage

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install fumadocs-typescript
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add fumadocs-typescript
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add fumadocs-typescript
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add fumadocs-typescript
    ```
  </Tab>
</Tabs>

Initialize the TypeScript compiler and add it as a MDX component.

```tsx title="mdx-components.tsx"
import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { createGenerator } from 'fumadocs-typescript';
import { AutoTypeTable } from 'fumadocs-typescript/ui';

const generator = createGenerator();

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    AutoTypeTable: (props) => (
      <AutoTypeTable {...props} generator={generator} />
    ),
    ...components,
  };
}
```

### From File

It accepts a `path` prop that points to a typescript file, and `name` for the exported type name.

```ts title="path/to/file.ts"
export interface MyInterface {
  name: string;
}
```

```mdx
<AutoTypeTable path="./path/to/file.ts" name="MyInterface" />
```

The path is relative to your project directory (`cwd`), because `AutoTypeTable` is a React Server Component, it cannot access build-time information like MDX file path.

<Callout title="Server Component only" type="warn">
  You cannot use this in a client component.
</Callout>

### From Type

You can specify the type to generate, without an actual TypeScript file.

```mdx
import { AutoTypeTable } from 'fumadocs-typescript/ui';

<AutoTypeTable type="{ hello: string }" />
```

When a `path` is given, it shares the same context as the TypeScript file.

```ts title="file.ts"
export type A = { hello: string };
```

```mdx
<AutoTypeTable path="file.ts" type="A & { world: string }" />
```

When `type` has multiple lines, the export statement and `name` prop are required.

```mdx
<AutoTypeTable
  path="file.ts"
  name="B"
  type={`
import { ReactNode } from "react"
export type B = ReactNode | { world: string }
`}
/>
```

### Functions

Notice that only object type is allowed. For functions, you should wrap them into an object instead.

```ts
export interface MyInterface {
  myFn: (input: string) => void;
}
```

### References

<TypeTable
  type={{
  "name": "AutoTypeTableProps",
  "description": "",
  "entries": [
    {
      "name": "path",
      "description": "The path to source TypeScript file.",
      "tags": {},
      "type": "string",
      "required": false
    },
    {
      "name": "name",
      "description": "Exported type name to generate from.",
      "tags": {},
      "type": "string",
      "required": false
    },
    {
      "name": "type",
      "description": "Set the type to generate from.\n\nWhen used with `name`, it generates the type with `name` as export name.\n\n```ts\nexport const myName = MyType;\n```\n\nWhen `type` contains multiple lines, `export const` is not added.\nYou need to export it manually, and specify the type name with `name`.\n\n```tsx\n<AutoTypeTable\n  path=\"./file.ts\"\n  type={`import { ReactNode } from \"react\"\n  export const MyName = ReactNode`}\n  name=\"MyName\"\n/>\n```",
      "tags": {},
      "type": "string",
      "required": false
    },
    {
      "name": "generator",
      "description": "",
      "tags": {},
      "type": "{ generateDocumentation(file: { path: string; content?: string | undefined; }, name: string | undefined, options?: GenerateOptions | undefined): GeneratedDoc[]; generateTypeTable(props: BaseTypeTableProps, options?: GenerateTypeTableOptions | undefined): Promise<...>; }",
      "required": true
    },
    {
      "name": "renderMarkdown",
      "description": "",
      "tags": {},
      "type": "((md: string) => Promise<ReactNode>)",
      "required": false
    },
    {
      "name": "options",
      "description": "",
      "tags": {},
      "type": "GenerateTypeTableOptions",
      "required": false
    }
  ]
}}
/>

### File System

It relies on the file system, hence, the page referencing this component must be built in **build time**. Rendering the component on serverless runtime may cause problems.

### Deep Dive

Under the hood, it uses the [Typescript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) to extract type information.
Your `tsconfig.json` file in the current working directory will be loaded.

To change the compiler settings, pass a `options` prop to the component.

Learn more about [Typescript Docs Generation](/docs/ui/typescript).


file: ./content/docs/ui/components/banner.mdx
# Fumadocs Framework: Banner

Add a banner to your site
        
## Usage

Put the element at the top of your root layout, you can use it for displaying announcements.

```tsx
import { Banner } from 'fumadocs-ui/components/banner';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <Banner>Hello World</Banner>
        {children}
      </body>
    </html>
  );
}
```

### Variant

Change the default variant.

```tsx
import { Banner } from 'fumadocs-ui/components/banner';

<Banner variant="rainbow">Hello World</Banner>;
```

### Change Layout

By default, the banner uses a `style` tag to modify Fumadocs layouts (e.g. reduce the sidebar height).
You can disable it with:

```tsx
import { Banner } from 'fumadocs-ui/components/banner';

<Banner changeLayout={false}>Hello World</Banner>;
```

### Close

To allow users to close the banner, give the banner an ID.

```tsx
import { Banner } from 'fumadocs-ui/components/banner';

<Banner id="hello-world">Hello World</Banner>;
```

The state will be automatically persisted.


file: ./content/docs/ui/components/dynamic-codeblock.mdx
# Fumadocs Framework: Code Block (Dynamic)

A codeblock that also highlights code
        
## Usage

```tsx
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

<DynamicCodeBlock lang="ts" code='console.log("Hello World")' />;
```

This component, different from the MDX [`CodeBlock`](/docs/ui/mdx/codeblock) component, can be used without MDX.
It highlights the code with Shiki and use the default component to render it.

Features:

* Can be pre-rendered on server
* load languages and themes on browser lazily

### Options

```tsx
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

<DynamicCodeBlock
  lang="ts"
  code='console.log("Hello World")'
  options={{
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    components: {
      // add/override components
    },
    // or Shiki options
  }}
/>;
```


file: ./content/docs/ui/components/files.mdx
# Fumadocs Framework: Files

Display file structure in your documentation
        
## Usage

Wrap file components in `Files`.

```mdx
import { File, Folder, Files } from 'fumadocs-ui/components/files';

<Files>
  <Folder name="app" defaultOpen>
    <File name="layout.tsx" />
    <File name="page.tsx" />
    <File name="global.css" />
  </Folder>
  <Folder name="components">
    <File name="button.tsx" />
    <File name="tabs.tsx" />
    <File name="dialog.tsx" />
  </Folder>
  <File name="package.json" />
</Files>
```

### File

<AutoTypeTable path="./content/docs/ui/props.ts" name="FileProps" />

### Folder

<AutoTypeTable path="./content/docs/ui/props.ts" name="FolderProps" />


file: ./content/docs/ui/components/github-info.mdx
# Fumadocs Framework: GitHub Info

Display your GitHub repository information
        
## Usage

```tsx
import { GithubInfo } from 'fumadocs-ui/components/github-info';

<GithubInfo
  owner="fuma-nama"
  repo="fumadocs"
  // your own GitHub access token (optional)
  token={process.env.GITHUB_TOKEN}
/>;
```

It's recommended to add it to your docs layout with `links` option:

```tsx title="app/docs/layout.tsx"
import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import { source } from '@/lib/source';
import { GithubInfo } from 'fumadocs-ui/components/github-info';

const docsOptions: DocsLayoutProps = {
  ...baseOptions,
  tree: source.pageTree,
  links: [
    {
      type: 'custom',
      children: (
        <GithubInfo owner="fuma-nama" repo="fumadocs" className="lg:-mx-2" />
      ),
    },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  return <DocsLayout {...docsOptions}>{children}</DocsLayout>;
}
```


file: ./content/docs/ui/components/image-zoom.mdx
# Fumadocs Framework: Zoomable Image

Allow zoom-in images in your documentation
        
## Usage

Replace `img` with `ImageZoom` in your MDX components.

```tsx title="mdx-components.tsx"
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    img: (props) => <ImageZoom {...(props as any)} />,
    ...components,
  };
}
```

Now image zoom will be automatically enabled on all images.

```mdx
![Test](/banner.png)
```

### Image Optimization

A default [`sizes` property](https://nextjs.org/docs/app/api-reference/components/image#sizes) will be defined for Next.js `<Image />` component if not specified.


file: ./content/docs/ui/components/index.mdx
# Fumadocs Framework: Components

Additional components to improve your docs
        


file: ./content/docs/ui/components/inline-toc.mdx
# Fumadocs Framework: Inline TOC

Add Inline TOC into your documentation
        
## Usage

Pass TOC items to the component.

```mdx
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';

<InlineTOC items={toc} />
```

### Use in Pages

You can add inline TOC into every page.

```tsx
<DocsPage>
  ...
  <InlineTOC items={toc} />
  ...
</DocsPage>
```

## Reference

<AutoTypeTable path="./content/docs/ui/props.ts" name="InlineTOCProps" />


file: ./content/docs/ui/components/root-toggle.mdx
# Fumadocs Framework: Root Toggle

Switch between page trees
        
## Usages

Add this component to your sidebar or other places you want.

```tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootToggle } from 'fumadocs-ui/components/layout/root-toggle';

<DocsLayout
  sidebar={{
    banner: (
      <RootToggle
        options={[
          {
            title: 'Folder 1',
            description: 'Pages in folder 1',
            url: '/path/to/page-tree-1',
          },
          {
            title: 'Folder 2',
            description: 'Pages in folder 2',
            url: '/path/to/page-tree-2',
          },
        ]}
      />
    ),
  }}
/>;
```


file: ./content/docs/ui/components/steps.mdx
# Fumadocs Framework: Steps

Adding steps to your docs
        
## Usage

Put your steps into the `Steps` container.

```mdx
import { Step, Steps } from 'fumadocs-ui/components/steps';

<Steps>
<Step>

### Hello World

</Step>

<Step>

### Hello World

</Step>
</Steps>
```

> We recommend using Tailwind CSS utility classes directly on Tailwind CSS projects.

### Without imports

You can use the Tailwind CSS utilities without importing it.

```mdx
<div className="fd-steps">
  <div className="fd-step" />
</div>
```

It supports adding step styles to only headings with arbitrary variants.

```mdx
<div className='fd-steps [&_h3]:fd-step'>

### Hello World

</div>
```

<div className="fd-steps [&_h3]:fd-step">
  ### Hello World

  You no longer need to use the step component anymore.
</div>


file: ./content/docs/ui/components/tabs.mdx
# Fumadocs Framework: Tabs

A Tabs component built with Radix UI, with additional features such as persistent and shared value.
        
## Usage

Import it in your MDX documents.

```mdx
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';

<Tabs items={['Javascript', 'Rust']}>
  <Tab value="Javascript">Javascript is weird</Tab>
  <Tab value="Rust">Rust is fast</Tab>
</Tabs>
```

### Without `value`

Without a `value`, it detects from the children index. Note that it might cause errors on re-renders, it's not encouraged if the tabs might change.

```mdx
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';

<Tabs items={['Javascript', 'Rust']}>
  <Tab>Javascript is weird</Tab>
  <Tab>Rust is fast</Tab>
</Tabs>
```

#### Demo with Re-renders

<Tabs items={['Javascript', 'Rust']}>
  <Tab>Javascript is weird</Tab>
  <Tab>Rust is fast</Tab>
</Tabs>

<WithoutValueTest />

### Shared Value

By passing an `groupId` property, you can share a value across all tabs with the same
id.

```mdx
<Tabs groupId="language" items={['Javascript', 'Rust']}>
  <Tab value="Javascript">Javascript is weird</Tab>
  <Tab value="Rust">Rust is fast</Tab>
</Tabs>
```

### Persistent

You can enable persistent by passing a `persist` property. The value will be
stored in `localStorage`, with its id as the key.

```mdx
<Tabs groupId="language" items={['Javascript', 'Rust']} persist>
  <Tab value="Javascript">Javascript is weird</Tab>
  <Tab value="Rust">Rust is fast</Tab>
</Tabs>
```

> Persistent only works if you have passed an `id`.

### Default Value

Set a default value by passing `defaultIndex`.

```mdx
<Tabs items={['Javascript', 'Rust']} defaultIndex={1}>
  <Tab value="Javascript">Javascript is weird</Tab>
  <Tab value="Rust">Rust is fast</Tab>
</Tabs>
```

### Link to Tab

Use HTML `id` attribute to link to a specific tab.

```mdx
<Tabs items={['Javascript', 'Rust', 'C++']}>
  <Tab value="Javascript">Javascript is weird</Tab>
  <Tab value="Rust">Rust is fast</Tab>
  <Tab id="tab-cpp" value="C++">
    `Hello World`
  </Tab>
</Tabs>
```

You can add the hash `#tab-cpp` to your URL and reload, the C++ tab will be activated.

<Tabs items={['Javascript', 'Rust', 'C++']}>
  <Tab value="Javascript">Javascript is weird</Tab>
  <Tab value="Rust">Rust is fast</Tab>

  <Tab id="tab-cpp" value="C++">
    `Hello World`
  </Tab>
</Tabs>

Additionally, the `updateAnchor` property can be set to `true` in the `Tabs` component
to automatically update the URL hash whenever time a new tab is selected:

```mdx
<Tabs items={['Javascript', 'Rust', 'C++']} updateAnchor>
  <Tab id="tab-js" value="Javascript">
    Javascript is weird
  </Tab>
  <Tab id="tab-rs" value="Rust">
    Rust is fast
  </Tab>
  <Tab id="tab-cpp" value="C++">
    `Hello World`
  </Tab>
</Tabs>
```

<UrlBar />

<Tabs items={['Hello', 'World']} updateAnchor>
  <Tab id="tab-hello" value="Hello">
    Hello!
  </Tab>

  <Tab id="tab-world" value="World">
    World!
  </Tab>
</Tabs>

### Advanced

You can use the styled Radix UI primitive directly from exported `Primitive`.

```mdx
import { Primitive } from 'fumadocs-ui/components/tabs';

<Primitive.Tabs>
  <Primitive.TabsList>
    <Primitive.TabsTrigger />
  </Primitive.TabsList>
  <Primitive.TabsContent />
</Primitive.Tabs>
```


file: ./content/docs/ui/components/type-table.mdx
# Fumadocs Framework: Type Table

A table for documenting types
        
## Usage

It accepts a `type` property.

```mdx
import { TypeTable } from 'fumadocs-ui/components/type-table';

<TypeTable
  type={{
    percentage: {
      description:
        'The percentage of scroll position to display the roll button',
      type: 'number',
      default: 0.2,
    },
  }}
/>
```

## References

### Type Table

<AutoTypeTable path="./content/docs/ui/props.ts" name="TypeTableProps" />

### Object Type

<AutoTypeTable path="./content/docs/ui/props.ts" name="ObjectTypeProps" />


file: ./content/docs/ui/layouts/docs.mdx
# Fumadocs Framework: Docs Layout

The layout of documentation
        
The layout of documentation pages, it includes a sidebar and mobile-only navbar.

> It is a server component, you should not reference it in a client component.

## Usage

Pass your page tree to the component.

```tsx title="layout.tsx"
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/app/layout.config';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout {...baseOptions} tree={tree}>
      {children}
    </DocsLayout>
  );
}
```

<AutoTypeTable path="./content/docs/ui/props.ts" type="Omit<DocsLayoutProps, 'children' | 'disableThemeSwitch'>" />

## Sidebar

```tsx title="layout.tsx"
import { DocsLayout } from 'fumadocs-ui/layouts/docs';

<DocsLayout
  sidebar={{
    enabled: true,
    // replace the default sidebar
    // component:
  }}
/>;
```

> See [Sidebar Links](/docs/ui/navigation/sidebar) for customising sidebar items.

<AutoTypeTable path="./content/docs/ui/props.ts" name="SidebarProps" />

## Nav

A mobile-only navbar, we recommend to customise it from `baseOptions`.

<div className="max-w-[460px] mx-auto">
  ![Docs Nav](/docs/docs-nav.png)
</div>

```tsx
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  githubUrl: 'https://github.com/fuma-nama/fumadocs',
  nav: {
    title: 'My App',
  },
};
```

<AutoTypeTable path="./content/docs/ui/props.ts" type="Omit<NavbarProps, 'children'>" />

### Transparent Mode

To make the navbar background transparent, you can configure transparent mode.

```tsx
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  nav: {
    transparentMode: 'top',
  },
};
```

| Mode     | Description                              |
| -------- | ---------------------------------------- |
| `always` | Always use a transparent background      |
| `top`    | When at the top of page                  |
| `none`   | Disable transparent background (default) |

### Replace Navbar

To replace the navbar in Docs Layout, set `nav.component` to your own component.

```tsx title="layout.tsx"
import { baseOptions } from '@/app/layout.config';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...baseOptions}
      nav={{
        component: <CustomNavbar />,
      }}
    >
      {children}
    </DocsLayout>
  );
}
```

Fumadocs uses **CSS Variables** to share the size of layout components, and fit each layout component into appropriate position.

You need to override `--fd-nav-height` to the exact height of your custom navbar, this can be done with a CSS stylesheet (e.g. in `global.css`):

```css
:root {
  --fd-nav-height: 80px !important;
}
```

## Advanced

### Disable Prefetching

By default, it uses the Next.js Link component with prefetch enabled.
When the link component appears into the browser viewport, the content (RSC payload) will be prefetched.

On Vercel, this may cause a high usage of serverless functions and Data Cache.
It can also hit the limits of some other hosting platforms.

You can disable prefetching to reduce the amount of RSC requests.

```tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';

<DocsLayout sidebar={{ prefetch: false }} />;
```


file: ./content/docs/ui/layouts/home-layout.mdx
# Fumadocs Framework: Home Layout

Shared layout for other pages
        
## Usage

Add a navbar and search dialog across other pages.

```tsx title="/app/(home)/layout.tsx"
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/app/layout.config';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return <HomeLayout {...baseOptions}>{children}</HomeLayout>;
}
```

Create a [Route Group](https://nextjs.org/docs/app/building-your-application/routing/route-groups) to share the same layout across multiple pages.

<Files>
  <Folder name="(home)" defaultOpen>
    <File name="page.tsx" />

    <File name="layout.tsx" />
  </Folder>

  <Folder name="/docs">
    <Folder name={'[[..slugs]]'}>
      <File name="page.tsx" />
    </Folder>

    <File name="layout.tsx" />
  </Folder>
</Files>


file: ./content/docs/ui/layouts/notebook.mdx
# Fumadocs Framework: Notebook

A more compact version of Docs Layout
        
## Usage

Enable the notebook layout with `fumadocs-ui/layouts/notebook`, it's a more compact layout than the default one.

![Notebook](/docs/notebook.png)

```tsx title="layout.tsx"
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { baseOptions } from '@/app/layout.config';
import { source } from '@/lib/source';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...baseOptions}
      // the position of navbar
      nav={{ ...baseOptions.nav, mode: 'top' }}
      // the position of Sidebar Tabs
      tabMode="navbar"
      tree={source.pageTree}
    >
      {children}
    </DocsLayout>
  );
}
```


file: ./content/docs/ui/layouts/page.mdx
# Fumadocs Framework: Docs Page

A page in your documentation
        
Page is the base element of a documentation, it includes Table of contents,
Footer, and Breadcrumb.

## Usage

```tsx title="page.tsx"
import {
  DocsPage,
  DocsDescription,
  DocsTitle,
  DocsBody,
} from 'fumadocs-ui/page';

<DocsPage>
  <DocsTitle>title</DocsTitle>
  <DocsDescription>description</DocsDescription>
  <DocsBody>...</DocsBody>
</DocsPage>;
```

<Callout type="info" title="Good to know">
  Instead of rendering the title with `DocsTitle` in `page.tsx`, you can put the title into MDX file.
  This will render the title in the MDX body.
</Callout>

### Body

It applies the [Typography](/docs/ui/theme#typography) styles, wrap your content inside.

```tsx
import { DocsBody } from 'fumadocs-ui/page';

<DocsBody>
  <h1>This heading looks good!</h1>
</DocsBody>;
```

## Configurations

### Full Mode

To extend the page to fill up all available space, pass `full` to the page component.
This will force TOC to be shown as a popover.

```tsx
import { DocsPage } from 'fumadocs-ui/page';

<DocsPage full>...</DocsPage>;
```

### Table of Contents

An overview of all the headings in your article, it requires an array of headings.

For Markdown and MDX documents, You can obtain it using the
[TOC Utility](/docs/headless/utils/get-toc). Content sources like Fumadocs MDX offer this out-of-the-box.

```tsx
import { DocsPage } from 'fumadocs-ui/page';

<DocsPage toc={headings}>...</DocsPage>;
```

Customise or disable TOC from your documentation with the `tableOfContent` option.

```tsx
import { DocsPage } from 'fumadocs-ui/page';

<DocsPage tableOfContent={options}>...</DocsPage>;
```

<AutoTypeTable path="./content/docs/ui/props.ts" name="TOCProps" />

#### Style

You can choose another style for TOC, like `clerk` inspired by [https://clerk.com](https://clerk.com):

```tsx
import { DocsPage } from 'fumadocs-ui/page';

<DocsPage
  tableOfContent={{
    style: 'clerk',
  }}
>
  ...
</DocsPage>;
```

#### Popover Mode

On smaller devices, it is shown on a popover instead.
Customise it with the `tableOfContentPopover` option.

```tsx
import { DocsPage } from 'fumadocs-ui/page';

<DocsPage tableOfContentPopover={options}>...</DocsPage>;
```

<AutoTypeTable path="./content/docs/ui/props.ts" name="TOCPopoverProps" />

### Last Updated Time

Display last updated time of the page.

```tsx
import { DocsPage } from 'fumadocs-ui/page';

<DocsPage lastUpdate={new Date(lastModifiedTime)} />;
```

Since you might have different version controls (e.g. Github) or it's from
remote sources like Sanity, Fumadocs UI doesn't display the last updated time by
default.

For Github hosted documents, you can use
the [`getGithubLastEdit`](/docs/headless/utils/git-last-edit) utility.

```tsx
import { DocsPage } from 'fumadocs-ui/page';
import { getGithubLastEdit } from 'fumadocs-core/server';

const time = await getGithubLastEdit({
  owner: 'fuma-nama',
  repo: 'fumadocs',
  path: `content/docs/${page.file.path}`,
});

<DocsPage lastUpdate={new Date(time)} />;
```

<Callout type="info" title="Note">
  You can also specify the last updated time of documents (e.g. using frontmatter).
  Don't forget to [update the schema type](/docs/mdx/collections#schema) on Fumadocs MDX first.
</Callout>

### Edit on GitHub

Add "Edit on GitHub" button to the page.

```tsx
import { DocsPage } from 'fumadocs-ui/page';

<DocsPage
  editOnGithub={{
    owner: 'fuma-nama',
    repo: 'fumadocs',
    sha: 'main',
    // file path, make sure it's valid
    path: `content/docs/${page.file.path}`,
  }}
/>;
```

### Footer

Footer is a navigation element that has two buttons to jump to the next and previous pages. When not specified, it shows the neighbour pages found from page tree.

Customise the footer with the `footer` option.

```tsx
import { DocsPage, DocsBody } from 'fumadocs-ui/page';

<DocsPage footer={options}>
  <DocsBody>...</DocsBody>
</DocsPage>;
```

<AutoTypeTable path="./content/docs/ui/props.ts" name="FooterProps" />

### Breadcrumb

A navigation element, shown only when user is navigating in folders.

<AutoTypeTable path="./content/docs/ui/props.ts" name="BreadcrumbProps" />

### MDX Page

In conjunction of Fumadocs MDX, you may create a `page.mdx` file and add the following.

```mdx
export { withArticle as default } from 'fumadocs-ui/page';

## Hello World
```

This creates a page with MDX, with proper typography styles applied.


file: ./content/docs/ui/layouts/root-provider.mdx
# Fumadocs Framework: Root Provider

The context provider of Fumadocs UI.
        
The context provider of all the components, including `next-themes` and context
for search dialog. It should be located at the root layout.

## Usage

```jsx
import { RootProvider } from 'fumadocs-ui/provider';

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
```

### Search Dialog

Customize or disable the search dialog with `search` option.

```jsx
<RootProvider
  search={{
    enabled: false,
  }}
>
  {children}
</RootProvider>
```

Learn more from [Search](/docs/ui/search).

### Theme Provider

Fumadocs supports light/dark modes with [`next-themes`](https://github.com/pacocoursey/next-themes).
Customise or disable it with `theme` option.

```jsx
<RootProvider
  theme={{
    enabled: false,
  }}
>
  {children}
</RootProvider>
```


file: ./content/docs/ui/mdx/codeblock.mdx
# Fumadocs Framework: Code Block

Adding code blocks to your docs
        
<Wrapper>
  <div className="bg-fd-background rounded-lg prose-no-margin">
    ```js title="config.js"
    import createMDX from 'fumadocs-mdx/config';

    const withMDX = createMDX();

    // [!code word:config]
    /** @type {import('next').NextConfig} */
    const config = {
      // [!code highlight]
      reactStrictMode: true, // [!code highlight]
    }; // [!code highlight]

    export default withMDX(config);
    ```
  </div>
</Wrapper>

Display code blocks, added by default.

* Copy button
* Custom titles and icons

## Usage

Wrap the pre element in `<CodeBlock />`, which acts as the wrapper of code block.

```tsx title="mdx-components.tsx"
import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    // HTML `ref` attribute conflicts with `forwardRef`
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre> {/* [!code highlight] */}
      </CodeBlock>
    ),
    ...components,
  };
}
```

See [Markdown](/docs/ui/markdown#codeblock) for usages.

### Keep Background

Use the background color generated by Shiki (the Rehype Code plugin).

```tsx
import { Pre, CodeBlock } from 'fumadocs-ui/components/codeblock';

<CodeBlock keepBackground {...props}>
  <Pre>{props.children}</Pre>
</CodeBlock>;
```

### Icons

Specify a custom icon by passing an `icon` prop to `CodeBlock` component.

By default, the icon will be injected by the custom Shiki transformer.

```js title="config.js"
console.log('js');
```


file: ./content/docs/ui/mdx/index.mdx
# Fumadocs Framework: MDX

Default MDX Components
        
## Usage

The default MDX components include Cards, Callouts, Code Blocks and Headings.

```ts
import defaultMdxComponents from 'fumadocs-ui/mdx';
```

### Relative Link

To support links with relative file path in `href`, override the default `a` component with:

```tsx title="app/docs/[[...slug]]/page.tsx"
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';

const page = source.getPage(['...']);

return (
  <MdxContent
    components={getMDXComponents({
      // override the `a` tag
      a: createRelativeLink(source, page),
    })}
  />
);
```

```mdx
[My Link](./file.mdx)
```

[Example: `../(integrations)/open-graph.mdx`](../\(integrations\)/open-graph.mdx)

<Callout type="warn">Server Component only.</Callout>


file: ./content/docs/ui/navigation/index.mdx
# Fumadocs Framework: Navigation

Configure navigation in your Fumadocs app.
        


file: ./content/docs/ui/navigation/links.mdx
# Fumadocs Framework: Layout Links

Customise the shared navigation links on all layouts.
        
## Overview

Fumadocs allows adding additional links to your layouts with a `links` prop, like linking to your "showcase" page.

![Nav](/docs/nav.png)

```tsx tab="Shared Options" title="app/layout.config.tsx"
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  links: [], // [!code highlight]
  // other options
};
```

```tsx tab="Docs Layout"
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/app/layout.config';
import { source } from '@/lib/source';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...baseOptions}
      tree={source.pageTree}
      links={[]} // [!code highlight]
    >
      {children}
    </DocsLayout>
  );
}
```

```tsx tab="Home Layout"
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/app/layout.config';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      {...baseOptions}
      links={[]} // [!code highlight]
    >
      {children}
    </HomeLayout>
  );
}
```

You can see all supported items below:

### Link Item

A link to navigate to a URL/href, can be external.

```tsx title="app/layout.config.tsx"
import { BookIcon } from 'lucide-react';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  links: [
    {
      icon: <BookIcon />,
      text: 'Blog',
      url: '/blog',
    },
  ],
};
```

#### Active Mode

The conditions to be marked as active.

| Mode         | Description                                                 |
| ------------ | ----------------------------------------------------------- |
| `url`        | When browsing the specified url                             |
| `nested-url` | When browsing the url and its child pages like `/blog/post` |
| `none`       | Never be active                                             |

```tsx title="app/layout.config.tsx"
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  links: [
    {
      text: 'Blog',
      url: '/blog',
      active: 'nested-url',
    },
  ],
};
```

#### Secondary

Set the item as secondary, secondary items will be displayed differently on navbar.

```tsx title="app/layout.config.tsx"
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  links: [
    {
      text: 'Blog',
      url: '/blog',
      secondary: true,
    },
  ],
};
```

### Icon Item

Same as link item, but is shown as an icon button.
Icon items are secondary by default.

```tsx title="app/layout.config.tsx"
import { BookIcon } from 'lucide-react';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  links: [
    {
      type: 'icon',
      label: 'Visit Blog', // `aria-label`
      icon: <BookIcon />,
      text: 'Blog',
      url: '/blog',
    },
  ],
};
```

### Navigation Menu

A navigation menu containing link items.

```tsx title="app/layout.config.tsx"
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  links: [
    {
      type: 'menu',
      text: 'Guide',
      items: [
        {
          text: 'Getting Started',
          description: 'Learn to use Fumadocs',
          url: '/docs',

          // (optional) Props for Radix UI Navigation Menu item in Home Layout
          menu: {
            className: 'row-span-2',
            // add banner to navigation menu card
            // can be an image or other elements
            banner: <div>Banner</div>,
          },
        },
      ],
    },
  ],
};
```

Note that the `description` field will only be displayed on the navbar in Home Layout.

### Custom Item

Display a custom component.

```tsx title="app/layout.config.tsx"
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  links: [
    {
      type: 'custom',
      children: <Button variant="primary">Login</Button>,
      secondary: true,
    },
  ],
};
```

### GitHub URL

There's also a shortcut for adding GitHub repository link item.

```tsx twoslash title="app/layout.config.tsx"
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  githubUrl: 'https://github.com',
};
```


file: ./content/docs/ui/navigation/sidebar.mdx
# Fumadocs Framework: Sidebar Links

Customise sidebar navigation links on Docs Layout.
        
## Overview

<div className="flex justify-center items-center *:max-w-[200px] bg-gradient-to-br from-fd-primary/10 rounded-xl border">
  ![Sidebar](/docs/sidebar.png)
</div>

Sidebar items are rendered from the page tree you passed to `<DocsLayout />`.

For `source.pageTree`, it generates the tree from your file structure (similar to the routing of Next.js), you can see [Organizing Pages](/docs/ui/page-conventions) for available patterns.

```tsx title="layout.tsx"
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      // other props
    >
      {children}
    </DocsLayout>
  );
}
```

You may hardcode it too:

```tsx title="layout.tsx"
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={{
        name: 'docs',
        children: [],
      }}
      // other props
    >
      {children}
    </DocsLayout>
  );
}
```

### Sidebar Tabs

A navigation component to switch between tabs.

<div className="flex justify-center items-center *:max-w-[360px] bg-gradient-to-br from-fd-primary/10 rounded-xl border">
  ![Sidebar Tabs](/docs/sidebar-tabs.png)
</div>

You can add items from page tree by creating a `meta.json` file ([Root Folder](/docs/ui/page-conventions#root-folder)):

```json title="content/docs/my-folder/meta.json"
{
  "title": "Name of Folder",
  "description": "The description of root folder (optional)",
  "root": true
}
```

Or specify them explicitly:

```tsx title="/app/docs/layout.tsx"
import { DocsLayout } from 'fumadocs-ui/layouts/docs';

<DocsLayout
  sidebar={{
    tabs: [
      {
        title: 'Test',
        description: 'Test Tab',
        url: '/docs/test',
      },
    ],
  }}
/>;
```

Set it to `false` to disable:

```tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';

<DocsLayout sidebar={{ tabs: false }} />;
```

<Callout title="Want further customisations?">
  You can specify more props to the [Docs Layout](/docs/ui/layouts/docs)
  component.
</Callout>

#### Decoration

Change the icon/styles of tabs.

```tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';

<DocsLayout
  sidebar={{
    tabs: {
      transform: (option, node) => ({
        ...option,
        icon: 'my icon',
      }),
    },
  }}
/>;
```


file: ./content/docs/ui/(integrations)/openapi/configurations.mdx
# Fumadocs Framework: Configurations

Customise Fumadocs OpenAPI
        
## File Generator

Pass options to the `generateFiles` function.

### Input

An array of input files.
Allowed:

* File Paths
* External URLs
* Wildcard

```ts
import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  input: ['./unkey.json'],
});
```

On Next.js server, the schema is dynamically fetched when the `APIPage` component renders.

<Callout type="warn" title="For Vercel">
  If the schema is passed as a file path, ensure the page **will not** be re-rendered after build.
</Callout>

### Output

Path to the output directory.

```ts
import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  output: '/content/docs',
});
```

### Per

Customise how the page is generated, default to `operation`.

| mode      | Generate a page for                 |
| --------- | ----------------------------------- |
| tag       | each tag                            |
| file      | each schema                         |
| operation | each operation (method of endpoint) |

```ts
import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  per: 'tag',
});
```

### Group By

In `operation` mode, you can group output files with folders.

| Group by | Description                                                  |
| -------- | ------------------------------------------------------------ |
| tag      | `{tag}/{page}.mdx` (Each operation can only contain `1` tag) |
| route    | `{api-endpoint}/{page}.mdx`                                  |
| none     | `{page}.mdx` (default)                                       |

```ts
import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  per: 'operation',
  groupBy: 'tag',
});
```

### Name

A function that controls the output path of files.

```ts
import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  name: (type, file) => {
    return; // filename
  },
});
```

### Imports

Add additional imports on the top of MDX files.

```ts
import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  imports: [
    {
      names: ['Component1', 'Component2'],
      from: '@/components/ui/api',
    },
  ],
});
```

### Frontmatter

Customise the frontmatter of MDX files.

By default, it includes:

| property      | description                                      |
| ------------- | ------------------------------------------------ |
| `title`       | Page title                                       |
| `description` | Page description                                 |
| `full`        | Always true, added for Fumadocs UI               |
| `method`      | Available method of operation (`operation` mode) |
| `route`       | Route of operation (`operation` mode)            |

```ts
import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  input: ['./petstore.yaml'],
  output: './content/docs',
  frontmatter: (title, description) => ({
    myProperty: 'hello',
  }),
});
```

### Add Generated Comment

Add a comment to the top of generated files indicating they are auto-generated.

```ts
import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  input: ['./petstore.yaml'],
  output: './content/docs',
  // Add default comment
  addGeneratedComment: true,

  // Or provide a custom comment
  addGeneratedComment: 'Custom auto-generated comment',

  // Or disable comments
  addGeneratedComment: false,
});
```

### Tag Display Name

Adding `x-displayName` to OpenAPI Schema can control the display name of your tags.

```yaml title="openapi.yaml"
tags:
  - name: test
    description: this is a tag.
    x-displayName: My Test Name
```

## OpenAPI Server

The server to render pages.

### Generate Code Samples

Generate custom code samples for each API endpoint.

```ts
import { createOpenAPI } from 'fumadocs-openapi/server';

export const openapi = createOpenAPI({
  generateCodeSamples(endpoint) {
    return [
      {
        lang: 'js',
        label: 'JavaScript SDK',
        source: "console.log('hello')",
      },
    ];
  },
});
```

In addition, you can also specify code samples via OpenAPI schema.

```yaml
paths:
  /plants:
    get:
      x-codeSamples:
        - lang: js
          label: JavaScript SDK
          source: |
            const planter = require('planter');
            planter.list({ unwatered: true });
```

#### Disable Code Sample

You can disable the code sample for a specific language, for example, to disable cURL:

```ts
import { createOpenAPI } from 'fumadocs-openapi/server';

export const openapi = createOpenAPI({
  generateCodeSamples(endpoint) {
    return [
      {
        lang: 'curl',
        label: 'cURL',
        source: false,
      },
    ];
  },
});
```

### Renderer

Customise components in the page.

```ts
import { createOpenAPI } from 'fumadocs-openapi/server';

export const openapi = createOpenAPI({
  renderer: {
    Root(props) {
      // your own (server) component
    },
  },
});
```

## Advanced

### Using API Page

> This is not a public API, use it carefully.

To use the `APIPage` component in your MDX files:

```mdx
---
title: Delete Api
full: true
---

<APIPage
  document="./unkey.json"
  operations={[{ path: '/v1/apis.deleteApi', method: 'post' }]}
  hasHead={false}
/>
```

| Prop         | Description                               |
| ------------ | ----------------------------------------- |
| `document`   | OpenAPI Schema                            |
| `operations` | Operations (API endpoints) to be rendered |
| `hasHead`    | Enable to render the heading of operation |


file: ./content/docs/ui/(integrations)/openapi/index.mdx
# Fumadocs Framework: OpenAPI

Generating docs for OpenAPI schema
        
You can setup Fumadocs OpenAPI manually, or use Fumadocs CLI.

## Manual Setup

Install the required packages.

<Tabs groupId="package-manager" persist items={}>
  <Tab value="npm">
    ```bash
    npm install fumadocs-openapi shiki
    ```
  </Tab>

  <Tab value="pnpm">
    ```bash
    pnpm add fumadocs-openapi shiki
    ```
  </Tab>

  <Tab value="yarn">
    ```bash
    yarn add fumadocs-openapi shiki
    ```
  </Tab>

  <Tab value="bun">
    ```bash
    bun add fumadocs-openapi shiki
    ```
  </Tab>
</Tabs>

### Generate Styles

The interactive UI of OpenAPI integration is styled with Tailwind CSS, it doesn't include a pre-built stylesheet.
You must use it with Tailwind CSS configured.

Add the package to `@source` in your Tailwind CSS configuration.

```css title="Tailwind CSS"
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';

@source '../node_modules/fumadocs-ui/dist/**/*.js';
/* [!code highlight] */
@source '../node_modules/fumadocs-openapi/dist/**/*.js';
```

### Configure Pages

Create an OpenAPI instance on the server. Fumadocs OpenAPI renders the pages on server-side.

```ts title="lib/source.ts"
import { createOpenAPI, attachFile } from 'fumadocs-openapi/server';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  pageTree: {
    // adds a badge to each page item in page tree
    attachFile,
  },
  // other props
});

export const openapi = createOpenAPI({
  // options
});
```

Add `APIPage` to your MDX Components, so that you can use it in MDX files.

```tsx title="mdx-components.tsx"
import defaultComponents from 'fumadocs-ui/mdx';
import { openapi } from '@/lib/source';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    APIPage: openapi.APIPage,
    ...components,
  };
}
```

> It is a React Server Component.

### Generate Files

You can generate MDX files directly from your OpenAPI schema.

Create a script:

```js title="scripts/generate-docs.mjs"
import { generateFiles } from 'fumadocs-openapi';

void generateFiles({
  input: ['./unkey.json'], // the OpenAPI schemas
  output: './content/docs',
});
```

> Only OpenAPI 3.0 and 3.1 are supported.

Generate docs with the script:

```bash
node ./scripts/generate-docs.mjs
```

## Features

The official OpenAPI integration supports:

* Basic API endpoint information
* Interactive API playground
* Example code to send request (in different programming languages)
* Response samples and TypeScript definitions
* Request parameters and body generated from schemas

### Demo

[View demo](/docs/openapi).


file: ./content/docs/ui/(integrations)/openapi/proxy.mdx
# Fumadocs Framework: Creating Proxy

Avoid CORS problem
        
## Introduction

A proxy server is useful for executing HTTP (`fetch`) requests, as it doesn't have CORS constraints like on the browser.
We can use it for executing HTTP requests on the OpenAPI playground, when the target API endpoints do not have CORS configured correctly.

<Callout type="warn" title="Warning">
  Do not use this on unreliable sites and API endpoints, the proxy server will
  forward all received headers & body, including HTTP-only `Cookies` and
  `Authorization` header.
</Callout>

### Setup

Create a route handler for proxy server.

```ts title="/api/proxy/route.ts"
import { openapi } from '@/lib/source';

export const { GET, HEAD, PUT, POST, PATCH, DELETE } = openapi.createProxy();
```

> Follow the [Getting Started](/docs/ui/openapi) guide if `openapi` server is not yet configured.

And enable the proxy from `createOpenAPI`.

```ts title="lib/source.ts"
import { createOpenAPI } from 'fumadocs-openapi/server';

export const openapi = createOpenAPI({
  proxyUrl: '/api/proxy',
});
```