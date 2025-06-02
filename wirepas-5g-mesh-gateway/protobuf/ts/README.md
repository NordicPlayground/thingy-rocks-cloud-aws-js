Update the files here using

```bash
npx protoc --ts_out wirepas-5g-mesh-gateway/protobuf/ts --ts_opt ts_nocheck --ts_opt eslint_disable --proto_path wirepas-5g-mesh-gateway/protobuf wirepas-5g-mesh-gateway/protobuf/*.proto
```

Then
[fix the imports](https://github.com/timostamm/protobuf-ts/pull/233#issuecomment-1289053379).

[`protobuf-ts`](https://github.com/timostamm/protobuf-ts/blob/master/MANUAL.md#proto2-support)
only has partial support for proto2, `required` is not supported.
