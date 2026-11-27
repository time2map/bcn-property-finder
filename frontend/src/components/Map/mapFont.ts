/**
 * Font of the labels of our own layers. One name only: the glyph servers of both base maps (ICGC, OpenFreeMap) have
 * "Noto Sans Regular" but answer 404 for a list of fonts ("Noto Sans Regular,Arial Unicode MS Regular"), after
 * which MapLibre draws every letter itself, on the main thread (TODO-058).
 */
export const MAP_TEXT_FONT = ['Noto Sans Regular']
