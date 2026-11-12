// Only fixed local destinations are allowed after Discord login.
export function requestedReturnTo(value) {
  const target = String(value || "").trim().toLowerCase();
  return ["signup", "admin"].includes(target) ? target : "signup";
}

export function authReturnLocation(status, target) {
  target = requestedReturnTo(target);
  return `/${target === "admin" ? "admin" : ""}?auth=${encodeURIComponent(status)}`;
}
