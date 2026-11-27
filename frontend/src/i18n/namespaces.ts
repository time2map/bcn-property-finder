/** One JSON file per language and namespace in src/locales/<language>/. Add a name here when you add a file. */
export const NAMESPACES = ['common', 'conditions', 'editor', 'card', 'panel', 'info', 'legal', 'funnel'] as const
export type Namespace = (typeof NAMESPACES)[number]

/**
 * Namespaces kept out of the start bundle in every language and fetched with the code that uses them
 * (`loadNamespace`). The English file of each is also excluded by name from the bundled glob in `./index.ts`.
 */
export const ON_DEMAND_NAMESPACES: readonly Namespace[] = ['funnel']
