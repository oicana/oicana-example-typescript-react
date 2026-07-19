# React example for Oicana

https://oicana.com

> This react app is not made or styled to be a production grade frontend application. It's a simple and small tech demo for Oicana on the web.

Deployed at https://example.oicana.com/

[The npm package `@oicana/browser`][oicana-browser] is used in a shared web worker to compile Oicana templates. The UI is split between template inputs on the left and a live preview on the right. Changing the input values for `blob` or `json` inputs will cause the preview to update. Compilation errors and warnings are shown as alerts in the inputs panel.

Template compilation is CPU-bound and runs synchronously, which is why it happens in a [shared worker](src/templating.worker.ts) instead of on the main thread. The worker keeps the compiled document around so that single pages can be rendered to PNG on demand (at the resolution the current zoom level needs), and the "Export PDF" button exports the same inputs to a PDF.

The templates offered in the UI are pre-packed and served from [`public/templates`](public/templates); [`src/LoadingContext.tsx`](src/LoadingContext.tsx) maps their ids to file names. See [the Oicana documentation][oicana-getting-started] for how to author and pack your own.

## Development

To start the application locally, run `npm i` and `npm run dev`.

Requires Node >= 20

Other scripts:

- `npm run build` – type check and build for production
- `npm run lint` – ESLint and Prettier check
- `npm run format` – fix what `lint` reports
- `npm run preview` – serve the production build locally

## Licensing

The code of this example project is licensed under the [MIT license](LICENSE).

But please be aware, that the Oicana dependencies [are licensed under PolyForm Noncommercial License 1.0.0][oicana-license] and requires a commercial license for use cases that are not covered by the PolyForm license. Visit [the Oicana website][oicana-website] for pricing options.


[oicana-license]: https://github.com/oicana/oicana?tab=readme-ov-file#licensing
[oicana-website]: https://oicana.com
[oicana-browser]: https://www.npmjs.com/package/@oicana/browser
[oicana-getting-started]: https://oicana.com/docs/getting-started/1-setup/
