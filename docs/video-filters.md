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
