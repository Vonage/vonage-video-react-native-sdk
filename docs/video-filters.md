# Publisher video filters

`OTPublisher.applyVideoFilter(filter)` and `OTPublisher.clearVideoFilter()` return
`Promise<void>`. Await the promise before treating an update as complete. Invalid
options, a missing native publisher, and native transformer creation errors reject
the promise. A failed transformer creation leaves the previous pipeline intact.

```js
try {
  await publisherRef.current.applyVideoFilter({
    type: 'backgroundBlur',
    blurStrength: 'high',
  });
  await publisherRef.current.clearVideoFilter();
} catch (error) {
  console.error(error.code, error.message);
}
```

The underlying `setVideoTransformers(transformers)` method also returns
`Promise<void>`. Handle its rejection when using the lower-level API. On Android,
completion waits for the SDK's queued setter. Completion acknowledges the native
transformer update; subsequent media/runtime errors continue through the publisher
`error` event handler.

Background replacement still requires an absolute local PNG/JPEG image path in
`backgroundImgUrl`. Download remote images first. Both platforms require the
optional Vonage Media Library transformer dependency to be installed.

## Existing video transformers

Built-in filters and lower-level video transformers are mutually exclusive.
`applyVideoFilter()` rejects with `name` and `code` set to `OT_NOT_SUPPORTED` if
`setVideoTransformers()` has installed a non-empty pipeline. Explicitly remove
that pipeline with `await publisher.setVideoTransformers([])` before applying a
built-in filter.

`clearVideoFilter()` only removes a filter installed by `applyVideoFilter()`;
it preserves custom transformers. Applying another built-in filter replaces the
previous built-in filter. Calling `setVideoTransformers()` explicitly replaces the
pipeline and relinquishes built-in filter ownership.

Updates are processed in invocation order. Failed updates preserve the previous
state and do not block subsequent calls. Calls after unmount reject with
`OT_INVALID_STATE`.
