/**
 * Top-left brand mini-panel reading "time2map livability". The coral brand mark + "time2map" form
 * a link to time2map.com; "livability" is the plain product descriptor. All in IBM Plex Sans so
 * the mark and text share one scale. Glass style — see .app-brand / .top-panel.
 */
export function BrandBar() {
  return (
    <div className="app-brand">
      <a
        className="brand-link"
        href="https://time2map.com"
        target="_blank"
        rel="noopener noreferrer"
        title="Visit time2map.com"
      >
        <img
          className="brand-mark"
          src={`${import.meta.env.BASE_URL}time2map-mark.svg`}
          alt="time2map"
        />
        <span className="app-title__brand">time2map</span>
      </a>
      <span className="app-title__rest">livability</span>
    </div>
  )
}
