# Diagram 2 Day 07 Transform Viewport

Diagram 2 zoom and pan now use one renderer-owned viewport transform:

```javascript
{
  scale: 1,
  translateX: 0,
  translateY: 0
}
```

The transform is applied to the stable Diagram 2 viewport plane. Wheel zoom, toolbar zoom, Fit, and pan update that matrix only.

The following data is not changed by viewport movement:

- canonical object coordinates
- entity sizes
- field locations
- relationship route coordinates
- manual route points
- saved SVG metadata
- undo or clipboard data

Viewport movement is intentionally transient renderer state. It is not persisted to Diagram documents, the shared PMT Diagram file format, the Object Template library, or Diagram 1.
