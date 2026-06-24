export function isUxMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "ux";
}
