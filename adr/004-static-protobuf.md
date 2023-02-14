# ADR 004: Static protobuf parsers and generators

We generate static parsers and generators for protobuf files using
[`protobuf-ts`](https://github.com/timostamm/protobuf-ts/) to reduce the amount
of code needed to be bundled for lambda functions.

Initially [`protobufjs`](https://protobufjs.github.io/protobuf.js/)'
[pbsj](https://protobufjs.github.io/protobuf.js/#pbjs-for-javascript) was tried
but it did not generate working static files.
