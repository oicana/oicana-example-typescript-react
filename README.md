# React example for Oicana

https://oicana.com

> This react app is not made or styled to be a production grade frontend application. It's a simple and small tech demo for Oicana on the web.

Deployed at https://example.oicana.com/

[The npm package `@oicana/browser`][oicana-browser] is used in a shared web worker to compile Oicana templates. The UI is split between template inputs on the left and a life preview on the right. Changing the input values for `blob` or `json` inputs will cause the preview to update. Any warnings or errors from the compilation will be logged to the console.

## Development

To start the application locally, run `npm i` and `npm run dev`.

Requires Node >= 22.15

## Licensing

The code of this example project is licensed under the [MIT license](LICENSE).

But please be aware, that the Oicana dependencies [are licensed under PolyForm Noncommercial License 1.0.0][oicana-license] and requires a commercial license for use cases that are not covered by the PolyForm license. Visit [the Oicana website][oicana-website] for pricing options.


[oicana-license]: https://github.com/oicana/oicana?tab=readme-ov-file#licensing
[oicana-website]: https://oicana.com
[oicana-browser]: https://www.npmjs.com/package/@oicana/browser
