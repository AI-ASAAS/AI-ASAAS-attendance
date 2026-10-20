/** Static brand background that the glass surfaces refract. */
export function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient__orb ambient__orb--1" />
      <div className="ambient__orb ambient__orb--2" />
      <div className="ambient__orb ambient__orb--3" />
      <div className="ambient__pattern" />
      <div className="ambient__mark" />
    </div>
  );
}
